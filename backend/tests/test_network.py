"""Neo4j reader and the /network route (task P1-13).

3. A fake driver returns rows shaped like P4's queries (queries.cypher), with
   neo4j.time.Date values: the route converts them to ISO strings, deduplicates the
   REPRESENTS edges and maps the reciprocal leader names back to ids. A real-Neo4j test
   runs only when NEO4J_URI and NEO4J_PASSWORD are set (it replaces the Leader/Country
   graph of that Neo4j, like P4's tests).
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import duckdb
import fixture_warehouse
import pytest
from conftest import NO_CORS_ENV, fake_graph
from fastapi.testclient import TestClient
from main import create_app
from repository import (
    Neo4jReader,
    Unavailable,
    WarehouseReader,
    WarehouseSource,
    network_payload,
)
from schemas import Network

SAMPLES = Path(__file__).resolve().parents[2] / "sample_datasets" / "api"
NETWORK_SAMPLE = json.loads((SAMPLES / "network.json").read_text(encoding="utf-8"))


def network_client(graph: Neo4jReader, tmp_path) -> TestClient:
    source = WarehouseSource(WarehouseReader(tmp_path / "unused.duckdb"), graph)
    return TestClient(create_app(source, environ=NO_CORS_ENV))


def test_network_route_equals_the_sample(tmp_path):
    graph, _ = fake_graph()
    response = network_client(graph, tmp_path).get("/network")
    assert response.status_code == 200, response.text
    Network.model_validate(response.json())
    assert response.json() == NETWORK_SAMPLE


def test_queries_come_from_queries_cypher(tmp_path):
    from warehouse.diplomatic_graph.sync import network_queries

    graph, driver = fake_graph()
    network_client(graph, tmp_path).get("/network")
    queries = network_queries()
    assert driver.queries_run == [
        queries["leader_country_graph"], queries["shared_destinations"], queries["reciprocal_visits"]
    ]


def test_neo4j_dates_become_iso_strings():
    rows = fixture_warehouse.network_rows()
    assert type(rows["reciprocal_visits"][0]["first_a_to_b"]).__module__.startswith("neo4j")
    payload = network_payload(rows)
    assert payload["reciprocal_visits"][0]["first_a_to_b"] == "2025-03-10"
    assert {e["first_visit"] for e in payload["edges"] if e["type"] == "VISITED"} == {
        "2025-03-10", "2025-04-02", "2025-05-20", "2025-06-15"
    }


def test_represents_edges_are_deduplicated():
    rows = fixture_warehouse.network_rows()
    represents_rows = [r for r in rows["leader_country_graph"] if r["leader_id"] == "Q100002" and r["relation"] == "REPRESENTS"]
    assert len(represents_rows) == 2   # two dim_leader versions in the graph
    edges = [e for e in network_payload(rows)["edges"] if e["source"] == "Q100002" and e["type"] == "REPRESENTS"]
    assert edges == [{"source": "Q100002", "target": "JPN", "type": "REPRESENTS", "n_visits": None, "first_visit": None}]


def test_ambiguous_leader_name_is_refused():
    rows = fixture_warehouse.network_rows()
    for row in rows["leader_country_graph"]:
        if row["leader_id"] == "Q100003":
            row["leader_name"] = "Sample Leader A"   # two ids, one name
    with pytest.raises(Unavailable, match="matches 2 leader ids"):
        network_payload(rows)


def test_unknown_leader_name_is_refused():
    rows = fixture_warehouse.network_rows()
    rows["reciprocal_visits"][0]["leaders_b_to_a"] = ["Nobody"]
    with pytest.raises(Unavailable, match="matches 0 leader ids"):
        network_payload(rows)


def test_driver_error_answers_503(tmp_path):
    from neo4j.exceptions import ServiceUnavailable

    class DownDriver:
        def session(self, **_):
            raise ServiceUnavailable("connection refused")

    graph = Neo4jReader("bolt://down:7687", "neo4j", "pw", driver=DownDriver())
    response = network_client(graph, tmp_path).get("/network")
    assert response.status_code == 503
    assert response.json()["detail"].startswith("Neo4j is unavailable at bolt://down:7687")


def test_unreachable_neo4j_answers_503_quickly(tmp_path):
    """The driver retries read transactions for 30 s by default; the reader caps it."""
    graph = Neo4jReader("bolt://127.0.0.1:9", "neo4j", "pw")
    started = time.monotonic()
    response = network_client(graph, tmp_path).get("/network")
    assert time.monotonic() - started < 10
    assert response.status_code == 503
    assert "Neo4j is unavailable" in response.json()["detail"]


@pytest.mark.skipif(
    not (os.environ.get("NEO4J_URI") and os.environ.get("NEO4J_PASSWORD")),
    reason="real Neo4j test: set NEO4J_URI and NEO4J_PASSWORD",
)
def test_real_neo4j_loaded_by_p4_sync(tmp_path, warehouse_file):
    from neo4j import GraphDatabase

    from warehouse.diplomatic_graph.sync import sync

    uri, user, password = os.environ["NEO4J_URI"], os.environ.get("NEO4J_USER", "neo4j"), os.environ["NEO4J_PASSWORD"]
    with GraphDatabase.driver(uri, auth=(user, password)) as driver, \
            duckdb.connect(str(warehouse_file), read_only=True) as connection:
        sync(connection, driver)
        try:
            response = network_client(Neo4jReader(uri, user, password), tmp_path).get("/network")
            assert response.status_code == 200, response.text
            assert response.json() == NETWORK_SAMPLE
        finally:
            driver.execute_query("MATCH (n) WHERE n:Leader OR n:Country DETACH DELETE n")
