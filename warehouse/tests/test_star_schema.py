"""Tests for the star schema DDL and the table contracts.

Run from the repository root:

    pytest warehouse/tests/test_star_schema.py

Requires: duckdb, pyyaml, pytest.

What is tested:
1. schema.sql runs, and can run twice (full rebuild).
2. The structural queries of test_star_schema.sql return no row.
3. Every table contract in table_contracts/ (type: table) matches the DDL:
   columns, order, types, nullability, primary key and foreign keys.
4. A valid chain of rows loads.
5. Each business rule enforced by the DDL rejects a bad row.
"""

import re
from pathlib import Path

import duckdb
import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_SQL = ROOT / "warehouse" / "dimensions_and_facts" / "schema.sql"
STRUCTURE_SQL = Path(__file__).with_name("test_star_schema.sql")
CONTRACTS_DIR = ROOT / "table_contracts"

TABLES = {
    "dim_country",
    "dim_date",
    "dim_event_type",
    "dim_leader",
    "dim_visit_type",
    "fact_visit",
    "fact_gdelt_event",
}


@pytest.fixture
def con():
    connection = duckdb.connect(":memory:")
    connection.execute(SCHEMA_SQL.read_text())
    yield connection
    connection.close()


def seed(con):
    """Minimal valid dimension rows."""
    con.execute(
        """
        INSERT INTO dim_country (country_key, country_name, region, iso3_code, fips_code, cameo_code) VALUES
            (1, 'France',  'Europe', 'FRA', 'FR', 'FRA'),
            (2, 'Japan',   'Asia',   'JPN', 'JA', 'JPN'),
            (3, 'Germany', 'Europe', 'DEU', 'GM', 'DEU')
        """
    )
    con.execute("INSERT INTO dim_visit_type VALUES (1, 'state'), (2, 'unknown')")
    con.execute(
        """
        INSERT INTO dim_event_type VALUES
            (1, '042', '04', 1, TRUE),
            (2, '190', '19', 4, FALSE)
        """
    )
    con.execute(
        "INSERT INTO dim_leader VALUES (1, 'Q1', 'Leader A', 'President', 1, DATE '2024-01-01', NULL)"
    )
    con.execute(
        """
        INSERT INTO dim_date
        SELECT CAST(d AS DATE), year(d), month(d), week(d), day(d)
        FROM generate_series(DATE '2024-12-17', DATE '2025-09-30', INTERVAL 1 DAY) AS t(d)
        """
    )


VALID_VISIT = (
    "INSERT INTO fact_visit VALUES (1, 1, 1, 2, 1, DATE '2025-03-10', DATE '2025-03-12', 3, "
    "FALSE, TRUE, 100, 200, DATE '2025-02-23', DATE '2025-03-09', DATE '2025-03-13', DATE '2025-03-27')"
)
VALID_EVENT = (
    "INSERT INTO fact_gdelt_event VALUES (1001, DATE '2025-03-11', 1, 2, 1, 'http://example.org/a', 3.5, -1.2, 10)"
)


# 1. The script itself


def test_schema_can_be_rebuilt(con):
    con.execute(SCHEMA_SQL.read_text())
    count = con.execute("SELECT count(*) FROM duckdb_tables() WHERE schema_name = 'main'").fetchone()[0]
    assert count == len(TABLES)


# 2. Structural queries


def _structure_tests():
    text = STRUCTURE_SQL.read_text()
    parts = re.split(r"/\*\s*test:\s*(\w+)\s*\*/", text)
    return [(parts[i], parts[i + 1].strip()) for i in range(1, len(parts) - 1, 2)]


@pytest.mark.parametrize("name,sql", _structure_tests(), ids=lambda v: v if len(v) < 60 else "sql")
def test_structure_query_returns_no_violation(con, name, sql):
    rows = con.execute(sql).fetchall()
    assert rows == [], f"{name}: {rows}"


# 3. Contracts match the DDL


def _table_contracts():
    contracts = []
    for path in sorted(CONTRACTS_DIR.glob("*.yml")):
        data = yaml.safe_load(path.read_text())
        if data and data.get("type") == "table":
            contracts.append(data)
    return contracts


def test_every_table_has_a_contract():
    assert {c["name"] for c in _table_contracts()} == TABLES


@pytest.mark.parametrize("contract", _table_contracts(), ids=lambda c: c["name"])
def test_contract_matches_ddl(con, contract):
    table = contract["name"]
    actual = con.execute(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
        "WHERE table_schema = 'main' AND table_name = ? ORDER BY ordinal_position",
        [table],
    ).fetchall()
    expected = [
        (c["name"], c["type"], "YES" if c["nullable"] else "NO") for c in contract["columns"]
    ]
    assert actual == expected

    pk = con.execute(
        "SELECT constraint_column_names FROM duckdb_constraints() "
        "WHERE table_name = ? AND constraint_type = 'PRIMARY KEY'",
        [table],
    ).fetchall()
    assert [list(row[0]) for row in pk] == [contract["primary_key"]]

    actual_fks = {
        (row[0][0], f"{row[1]}.{row[2][0]}")
        for row in con.execute(
            "SELECT constraint_column_names, referenced_table, referenced_column_names "
            "FROM duckdb_constraints() WHERE table_name = ? AND constraint_type = 'FOREIGN KEY'",
            [table],
        ).fetchall()
    }
    expected_fks = {(c["name"], c["foreign_key"]) for c in contract["columns"] if c.get("foreign_key")}
    assert actual_fks == expected_fks


# 4. A valid chain loads


def test_valid_rows_load(con):
    seed(con)
    con.execute(VALID_VISIT)
    con.execute(VALID_EVENT)
    assert con.execute("SELECT count(*) FROM fact_visit").fetchone()[0] == 1
    assert con.execute("SELECT count(*) FROM fact_gdelt_event").fetchone()[0] == 1


# 5. Business rules enforced by the DDL

BAD_ROWS = {
    "country_iso3_wrong_length": "INSERT INTO dim_country (country_key, country_name, region, iso3_code, fips_code, cameo_code) VALUES (9, 'X', NULL, 'FR', NULL, NULL)",
    "country_duplicate_iso3": "INSERT INTO dim_country (country_key, country_name, region, iso3_code, fips_code, cameo_code) VALUES (9, 'X', NULL, 'FRA', NULL, NULL)",
    "event_type_bad_quad_class": "INSERT INTO dim_event_type VALUES (9, '050', '05', 5, FALSE)",
    "event_type_cooperative_flag_inconsistent": "INSERT INTO dim_event_type VALUES (9, '010', '01', 1, FALSE)",
    "event_type_root_out_of_range": "INSERT INTO dim_event_type VALUES (9, '2501', '25', 1, TRUE)",
    "event_type_code_does_not_start_with_root": "INSERT INTO dim_event_type VALUES (9, '050', '04', 1, TRUE)",
    "visit_type_not_in_closed_list": "INSERT INTO dim_visit_type VALUES (9, 'official')",
    "leader_valid_to_before_valid_from": (
        "INSERT INTO dim_leader VALUES (9, 'Q9', 'B', NULL, 1, DATE '2025-01-02', DATE '2025-01-01')"
    ),
    "leader_duplicate_version": (
        "INSERT INTO dim_leader VALUES (9, 'Q1', 'A again', NULL, 1, DATE '2024-01-01', NULL)"
    ),
    "leader_unknown_country": (
        "INSERT INTO dim_leader VALUES (9, 'Q9', 'B', NULL, 99, DATE '2025-01-01', NULL)"
    ),
    "visit_unknown_leader": VALID_VISIT.replace("VALUES (1, 1, 1, 2", "VALUES (2, 99, 1, 2"),
    "visit_duplicate_key": VALID_VISIT,
    "visit_same_visitor_and_host": VALID_VISIT.replace("VALUES (1, 1, 1, 2", "VALUES (2, 1, 1, 1"),
    "visit_end_before_start": (
        "INSERT INTO fact_visit VALUES (2, 1, 1, 2, 1, DATE '2025-03-12', DATE '2025-03-10', 3, "
        "FALSE, TRUE, 100, 200, DATE '2025-02-25', DATE '2025-03-11', DATE '2025-03-11', DATE '2025-03-25')"
    ),
    "visit_wrong_duration": VALID_VISIT.replace("VALUES (1, 1, 1, 2, 1, DATE '2025-03-10', DATE '2025-03-12', 3", "VALUES (2, 1, 1, 2, 1, DATE '2025-03-10', DATE '2025-03-12', 5"),
    "visit_pre_window_wrong": VALID_VISIT.replace("VALUES (1,", "VALUES (2,").replace("DATE '2025-02-23'", "DATE '2025-02-24'"),
    "visit_post_window_wrong": VALID_VISIT.replace("VALUES (1,", "VALUES (2,").replace("DATE '2025-03-27'", "DATE '2025-03-28'"),
    "visit_date_outside_calendar": (
        "INSERT INTO fact_visit VALUES (2, 1, 1, 2, 1, DATE '2025-11-01', DATE '2025-11-03', 3, "
        "FALSE, TRUE, 100, 200, DATE '2025-10-17', DATE '2025-10-31', DATE '2025-11-04', DATE '2025-11-18')"
    ),
    "event_duplicate_id": VALID_EVENT,
    "event_goldstein_above_10": VALID_EVENT.replace("VALUES (1001", "VALUES (1002").replace("3.5", "11"),
    "event_tone_below_minus_100": VALID_EVENT.replace("VALUES (1001", "VALUES (1002").replace("-1.2", "-101"),
    "event_negative_mentions": VALID_EVENT.replace("VALUES (1001", "VALUES (1002").replace(", 10)", ", -1)"),
    "event_same_actor_countries": VALID_EVENT.replace("VALUES (1001", "VALUES (1002").replace("1, 2, 1,", "1, 1, 1,"),
    "event_unknown_event_type": VALID_EVENT.replace("VALUES (1001", "VALUES (1002").replace("1, 2, 1,", "1, 2, 99,"),
    "event_date_outside_calendar": VALID_EVENT.replace("VALUES (1001", "VALUES (1002").replace("2025-03-11", "2026-03-11"),
}


@pytest.mark.parametrize("name", sorted(BAD_ROWS))
def test_ddl_rejects_bad_row(con, name):
    seed(con)
    con.execute(VALID_VISIT)
    con.execute(VALID_EVENT)
    with pytest.raises(duckdb.ConstraintException):
        con.execute(BAD_ROWS[name])
