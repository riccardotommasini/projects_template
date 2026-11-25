"""Sample mode, CORS and the configuration from the environment (task P1-13).

1. Each route returns exactly the matching file of sample_datasets/api/ and validates
   against its response model; the leader filter and the documented 404 work.
2. CORS: a listed origin passes the preflight, another origin does not.
3. DIPLOMAP_API_MODE and DIPLOMAP_DRAIN_TIMEOUT_S are read and validated.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from conftest import NO_CORS_ENV
from fastapi.testclient import TestClient
from main import DEFAULT_CORS_ORIGINS, create_app
from pydantic import TypeAdapter
from repository import (
    DEFAULT_DRAIN_TIMEOUT_S,
    SampleSource,
    WarehouseSource,
    source_from_env,
)
from schemas import Leader, Network, VisitDetail, VisitEvent, VisitKpis, VisitSummary

SAMPLES = Path(__file__).resolve().parents[2] / "sample_datasets" / "api"

CASES = [
    ("/leaders", "leaders", list[Leader]),
    ("/visits", "visits", list[VisitSummary]),
    ("/visits/1", "visit", VisitDetail),
    ("/visits/1/kpis", "visit_kpis", VisitKpis),
    ("/visits/1/events", "visit_events", list[VisitEvent]),
    ("/network", "network", Network),
]


def sample_file(name: str):
    return json.loads((SAMPLES / f"{name}.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize(("url", "name", "model"), CASES)
def test_route_returns_its_sample_file(sample_client, url, name, model):
    response = sample_client.get(url)
    assert response.status_code == 200
    assert response.json() == sample_file(name)
    TypeAdapter(model).validate_python(response.json())


def test_leader_filter(sample_client):
    visits = sample_client.get("/visits", params={"leader_id": "Q100001"}).json()
    assert [v["visit_key"] for v in visits] == [1, 2]
    assert sample_client.get("/visits", params={"leader_id": "Q999999"}).json() == []


@pytest.mark.parametrize("suffix", ["", "/kpis", "/events"])
@pytest.mark.parametrize("visit_key", [2, 3, 4])
def test_visit_without_sample_answers_404(sample_client, visit_key, suffix):
    response = sample_client.get(f"/visits/{visit_key}{suffix}")
    assert response.status_code == 404
    assert response.json() == {"detail": f"no sample for visit {visit_key}"}


@pytest.mark.parametrize("suffix", ["", "/kpis", "/events"])
def test_unknown_visit_answers_404(sample_client, suffix):
    response = sample_client.get(f"/visits/99{suffix}")
    assert response.status_code == 404
    assert response.json() == {"detail": "no visit with visit_key 99"}


# CORS


@pytest.fixture
def cors_client():
    return TestClient(create_app(SampleSource(), environ={}))   # default origins


@pytest.mark.parametrize("origin", DEFAULT_CORS_ORIGINS.split(","))
def test_listed_origin_passes_the_preflight(cors_client, origin):
    response = cors_client.options(
        "/visits", headers={"Origin": origin, "Access-Control-Request-Method": "GET"}
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "access-control-allow-credentials" not in response.headers
    assert cors_client.get("/visits", headers={"Origin": origin}).headers["access-control-allow-origin"] == origin


def test_other_origin_fails_the_preflight(cors_client):
    response = cors_client.options(
        "/visits", headers={"Origin": "http://evil.example.com", "Access-Control-Request-Method": "GET"}
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_only_get_is_allowed(cors_client):
    response = cors_client.options(
        "/visits", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"}
    )
    assert response.status_code == 400


def test_origins_come_from_the_environment():
    client = TestClient(create_app(SampleSource(), environ={"DIPLOMAP_CORS_ORIGINS": "http://app.example.com"}))
    ok = client.options("/leaders", headers={"Origin": "http://app.example.com", "Access-Control-Request-Method": "GET"})
    ko = client.options("/leaders", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert ok.status_code == 200
    assert ko.status_code == 400


# Configuration


def test_default_mode_is_sample():
    assert isinstance(source_from_env({}), SampleSource)


def test_warehouse_mode_reads_its_settings():
    source = source_from_env({
        "DIPLOMAP_API_MODE": "warehouse", "DIPLOMAP_WAREHOUSE_PATH": "/x/w.duckdb",
        "DIPLOMAP_DRAIN_TIMEOUT_S": "2.5", "NEO4J_URI": "bolt://graph:7687", "NEO4J_PASSWORD": "pw",
    })
    assert isinstance(source, WarehouseSource)
    assert source.reader.path == "/x/w.duckdb"
    assert source.reader.drain_timeout == 2.5
    assert source.graph.uri == "bolt://graph:7687"


def test_drain_timeout_default():
    assert source_from_env({"DIPLOMAP_API_MODE": "warehouse"}).reader.drain_timeout == DEFAULT_DRAIN_TIMEOUT_S == 10.0


@pytest.mark.parametrize(
    ("env", "message"),
    [
        ({"DIPLOMAP_API_MODE": "live"}, "sample or warehouse"),
        ({"DIPLOMAP_API_MODE": "warehouse", "DIPLOMAP_DRAIN_TIMEOUT_S": "ten"}, "number of seconds"),
        ({"DIPLOMAP_API_MODE": "warehouse", "DIPLOMAP_DRAIN_TIMEOUT_S": "0"}, "positive"),
    ],
)
def test_invalid_settings_fail_at_startup(env, message):
    with pytest.raises(ValueError, match=message):
        create_app(environ={**NO_CORS_ENV, **env})
