"""Tests for the load of fact_visit (warehouse/dimensions_and_facts/build_facts.py).

Run from the repository root:

    pytest warehouse/tests/test_fact_visit.py

Requires: duckdb, pytest.

Leader Q1 holds two offices (two dim_leader versions, the second for another country). Each visit must point
to the version valid on its first day, take its visitor country from that version, and be matched in GDELT
only by a 042/043 event of the same pair during the visit. One broken visit per P4 rule must be quarantined.
"""

import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "warehouse" / "dimensions_and_facts"))
import build_facts  # noqa: E402

SEED = """
INSERT INTO dim_country (country_key, country_name, iso3_code, fips_code, cameo_code, region) VALUES
    (1, 'France', 'FRA', 'FR', 'FRA', 'Europe'), (2, 'Japan', 'JPN', 'JA', 'JPN', 'Asia'),
    (3, 'Germany', 'DEU', 'GM', 'DEU', 'Europe');
INSERT INTO dim_visit_type VALUES (1, 'state'), (2, 'unknown');
INSERT INTO dim_date
SELECT CAST(d AS DATE), year(d), month(d), week(d), day(d)
FROM generate_series(DATE '2024-12-17', DATE '2025-07-15', INTERVAL 1 DAY) AS t(d);
-- Q1: President of France until 2025-03-31, then Chancellor of Germany.
INSERT INTO dim_leader VALUES
    (10, 'Q1', 'Leader A', 'President',  1, DATE '2020-01-01', DATE '2025-03-31'),
    (11, 'Q1', 'Leader A', 'Chancellor', 3, DATE '2025-04-01', NULL);
CREATE TABLE stg_gdelt_event (event_date DATE, actor1_country_code VARCHAR, actor2_country_code VARCHAR,
                              event_code VARCHAR);
INSERT INTO stg_gdelt_event VALUES
    (DATE '2025-03-31', 'JPN', 'FRA', '043'),   -- matches visit 2 (reversed pair, last day)
    (DATE '2025-04-03', 'DEU', 'JPN', '040'),   -- not a visit code
    (DATE '2025-04-05', 'DEU', 'JPN', '042');   -- the day after visit 3
CREATE TABLE stg_visit (leader_id VARCHAR, host_country_iso3 VARCHAR, start_date DATE, end_date DATE,
                        visit_type_label VARCHAR, is_multilateral BOOLEAN,
                        wiki_page_id BIGINT, wiki_revision_id BIGINT);
INSERT INTO stg_visit VALUES
    -- valid
    ('Q1', 'JPN', DATE '2025-02-10', DATE '2025-02-12', 'state',    FALSE, 100, 1),
    ('Q1', 'JPN', DATE '2025-03-31', DATE '2025-04-01', 'official', FALSE, 100, 1),  -- last day of version 10
    ('Q1', 'JPN', DATE '2025-04-01', DATE '2025-04-04', 'state',    TRUE,  100, 2),  -- first day of version 11
    -- one broken row per rule
    ('Q9', 'JPN', DATE '2025-02-10', DATE '2025-02-11', 'state', FALSE, 100, 1),     -- visit_01
    ('Q1', 'XXX', DATE '2025-02-10', DATE '2025-02-11', 'state', FALSE, 100, 1),     -- visit_02
    ('Q1', 'FRA', DATE '2025-02-10', DATE '2025-02-11', 'state', FALSE, 100, 1),     -- visit_03
    ('Q1', 'DEU', DATE '2025-02-12', DATE '2025-02-10', 'state', FALSE, 100, 1),     -- visit_04
    ('Q1', 'JPN', DATE '2025-06-29', DATE '2025-07-20', 'state', FALSE, 100, 1),     -- visit_05
    ('Q1', 'DEU', DATE '2025-01-20', DATE '2025-01-21', 'state', NULL,  100, 1),     -- visit_06
    ('Q1', 'JPN', DATE '2025-02-10', DATE '2025-02-12', 'state', FALSE, 100, 0);     -- visit_07 (older revision)
"""


def build():
    connection = duckdb.connect()
    connection.execute((ROOT / "warehouse" / "dimensions_and_facts" / "schema.sql").read_text())
    connection.execute(SEED)
    build_facts.build_fact_visit(connection)
    return connection


def test_each_visit_points_to_the_leader_version_valid_on_its_first_day():
    rows = build().execute(
        """
        SELECT visit_key, start_date_key::VARCHAR, leader_key, visitor_country_key, visit_type_key,
               duration_days, matched_in_gdelt, pre_window_start::VARCHAR, post_window_end::VARCHAR
        FROM fact_visit ORDER BY visit_key
        """
    ).fetchall()
    assert rows == [
        (1, "2025-02-10", 10, 1, 1, 3, False, "2025-01-26", "2025-02-27"),
        (2, "2025-03-31", 10, 1, 2, 2, True,  "2025-03-16", "2025-04-16"),
        (3, "2025-04-01", 11, 3, 1, 4, False, "2025-03-17", "2025-04-19"),
    ]


def test_each_broken_visit_is_quarantined_under_its_rule():
    connection = build()
    quarantined = dict(connection.execute(
        "SELECT rule_id, count(*) FROM quality_quarantine GROUP BY 1").fetchall())
    assert quarantined == {f"visit_0{i}_{name}": 1 for i, name in enumerate(
        ["leader_unknown", "host_unknown", "same_country", "dates_invalid", "out_of_scope",
         "field_missing", "duplicate"], start=1)}
    # The duplicate kept is the latest revision.
    assert connection.execute(
        "SELECT row_data->>'wiki_revision_id' FROM quality_quarantine WHERE rule_id = 'visit_07_duplicate'"
    ).fetchone()[0] == "0"


def test_rebuild_gives_the_same_table():
    connection = build()
    before = connection.execute("SELECT * FROM fact_visit ORDER BY visit_key").fetchall()
    build_facts.build_fact_visit(connection)
    assert connection.execute("SELECT * FROM fact_visit ORDER BY visit_key").fetchall() == before


# C-04 sample: sample_datasets/fact_visit.csv holds candidate rows (the shape of stg_fact_visit, what the quality
# gate sees). Its keys refer to the dimension rows below, until P3 publishes the samples of the dimensions.
SAMPLE_CSV = ROOT / "sample_datasets" / "fact_visit.csv"
SAMPLE_DIMENSIONS = """
INSERT INTO dim_country (country_key, country_name, iso3_code, fips_code, cameo_code, region) VALUES
    (1, 'France', 'FRA', 'FR', 'FRA', NULL), (2, 'Germany', 'DEU', 'GM', 'DEU', NULL),
    (3, 'Japan', 'JPN', 'JA', 'JPN', NULL), (4, 'United States', 'USA', 'US', 'USA', NULL),
    (5, 'Brazil', 'BRA', 'BR', 'BRA', NULL), (6, 'India', 'IND', 'IN', 'IND', NULL),
    (7, 'China', 'CHN', 'CH', 'CHN', NULL), (8, 'Italy', 'ITA', 'IT', 'ITA', NULL);
INSERT INTO dim_visit_type VALUES (1, 'state'), (2, 'working'), (3, 'summit'), (4, 'ceremony'), (5, 'unknown');
INSERT INTO dim_leader VALUES
    (1, 'Q100001', 'Sample Leader A', 'President', 1, DATE '2022-05-14', NULL),
    (2, 'Q100002', 'Sample Leader B', 'Chancellor', 2, DATE '2021-12-08', NULL),
    (3, 'Q100003', 'Sample Leader C', 'Prime Minister', 3, DATE '2024-10-01', NULL),
    (4, 'Q100004', 'Sample Leader D', 'President', 4, DATE '2025-01-20', NULL);
INSERT INTO dim_date
SELECT CAST(d AS DATE), year(d), month(d), week(d), day(d)
FROM generate_series(DATE '2024-12-17', DATE '2025-07-15', INTERVAL 1 DAY) AS t(d);
"""
# wiki_page_id of each invalid row -> the rule that must quarantine it.
SAMPLE_INVALID = {
    9901: "visit_01_leader_unknown", 9902: "visit_02_host_unknown", 9903: "visit_03_same_country",
    9904: "visit_04_dates_invalid", 9905: "visit_05_out_of_scope", 9906: "visit_06_field_missing",
    9907: "visit_07_duplicate",
}


def test_c04_sample_valid_rows_load_and_each_invalid_row_is_quarantined():
    connection = duckdb.connect()
    connection.execute((ROOT / "warehouse" / "dimensions_and_facts" / "schema.sql").read_text())
    connection.execute(SAMPLE_DIMENSIONS)
    connection.execute(
        f"""
        CREATE TABLE stg_fact_visit AS SELECT * FROM read_csv('{SAMPLE_CSV.as_posix()}', header = true, columns = {{
            'leader_id': 'VARCHAR', 'host_country_iso3': 'VARCHAR', 'leader_key': 'INTEGER',
            'visitor_country_key': 'INTEGER', 'host_country_key': 'INTEGER', 'visit_type_key': 'INTEGER',
            'start_date_key': 'DATE', 'end_date_key': 'DATE', 'duration_days': 'INTEGER',
            'is_multilateral': 'BOOLEAN', 'matched_in_gdelt': 'BOOLEAN', 'wiki_page_id': 'BIGINT',
            'wiki_revision_id': 'BIGINT', 'pre_window_start': 'DATE', 'pre_window_end': 'DATE',
            'post_window_start': 'DATE', 'post_window_end': 'DATE'}})
        """
    )
    total = connection.execute("SELECT count(*) FROM stg_fact_visit").fetchone()[0]
    assert 20 <= total <= 50  # C-04: 20 to 50 rows, some of them invalid

    # The valid rows pass every constraint of fact_visit (its contract, checked by the DDL).
    loaded = build_facts.load_fact_visit(connection)
    assert loaded == total - len(SAMPLE_INVALID)

    quarantined = dict(connection.execute(
        "SELECT (row_data->>'wiki_page_id')::BIGINT, rule_id FROM quality_quarantine").fetchall())
    assert quarantined == SAMPLE_INVALID
    # The duplicate kept is the latest revision of the page.
    assert connection.execute(
        "SELECT wiki_revision_id FROM fact_visit WHERE wiki_page_id = 9009").fetchone()[0] == 100009
