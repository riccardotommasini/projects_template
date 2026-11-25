"""Atomic publication of the DuckDB warehouse (task P1-11).

The warehouse is built in warehouse_build.duckdb, then published as
diplomap.duckdb in one step with os.replace. A query started during a build
never sees an incomplete warehouse: it sees either the previous complete file
or the new complete file.

    from warehouse.publish import prepare_build_path, publish_warehouse

    build = prepare_build_path(BUILD_PATH, final_path=FINAL_PATH)  # first task
    ...                                                            # build into BUILD_PATH
    publish_warehouse(BUILD_PATH, FINAL_PATH)                      # last task

Rules for the pipeline (writers):
- Every task that writes to DuckDB must target the build file
  (/data/warehouse/warehouse_build.duckdb), never the published file
  (/data/warehouse/diplomap.duckdb). Writing into the published file in place
  breaks the guarantee above.
- The build connection must be closed before publication. An unclean close
  leaves a .wal file next to the build file, and publication is refused.
- Both files live in the same directory: os.replace is atomic only inside one
  filesystem.
- The published file gets mode 0o644 whatever the umask of the writer, because
  readers run under other uids on the shared volume.

Rules for readers (API, notebooks):
- Open the warehouse read-only, with short-lived connections (one per request
  or query). A connection opened before the swap keeps reading the old file
  until it is closed. DuckDB also caches the database instance per process:
  while any connection to the path is still open in a process, a new
  duckdb.connect() in that same process reuses it and still sees the old file.
  So no reader may keep a connection open for the lifetime of the process.
- Containers must mount the directory (/data or /data/warehouse), never the
  file itself. A file bind mount pins the old inode, so the container would
  never see a new publication.
"""

from __future__ import annotations

import os
from collections.abc import Iterable
from pathlib import Path

import duckdb

DEFAULT_EXPECTED_TABLES: tuple[str, ...] = (
    "dim_country",
    "dim_date",
    "dim_event_type",
    "dim_leader",
    "dim_visit_type",
    "fact_visit",
    "fact_gdelt_event",
)

# Owner read/write, group and other read: other uids read the shared volume.
PUBLISHED_MODE = 0o644


class PublicationError(RuntimeError):
    """The build cannot be published, or the paths are misconfigured. Nothing was changed."""


def _wal_path(path: Path) -> Path:
    return path.with_name(path.name + ".wal")


def _same_file(a: Path, b: Path) -> bool:
    """True if a and b name the same file (same resolved path, or same inode when both exist)."""
    if a.resolve() == b.resolve():
        return True
    try:
        return os.path.samefile(a, b)
    except OSError:
        return False


def _fsync_directory(directory: Path) -> None:
    """Persist the rename itself. Directories cannot be opened on Windows, so it is skipped there."""
    if os.name == "nt":
        return
    fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def prepare_build_path(
    build_path: str | os.PathLike,
    final_path: str | os.PathLike | None = None,
) -> Path:
    """Delete a stale build file and its .wal, then return the build path.

    Call it at the start of the build, so that every build starts from an empty
    file. Deleting the whole file is required even though schema.sql starts with
    DROP TABLE IF EXISTS: those statements only reset the 7 star schema tables,
    and a stale file would still carry everything else from a previous or
    aborted run (staging tables, quarantine tables, views, sequences) as well as
    a leftover .wal from an unclean close.

    If final_path is given and points to the same file as build_path, raise
    PublicationError and delete nothing, so a misconfigured default can never
    delete the published warehouse.
    """
    build = Path(build_path)
    if final_path is not None and _same_file(build, Path(final_path)):
        raise PublicationError(
            f"build path {build} is the published warehouse {final_path}: refusing to delete it"
        )
    _wal_path(build).unlink(missing_ok=True)
    build.unlink(missing_ok=True)
    return build


def _missing_tables(build: Path, expected_tables: Iterable[str]) -> list[str]:
    """Open the build read-only and return the expected tables that are absent from schema main."""
    try:
        with duckdb.connect(str(build), read_only=True) as connection:
            present = {
                row[0]
                for row in connection.execute(
                    "SELECT table_name FROM duckdb_tables() WHERE schema_name = 'main'"
                ).fetchall()
            }
    except duckdb.Error as error:
        raise PublicationError(f"cannot open build file {build} read-only: {error}") from error
    return [table for table in expected_tables if table not in present]


def publish_warehouse(
    build_path: str | os.PathLike,
    final_path: str | os.PathLike,
    expected_tables: Iterable[str] = DEFAULT_EXPECTED_TABLES,
) -> Path:
    """Publish the build file as the warehouse in one atomic step and return final_path.

    Refuse (raise PublicationError, touch nothing) if:
    - build_path and final_path are the same file;
    - they are not in the same directory (the rename would not be atomic);
    - the build file is missing;
    - a .wal file exists next to the build file (unclean close of the build connection);
    - one of expected_tables is missing from the build (checked read-only).

    Before the rename, the build file mode is set to 0o644. The published file
    is read on the shared volume by other users (writer uid 50000, backend uid
    10001, Jupyter JUPYTER_UID), and the mode of a new file depends on the umask
    of the process that created it: under umask 077 it would be 0o600 and every
    reader except the writer would fail. Setting the mode explicitly makes the
    published file readable whatever the umask.

    Then os.replace(build, final) and fsync the directory. The file is never
    copied and final is never written in place. On any failure the previous
    final file stays untouched and the build file stays for inspection.
    """
    build = Path(build_path)
    final = Path(final_path)
    expected = tuple(expected_tables)

    if _same_file(build, final):
        raise PublicationError(f"build path and final path are the same file: {build}")
    if build.resolve().parent != final.resolve().parent:
        raise PublicationError(
            f"build file {build} and final file {final} must be in the same directory"
        )
    if not build.is_file():
        raise PublicationError(f"build file is missing: {build}")
    wal = _wal_path(build)
    if wal.exists():
        raise PublicationError(
            f"{wal} exists: the build connection was not closed cleanly, refusing to publish"
        )
    missing = _missing_tables(build, expected)
    if missing:
        raise PublicationError(f"build file {build} is missing tables: {', '.join(missing)}")

    os.chmod(build, PUBLISHED_MODE)
    os.replace(build, final)
    _fsync_directory(final.resolve().parent)
    return final
