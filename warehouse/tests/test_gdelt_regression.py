"""GDELT non-regression set (P2-08): real rows, frozen, with their expected result.

Run from the repository root:

    pytest warehouse/tests/test_gdelt_regression.py

Requires: duckdb, psutil, pytest.

fixtures/gdelt_regression/regression.export.CSV.zip holds 29 real GDELT lines of the spike week (raw text, untouched),
one or more per difficult case; cases.csv says why each line is there and whether the rules keep it.
The full chain runs on them: raw load, staging rules (gdelt.sql), quality gate.

Changing a rule on purpose: run once with UPDATE_GOLDEN=1, then review the diff of expected_stg_gdelt_event.csv
(and of cases.csv if a case changes side) in the PR. That diff is the effect of the change.
"""

import csv
import io
import os
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "warehouse" / "staging"))
sys.path.insert(0, str(ROOT / "warehouse" / "quality_gate"))
import load_gdelt_raw as loader  # noqa: E402
import quarantine as gate  # noqa: E402

FIXTURES = Path(__file__).with_name("fixtures") / "gdelt_regression"
ARCHIVE = FIXTURES / "regression.export.CSV.zip"
CASES = FIXTURES / "cases.csv"
GOLDEN = FIXTURES / "expected_stg_gdelt_event.csv"


def run_chain(tmp_path):
    connection = duckdb.connect()
    loader.create_schema(connection)
    loader.load_archive(connection, ARCHIVE, tmp_path)
    connection.execute((ROOT / "warehouse" / "staging" / "gdelt.sql").read_text())
    gate.run(connection)
    return connection


def as_csv(connection):
    cursor = connection.execute("SELECT * EXCLUDE (source_file) FROM stg_gdelt_event ORDER BY gdelt_event_id")
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow([column[0] for column in cursor.description])
    writer.writerows(cursor.fetchall())
    return buffer.getvalue()


def test_each_case_is_kept_or_dropped_as_expected(tmp_path):
    connection = run_chain(tmp_path)
    assert connection.execute("SELECT count(*) FROM stg_gdelt_raw").fetchone()[0] == 29
    assert connection.execute("SELECT count(*) FROM stg_gdelt_raw_rejects").fetchone()[0] == 0

    with CASES.open() as stream:
        cases = list(csv.DictReader(stream))
    expected_kept = {int(c["gdelt_event_id"]) for c in cases if c["expected"] == "kept"}
    kept = {row[0] for row in connection.execute("SELECT gdelt_event_id FROM stg_gdelt_event").fetchall()}
    wrong = [f"{c['gdelt_event_id']} ({c['case']}): expected {c['expected']}"
             for c in cases if (int(c["gdelt_event_id"]) in kept) != (c["expected"] == "kept")]
    assert not wrong, "\n".join(wrong)
    assert kept == expected_kept


def test_output_matches_the_frozen_result(tmp_path):
    actual = as_csv(run_chain(tmp_path))
    if os.environ.get("UPDATE_GOLDEN"):
        GOLDEN.write_text(actual)
    assert actual == GOLDEN.read_text(), "stg_gdelt_event changed: rerun with UPDATE_GOLDEN=1 and review the diff"
