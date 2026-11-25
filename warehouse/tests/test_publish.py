"""Tests for the atomic publication of the warehouse (warehouse/publish.py, task P1-11).

Run from the repository root:

    pytest warehouse/tests/test_publish.py

Requires: duckdb, pytest. No Docker: every file lives in tmp_path.

What is tested:
1. Publication replaces the final file (also the first one, when it does not
   exist yet), removes the build file, leaves no .wal, and gives the published
   file mode 0o644 even under umask 077.
2. Each refusal case raises and leaves the previous final file intact.
3. prepare_build_path deletes a stale build and its .wal, and refuses to
   delete the published warehouse.
4. Acceptance criterion: a reader process opens the final file read-only in a
   loop while a writer process builds and publishes; the reader never raises
   and only sees one of the two complete states.
5. A connection opened before publication keeps the old data; a new
   connection sees the new data.

Worker processes use the "spawn" start method with module-level functions of
this module: the child receives the parent's sys.path and re-imports them.
"""

from __future__ import annotations

import hashlib
import multiprocessing
import os
import queue
import stat
import sys
import time
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from warehouse.publish import (
    DEFAULT_EXPECTED_TABLES,
    PUBLISHED_MODE,
    PublicationError,
    prepare_build_path,
    publish_warehouse,
)

# Two distinct complete states. The payload column makes the files a few MB,
# so that a non-atomic write would be visible to a reader.
N_OLD = 100_000
N_NEW = 250_000
READER_DEADLINE_S = 8.0
NEW_READS_AFTER_PUBLISH = 20

SPAWN = multiprocessing.get_context("spawn")


# Helpers (module level: also used by the spawned children)


def make_warehouse(path: Path | str, n_rows: int, tables=DEFAULT_EXPECTED_TABLES) -> None:
    """Create a complete warehouse file whose fact_visit holds n_rows rows, then close it cleanly."""
    with duckdb.connect(str(path)) as connection:
        for table in tables:
            if table == "fact_visit":
                connection.execute(
                    "CREATE TABLE fact_visit AS "
                    f"SELECT range AS visit_key, md5(range::VARCHAR) AS payload FROM range({n_rows})"
                )
            else:
                connection.execute(f"CREATE TABLE {table} (id INTEGER)")


def count_rows(path: Path | str) -> int:
    with duckdb.connect(str(path), read_only=True) as connection:
        return connection.execute("SELECT count(*) FROM fact_visit").fetchone()[0]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def wal(path: Path) -> Path:
    return path.with_name(path.name + ".wal")


def read_fd(fd: int) -> bytes:
    """Read a whole file through an already open descriptor."""
    chunks = []
    offset = 0
    while chunk := os.pread(fd, 1 << 20, offset):
        chunks.append(chunk)
        offset += len(chunk)
    return b"".join(chunks)


def assert_replaced_not_written_in_place(fd: int, old_digest: str, final: Path) -> None:
    """The descriptor opened before publication must still hold the old, untouched file.

    os.replace swaps the directory entry: the old inode survives unchanged while
    it is open. Any write into final in place (truncate, copy, overwrite) changes
    the bytes behind this descriptor, so this check is deterministic, unlike a
    reader that has to hit the short window of a non-atomic write.
    """
    assert os.fstat(fd).st_ino != os.stat(final).st_ino, "final was written in place, not replaced"
    assert hashlib.sha256(read_fd(fd)).hexdigest() == old_digest, "old file changed under its readers"


def _reader(final, ready, stop, results, n_new) -> None:
    """Count rows in a loop with short-lived read-only connections; report every outcome."""
    counts: dict[int, int] = {}
    errors: list[str] = []
    seen_new = 0
    deadline = time.monotonic() + READER_DEADLINE_S
    while time.monotonic() < deadline:
        try:
            with duckdb.connect(final, read_only=True) as connection:
                n = connection.execute("SELECT count(*) FROM fact_visit").fetchone()[0]
            counts[n] = counts.get(n, 0) + 1
            if n == n_new:
                seen_new += 1
        except Exception as error:  # noqa: BLE001 - the test asserts there is none
            errors.append(repr(error))
        ready.set()
        if stop.is_set() and seen_new >= NEW_READS_AFTER_PUBLISH:
            break
    results.put({"counts": counts, "errors": errors[:10], "n_errors": len(errors)})


def _writer(build, final, n_rows, go, published) -> None:
    """Wait for the signal, build a complete warehouse in the build file, then publish it."""
    if not go.wait(READER_DEADLINE_S):
        raise RuntimeError("writer never received the go signal")
    prepare_build_path(build, final_path=final)
    make_warehouse(build, n_rows)
    publish_warehouse(build, final)
    published.set()


def _count_in_child(path, results) -> None:
    results.put(count_rows(path))


def _stop_processes(processes) -> None:
    for process in processes:
        if process.is_alive():
            process.terminate()
    for process in processes:
        process.join(5)


# Fixtures


@pytest.fixture
def paths(tmp_path):
    return tmp_path / "warehouse_build.duckdb", tmp_path / "diplomap.duckdb"


# 1. Happy path


def test_first_publication_when_final_does_not_exist(paths):
    build, final = paths
    make_warehouse(build, N_NEW)

    assert publish_warehouse(build, final) == final

    assert count_rows(final) == N_NEW
    assert not build.exists()
    assert not wal(build).exists() and not wal(final).exists()


def test_publication_replaces_previous_final(paths):
    build, final = paths
    make_warehouse(final, N_OLD)
    make_warehouse(build, N_NEW)

    publish_warehouse(build, final)

    assert count_rows(final) == N_NEW
    assert not build.exists()
    assert not wal(build).exists() and not wal(final).exists()


def test_final_is_replaced_never_written_in_place(paths):
    build, final = paths
    make_warehouse(final, N_OLD)
    make_warehouse(build, N_NEW)
    old_digest = digest(final)
    fd = os.open(final, os.O_RDONLY)
    try:
        publish_warehouse(build, final)
        assert_replaced_not_written_in_place(fd, old_digest, final)
    finally:
        os.close(fd)


@pytest.mark.skipif(os.name == "nt", reason="POSIX permission bits")
def test_published_file_is_readable_by_other_users_whatever_the_umask(paths):
    build, final = paths
    previous_umask = os.umask(0o077)
    try:
        make_warehouse(build, N_OLD)
        # Sanity: under umask 077 the build file is private, so the test proves something.
        assert stat.S_IMODE(os.stat(build).st_mode) & 0o077 == 0
        publish_warehouse(build, final)
    finally:
        os.umask(previous_umask)

    mode = stat.S_IMODE(os.stat(final).st_mode)
    assert mode & (stat.S_IRGRP | stat.S_IROTH) == stat.S_IRGRP | stat.S_IROTH, oct(mode)
    assert mode == PUBLISHED_MODE == 0o644, oct(mode)


def test_accepts_str_paths(paths):
    build, final = paths
    make_warehouse(build, N_OLD)
    publish_warehouse(str(build), str(final))
    assert count_rows(final) == N_OLD


# 2. Refusals leave the previous final intact


def _missing_build(build, final):
    return build, final


def _wal_left_behind(build, final):
    make_warehouse(build, N_NEW)
    wal(build).write_bytes(b"unclean close")
    return build, final


def _missing_table(build, final):
    make_warehouse(build, N_NEW, tables=[t for t in DEFAULT_EXPECTED_TABLES if t != "fact_gdelt_event"])
    return build, final


def _same_file(build, final):
    return final, final


def _same_file_other_spelling(build, final):
    return final.parent / "." / final.name, final


def _other_directory(build, final):
    other = final.parent / "elsewhere" / build.name
    other.parent.mkdir()
    make_warehouse(other, N_NEW)
    return other, final


def _not_a_duckdb_file(build, final):
    build.write_bytes(b"not a database")
    return build, final


@pytest.mark.parametrize(
    ("setup", "message"),
    [
        (_missing_build, "missing"),
        (_wal_left_behind, ".wal"),
        (_missing_table, "fact_gdelt_event"),
        (_same_file, "same file"),
        (_same_file_other_spelling, "same file"),
        (_other_directory, "same directory"),
        (_not_a_duckdb_file, "cannot open"),
    ],
    ids=lambda value: getattr(value, "__name__", value).lstrip("_") if callable(value) else None,
)
def test_refusal_leaves_previous_final_intact(paths, setup, message):
    build, final = paths
    make_warehouse(final, N_OLD)
    before = digest(final)
    build, target = setup(build, final)
    build_existed = build.exists()
    build_before = digest(build) if build_existed else None

    with pytest.raises(PublicationError, match=message):
        publish_warehouse(build, target)

    assert digest(final) == before
    assert count_rows(final) == N_OLD
    assert not wal(final).exists()
    # The build file stays for inspection, unchanged.
    assert build.exists() == build_existed
    if build_existed:
        assert digest(build) == build_before


def test_wal_refusal_keeps_the_wal_for_inspection(paths):
    build, final = paths
    _wal_left_behind(build, final)
    with pytest.raises(PublicationError):
        publish_warehouse(build, final)
    assert wal(build).read_bytes() == b"unclean close"


# 3. prepare_build_path


def test_prepare_build_path_deletes_stale_build_and_wal(paths):
    build, final = paths
    make_warehouse(build, N_OLD)
    wal(build).write_bytes(b"stale")
    make_warehouse(final, N_OLD)

    assert prepare_build_path(build, final_path=final) == build

    assert not build.exists() and not wal(build).exists()
    assert count_rows(final) == N_OLD


def test_prepare_build_path_without_stale_files(paths):
    build, _ = paths
    assert prepare_build_path(str(build)) == build
    assert not build.exists()


def test_prepared_path_starts_an_empty_database(paths):
    build, _ = paths
    make_warehouse(build, N_OLD)
    with duckdb.connect(str(build)) as connection:
        connection.execute("CREATE TABLE stg_leftover AS SELECT 1 AS x")

    prepare_build_path(build)

    with duckdb.connect(str(build)) as connection:
        assert connection.execute("SELECT count(*) FROM duckdb_tables()").fetchone()[0] == 0


@pytest.mark.parametrize("spelling", ["same", "dotted", "symlink"])
def test_prepare_build_path_refuses_to_delete_the_published_warehouse(paths, spelling):
    _, final = paths
    make_warehouse(final, N_OLD)
    before = digest(final)
    if spelling == "same":
        build = final
    elif spelling == "dotted":
        build = final.parent / "." / final.name
    else:
        build = final.parent / "warehouse_build.duckdb"
        try:
            build.symlink_to(final)
        except OSError:
            pytest.skip("symlinks are not available on this platform")

    with pytest.raises(PublicationError, match="refusing to delete"):
        prepare_build_path(build, final_path=final)

    assert digest(final) == before
    assert build.exists()


# 4. Acceptance criterion: concurrent reader and writer processes


def test_reader_never_sees_an_incomplete_warehouse(paths):
    build, final = paths
    make_warehouse(final, N_OLD)
    old_digest = digest(final)
    old_fd = os.open(final, os.O_RDONLY)

    ready, stop, go, published = SPAWN.Event(), SPAWN.Event(), SPAWN.Event(), SPAWN.Event()
    results = SPAWN.Queue()
    reader = SPAWN.Process(target=_reader, args=(str(final), ready, stop, results, N_NEW))
    writer = SPAWN.Process(target=_writer, args=(str(build), str(final), N_NEW, go, published))
    processes = [reader, writer]
    try:
        reader.start()
        writer.start()
        assert ready.wait(READER_DEADLINE_S), "reader did not start"
        go.set()
        assert published.wait(READER_DEADLINE_S), f"writer did not publish (exit code {writer.exitcode})"
        stop.set()
        try:
            outcome = results.get(timeout=READER_DEADLINE_S + 2)
        except queue.Empty:
            pytest.fail(f"reader reported nothing (exit code {reader.exitcode})")
        reader.join(5)
        writer.join(5)
        assert_replaced_not_written_in_place(old_fd, old_digest, final)
    finally:
        _stop_processes(processes)
        os.close(old_fd)

    assert writer.exitcode == 0
    assert reader.exitcode == 0
    assert outcome["n_errors"] == 0, outcome["errors"]
    assert set(outcome["counts"]) <= {N_OLD, N_NEW}, outcome["counts"]
    assert outcome["counts"].get(N_OLD, 0) > 0, "reader never read the previous warehouse"
    assert outcome["counts"].get(N_NEW, 0) >= NEW_READS_AFTER_PUBLISH, outcome["counts"]
    assert not build.exists()
    assert count_rows(final) == N_NEW


# 5. Connections opened before and after publication


def test_connection_opened_before_publication_keeps_old_data(paths):
    build, final = paths
    make_warehouse(final, N_OLD)
    make_warehouse(build, N_NEW)

    old = duckdb.connect(str(final), read_only=True)
    try:
        assert old.execute("SELECT count(*) FROM fact_visit").fetchone()[0] == N_OLD
        publish_warehouse(build, final)
        assert old.execute("SELECT count(*) FROM fact_visit").fetchone()[0] == N_OLD

        # A new connection in another process sees the new data.
        results = SPAWN.Queue()
        child = SPAWN.Process(target=_count_in_child, args=(str(final), results))
        try:
            child.start()
            assert results.get(timeout=10) == N_NEW
            child.join(5)
        finally:
            _stop_processes([child])
        assert child.exitcode == 0

        # In this process DuckDB reuses the cached instance while a connection is
        # still open, so a new connection still sees the old file. This is why
        # readers must not keep long-lived connections (see the module docstring).
        with duckdb.connect(str(final), read_only=True) as same_process:
            assert same_process.execute("SELECT count(*) FROM fact_visit").fetchone()[0] == N_OLD
    finally:
        old.close()

    # Once every connection is closed, a new one in this process sees the new data.
    assert count_rows(final) == N_NEW
    assert not os.path.exists(build)
