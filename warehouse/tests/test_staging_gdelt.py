"""Tests for the GDELT staging rules (warehouse/staging/gdelt.sql).

Run from the repository root:

    pytest warehouse/tests/test_staging_gdelt.py

Requires: duckdb, psutil, pytest.

One kept event, then one event per rule that must be dropped for that reason only.
"""

import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "warehouse" / "staging"))
import load_gdelt_raw as loader  # noqa: E402

GDELT_SQL = ROOT / "warehouse" / "staging" / "gdelt.sql"

KEPT = dict(
    GlobalEventID=1, Day=20250110, DATEADDED=20250110120000,
    Actor1CountryCode="FRA", Actor2CountryCode="DEU", EventCode="042", EventRootCode="04",
    QuadClass=1, GoldsteinScale=1.9, AvgTone=-1.5, NumMentions=4, IsRootEvent=1,
    SOURCEURL="http://a", source_file="f.zip",
)
CASES = {
    2: dict(Actor2CountryCode=None),                       # R1 missing country
    3: dict(Actor2CountryCode="EUR"),                      # R1 region code
    4: dict(Actor2CountryCode="FRA"),                      # R1 same country
    5: dict(Day=20241216, DATEADDED=20241216120000),       # R2 before the period
    6: dict(Day=20250716, DATEADDED=20250716120000),       # R2 after the period
    7: dict(DATEADDED=20250210120000),                     # R2 reported 31 days late
    8: dict(NumMentions=1),                                # R3 single mention
    9: dict(DATEADDED=20250110121500),                     # R4 same action, pair, article, reported later
    10: dict(Actor1CountryCode="DEU", Actor2CountryCode="FRA"),  # kept: other direction
    11: dict(SOURCEURL="http://b"),                        # kept: other article
    12: dict(DATEADDED=20250209120000, SOURCEURL="http://c"),  # kept: exactly 30 days late (R2 boundary)
}


def test_rules_keep_and_drop_the_right_events():
    connection = duckdb.connect()
    loader.create_schema(connection)
    rows = [KEPT] + [{**KEPT, "GlobalEventID": event_id, **change} for event_id, change in CASES.items()]
    columns = list(KEPT)
    connection.executemany(
        f"INSERT INTO stg_gdelt_raw ({', '.join(columns)}) VALUES ({', '.join('?' * len(columns))})",
        [[row[c] for c in columns] for row in rows],
    )

    connection.execute(GDELT_SQL.read_text())

    kept = [r[0] for r in connection.execute(
        "SELECT gdelt_event_id FROM stg_gdelt_event ORDER BY 1").fetchall()]
    assert kept == [1, 10, 11, 12]
