"""Tests for the raw GDELT loader (warehouse/staging/load_gdelt_raw.py).

Run from the repository root:

    pytest warehouse/tests/test_load_gdelt_raw.py

Requires: duckdb, psutil, pytest.

What is tested, on a synthetic archive with 2 good rows and 2 bad ones:
1. Loading the same files twice gives the same rows (no duplicates).
2. Every row records the archive it came from (source_file).
3. Unreadable lines land in stg_gdelt_raw_rejects with a reason.
"""

import sys
import zipfile
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "warehouse" / "staging"))
import load_gdelt_raw as loader  # noqa: E402

GOOD = ["1", "20241217", "202412", "2024", "2024.9562"] + [""] * 54 + ["20241217000000", "http://a"]
ARCHIVE = "20241217000000.export.CSV.zip"


def make_archive(directory: Path) -> Path:
    good2 = ["2"] + GOOD[1:]
    truncated = GOOD[:30]
    bad_id = ["not_a_number"] + GOOD[1:]
    lines = ["\t".join(row) for row in (GOOD, truncated, bad_id, good2)]
    day = directory / "2024-12-17"
    day.mkdir(parents=True)
    path = day / ARCHIVE
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("20241217000000.export.CSV", "\n".join(lines) + "\n")
    return path


def load(connection, archive, tmp_path):
    return loader.load_archive(connection, archive, tmp_path)


def test_reload_is_idempotent_with_lineage_and_rejects(tmp_path):
    archive = make_archive(tmp_path / "raw")
    connection = duckdb.connect(str(tmp_path / "db.duckdb"))
    loader.create_schema(connection)

    first = load(connection, archive, tmp_path)
    second = load(connection, archive, tmp_path)

    rows = connection.execute(
        "SELECT GlobalEventID, source_file FROM stg_gdelt_raw ORDER BY 1"
    ).fetchall()
    assert rows == [(1, ARCHIVE), (2, ARCHIVE)]
    assert first == second == {
        "file": ARCHIVE, "raw_rows": 4, "loaded_rows": 2, "read_errors": 2,
    }

    rejects = connection.execute(
        "SELECT file_name, reject_line FROM stg_gdelt_raw_rejects ORDER BY 2"
    ).fetchall()
    assert rejects == [(ARCHIVE, 2), (ARCHIVE, 3)]
    reasons = connection.execute("SELECT reject_reason FROM stg_gdelt_raw_rejects").fetchall()
    assert all(reason[0] for reason in reasons)
