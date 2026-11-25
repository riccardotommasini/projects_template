"""Shared fixtures of the backend tests. Puts backend/ (flat imports, as in /app) and the
repository root (warehouse package) on sys.path, through fixture_warehouse."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import fixture_warehouse
from fastapi.testclient import TestClient
from main import create_app
from repository import Neo4jReader, SampleSource, WarehouseReader, WarehouseSource

NO_CORS_ENV: dict[str, str] = {}


@pytest.fixture
def sample_client():
    return TestClient(create_app(SampleSource(), environ=NO_CORS_ENV))


@pytest.fixture
def warehouse_file(tmp_path) -> Path:
    """A published warehouse built from the samples, in tmp_path/diplomap.duckdb."""
    return fixture_warehouse.build_and_publish(tmp_path / "diplomap.duckdb")


def fake_graph() -> tuple[Neo4jReader, fixture_warehouse.FakeDriver]:
    """A Neo4jReader on a fake driver answering P4's real query texts with sample-shaped rows."""
    from warehouse.diplomatic_graph.sync import network_queries

    queries = network_queries()
    rows = fixture_warehouse.network_rows()
    driver = fixture_warehouse.FakeDriver({queries[name]: rows[name] for name in rows})
    return Neo4jReader("bolt://fake:7687", "neo4j", "unused", driver=driver), driver


def warehouse_client(path: Path, drain_timeout: float = 10.0) -> tuple[TestClient, WarehouseSource]:
    graph, _ = fake_graph()
    source = WarehouseSource(WarehouseReader(path, drain_timeout), graph)
    return TestClient(create_app(source, environ=NO_CORS_ENV)), source
