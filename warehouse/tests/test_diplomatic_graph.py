"""Tests for the Neo4j projection (warehouse/diplomatic_graph/).

Run from the repository root, against a running Neo4j (for example the docker-compose service):

    NEO4J_PASSWORD=... pytest warehouse/tests/test_diplomatic_graph.py

Requires: duckdb, neo4j, pytest. The Neo4j tests are skipped when NEO4J_PASSWORD is unset or Neo4j is unreachable.
They replace the Leader/Country graph of that Neo4j: it is derived, `sync.py` rebuilds it.

Hand-made set: Q1 (France) visits Japan twice and Germany once, Q2 (Japan) visits France, Q3 (Germany) visits
Japan, Q4 (Italy) never travels.
"""

import os
import sys
from datetime import date
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "warehouse" / "diplomatic_graph"))
import sync as graph  # noqa: E402

SEED = """
INSERT INTO dim_country (country_key, country_name, iso3_code, fips_code, cameo_code, region) VALUES
    (1, 'France', 'FRA', 'FR', 'FRA', 'Europe'), (2, 'Japan', 'JPN', 'JA', 'JPN', 'Asia'),
    (3, 'Germany', 'DEU', 'GM', 'DEU', 'Europe'), (4, 'Italy', 'ITA', 'IT', 'ITA', 'Europe');
INSERT INTO dim_visit_type VALUES (1, 'state');
INSERT INTO dim_leader VALUES
    (1, 'Q1', 'Leader A', 'President', 1, DATE '2020-01-01', NULL),
    (2, 'Q2', 'Leader B', 'Prime Minister', 2, DATE '2021-01-01', NULL),
    (3, 'Q3', 'Leader C', 'Chancellor', 3, DATE '2022-01-01', NULL),
    (4, 'Q4', 'Leader D', NULL, 4, DATE '2023-01-01', NULL);
INSERT INTO dim_date
SELECT CAST(d AS DATE), year(d), month(d), week(d), day(d)
FROM generate_series(DATE '2024-12-17', DATE '2025-07-15', INTERVAL 1 DAY) AS t(d);
INSERT INTO fact_visit
SELECT k, leader, visitor, host, 1, s, e, (e - s) + 1, FALSE, FALSE, 1, 1, s - 15, s - 1, e + 1, e + 15
FROM (VALUES (1, 1, 1, 2, DATE '2025-02-10', DATE '2025-02-12'),
             (2, 1, 1, 2, DATE '2025-04-01', DATE '2025-04-01'),
             (3, 1, 1, 3, DATE '2025-03-05', DATE '2025-03-06'),
             (4, 2, 2, 1, DATE '2025-05-20', DATE '2025-05-22'),
             (5, 3, 3, 2, DATE '2025-06-02', DATE '2025-06-03')) AS t(k, leader, visitor, host, s, e);
"""


def warehouse():
    connection = duckdb.connect()
    connection.execute((ROOT / "warehouse" / "dimensions_and_facts" / "schema.sql").read_text())
    connection.execute(SEED)
    return connection


def test_export_aggregates_visits_per_leader_and_host():
    rows = graph.export(warehouse())
    assert [len(rows[k]) for k in ("countries", "leaders", "represents")] == [4, 4, 4]
    assert [tuple(r.values()) for r in rows["visited"]] == [
        ("Q1", 2, 2, 4, date(2025, 2, 10), date(2025, 4, 1)),
        ("Q1", 3, 1, 2, date(2025, 3, 5), date(2025, 3, 5)),
        ("Q2", 1, 1, 3, date(2025, 5, 20), date(2025, 5, 20)),
        ("Q3", 2, 1, 2, date(2025, 6, 2), date(2025, 6, 2)),
    ]


def test_queries_file_holds_the_three_network_queries():
    assert set(graph.network_queries()) == {"leader_country_graph", "shared_destinations", "reciprocal_visits"}


# Neo4j


@pytest.fixture(scope="module")
def driver():
    if "NEO4J_PASSWORD" not in os.environ:
        pytest.skip("NEO4J_PASSWORD not set")
    from neo4j import GraphDatabase

    neo4j_driver = GraphDatabase.driver(
        os.environ.get("NEO4J_URI", "bolt://localhost:7687"),
        auth=(os.environ.get("NEO4J_USER", "neo4j"), os.environ["NEO4J_PASSWORD"]),
    )
    try:
        neo4j_driver.verify_connectivity()
    except Exception as error:  # noqa: BLE001
        neo4j_driver.close()
        pytest.skip(f"Neo4j unreachable: {error}")
    yield neo4j_driver
    neo4j_driver.close()


def snapshot(driver):
    """The whole Leader/Country graph as sorted text, independent of Neo4j internal ids."""
    nodes, _, _ = driver.execute_query(
        "MATCH (n) WHERE n:Leader OR n:Country RETURN labels(n) AS labels, properties(n) AS props")
    edges, _, _ = driver.execute_query(
        "MATCH (a)-[r]->(b) RETURN coalesce(a.leader_id, a.iso3) AS a, type(r) AS t, b.iso3 AS b, "
        "properties(r) AS props")
    return (sorted(str((r["labels"], sorted(r["props"].items()))) for r in nodes),
            sorted(str((r["a"], r["t"], r["b"], sorted(r["props"].items()))) for r in edges))


def query(driver, name):
    records, _, _ = driver.execute_query(graph.network_queries()[name])
    return [r.data() for r in records]


def test_two_rebuilds_give_the_same_graph(driver):
    connection = warehouse()
    counts = graph.sync(connection, driver)
    first = snapshot(driver)
    graph.sync(connection, driver)
    assert snapshot(driver) == first
    assert counts == {"countries": 4, "leaders": 4, "represents": 4, "visited": 4}
    assert (len(first[0]), len(first[1])) == (8, 8)

    # A rebuild replaces the graph: a removed visit disappears.
    connection.execute("DELETE FROM fact_visit WHERE visit_key = 5")
    graph.sync(connection, driver)
    records, _, _ = driver.execute_query("MATCH ()-[r:VISITED]->() RETURN count(r) AS n")
    assert records[0]["n"] == 3


def test_network_queries_match_the_hand_computation(driver):
    graph.sync(warehouse(), driver)

    edges = [(r["leader_id"], r["relation"], r["iso3"], r["n_visits"], r["days_on_site"])
             for r in query(driver, "leader_country_graph")]
    assert edges == [
        ("Q1", "REPRESENTS", "FRA", None, None),
        ("Q1", "VISITED", "DEU", 1, 2),
        ("Q1", "VISITED", "JPN", 2, 4),
        ("Q2", "REPRESENTS", "JPN", None, None),
        ("Q2", "VISITED", "FRA", 1, 3),
        ("Q3", "REPRESENTS", "DEU", None, None),
        ("Q3", "VISITED", "JPN", 1, 2),
    ]

    shared = [(r["leader_a_id"], r["leader_b_id"], r["n_shared"], r["shared_countries"])
              for r in query(driver, "shared_destinations")]
    assert shared == [("Q1", "Q3", 1, ["JPN"])]

    reciprocal = [(r["country_a"], r["country_b"], r["leaders_a_to_b"], r["leaders_b_to_a"],
                   str(r["first_a_to_b"]), str(r["first_b_to_a"]))
                  for r in query(driver, "reciprocal_visits")]
    assert reciprocal == [("FRA", "JPN", ["Leader A"], ["Leader B"], "2025-02-10", "2025-05-20")]
