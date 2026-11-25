"""Tests for the quality gate (warehouse/quality_gate/).

Run from the repository root:

    pytest warehouse/tests/test_quality_gate.py

Requires: duckdb, psutil, pytest.

One valid GDELT event goes through staging, then one copy per GDELT rule is broken in exactly one way.
The gate must keep the valid row, quarantine each broken one under its own rule, log every rule,
do nothing more on a second run, and expose the coverage indicators.
"""

import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "warehouse" / "staging"))
sys.path.insert(0, str(ROOT / "warehouse" / "quality_gate"))
import load_gdelt_raw as loader  # noqa: E402
import quarantine as gate  # noqa: E402

VALID = dict(
    GlobalEventID=1, Day=20250110, DATEADDED=20250110120000,
    Actor1CountryCode="FRA", Actor2CountryCode="DEU", EventCode="042", EventRootCode="04",
    QuadClass=1, GoldsteinScale=1.9, AvgTone=-1.5, NumMentions=4, IsRootEvent=1,
    SOURCEURL="http://a", source_file="f.zip",
)
BROKEN = {  # id -> (rule expected, column replacements)
    2: ("gdelt_02_id_duplicate", "1 AS gdelt_event_id, TIMESTAMP '2025-01-10 12:15:00' AS date_added"),
    3: ("gdelt_03_date_out_of_range", "DATE '2025-08-01' AS event_date"),
    4: ("gdelt_04_country_invalid", "'FR' AS actor2_country_code"),
    5: ("gdelt_05_event_code_invalid", "'190' AS event_code"),
    6: ("gdelt_06_quad_class_invalid", "5 AS quad_class"),
    7: ("gdelt_07_goldstein_invalid", "15.0 AS goldstein_scale"),
    8: ("gdelt_08_tone_invalid", "NULL AS avg_tone"),
    9: ("gdelt_09_mentions_invalid", "-1 AS num_mentions"),
}


def build(connection):
    loader.create_schema(connection)
    columns = list(VALID)
    connection.execute(
        f"INSERT INTO stg_gdelt_raw ({', '.join(columns)}) VALUES ({', '.join('?' * len(columns))})",
        [VALID[c] for c in columns],
    )
    connection.execute((ROOT / "warehouse" / "staging" / "gdelt.sql").read_text())
    for event_id, (_, replace) in BROKEN.items():
        if "AS gdelt_event_id" not in replace:
            replace = f"{event_id} AS gdelt_event_id, {replace}"
        connection.execute(f"INSERT INTO stg_gdelt_event SELECT * REPLACE ({replace}) FROM stg_gdelt_event WHERE gdelt_event_id = 1 LIMIT 1")


def test_gate_quarantines_each_invalid_row_with_its_rule():
    connection = duckdb.connect()
    build(connection)

    results = gate.run(connection)

    kept = connection.execute("SELECT gdelt_event_id, date_added FROM stg_gdelt_event").fetchall()
    assert [row[0] for row in kept] == [1] and str(kept[0][1]) == "2025-01-10 12:00:00"

    quarantined = dict(connection.execute(
        "SELECT rule_id, count(*) FROM quality_quarantine GROUP BY 1").fetchall())
    assert quarantined == {rule: 1 for rule, _ in BROKEN.values()}
    assert connection.execute(
        "SELECT count(*) FROM quality_quarantine WHERE reason = '' OR row_data IS NULL").fetchone()[0] == 0

    statuses = {r["rule_id"]: r["status"] for r in results}
    assert statuses["gdelt_01_id_missing"] == "passed"
    assert all(statuses[rule] == "failed" for rule, _ in BROKEN.values())
    assert connection.execute("SELECT count(*) FROM v_quality_last_run").fetchone()[0] == len(results)

    # Second run: nothing left to quarantine.
    again = gate.run(connection, ["stg_gdelt_event"])
    assert all(r["status"] == "passed" for r in again)
    assert connection.execute("SELECT count(*) FROM quality_quarantine").fetchone()[0] == len(BROKEN)

    # Coverage indicators.
    daily = connection.execute(
        "SELECT raw_events, kept_events FROM v_quality_gdelt_daily WHERE event_date = DATE '2025-01-10'").fetchall()
    assert daily == [(1, 1)]
    countries = dict(connection.execute("SELECT country_code, events FROM v_quality_gdelt_country").fetchall())
    assert countries == {"FRA": 1, "DEU": 1}


def test_rule_on_missing_table_is_logged_not_fatal():
    connection = duckdb.connect()
    results = gate.run(connection)
    assert {r["status"] for r in results} == {"table_missing"}
