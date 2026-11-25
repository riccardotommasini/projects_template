"""Warehouse mode on a real DuckDB file built from the samples (task P1-13).

2. Every route validates against its model; where the fixture mirrors the samples, the
   response equals the sample file.
6. Contract link: the columns of table_contracts/v_visit_event.yml and v_kpi_visit.yml
   match the fields of VisitEvent and VisitKpis, up to an explicit list of hidden or
   renamed columns.
7. /health answers 200 when the warehouse file and Neo4j are absent; the data routes
   answer 503 with a clear message.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml
from conftest import NO_CORS_ENV, warehouse_client
from fastapi.testclient import TestClient
from main import create_app
from pydantic import TypeAdapter
from schemas import Leader, Network, VisitDetail, VisitEvent, VisitKpis, VisitSummary

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "sample_datasets" / "api"
CONTRACTS = ROOT / "table_contracts"


def sample_file(name: str):
    return json.loads((SAMPLES / f"{name}.json").read_text(encoding="utf-8"))


@pytest.fixture
def client(warehouse_file):
    return warehouse_client(warehouse_file)[0]


# 2. Routes against the fixture warehouse

EQUAL_TO_SAMPLE = [
    ("/leaders", "leaders", list[Leader]),
    ("/visits", "visits", list[VisitSummary]),
    ("/visits/1", "visit", VisitDetail),
    ("/visits/1/events", "visit_events", list[VisitEvent]),
    ("/network", "network", Network),   # fake Neo4j driver, see test_network.py
]


@pytest.mark.parametrize(("url", "name", "model"), EQUAL_TO_SAMPLE)
def test_route_equals_its_sample(client, url, name, model):
    response = client.get(url)
    assert response.status_code == 200, response.text
    TypeAdapter(model).validate_python(response.json())
    assert response.json() == sample_file(name)


def test_kpis_equal_the_sample_up_to_float_rounding(client):
    """DuckDB computes the means: they may differ from the Python literals by one ulp."""
    response = client.get("/visits/1/kpis")
    assert response.status_code == 200
    kpis = VisitKpis.model_validate(response.json()).model_dump()
    expected = sample_file("visit_kpis")
    assert set(kpis) == set(expected)
    for key, value in expected.items():
        if isinstance(value, float):
            assert kpis[key] == pytest.approx(value, rel=1e-12, abs=1e-12), key
        else:
            assert kpis[key] == value, key


def test_leader_filter(client):
    assert [v["visit_key"] for v in client.get("/visits", params={"leader_id": "Q100001"}).json()] == [1, 2]
    assert client.get("/visits", params={"leader_id": "Q999999"}).json() == []


@pytest.mark.parametrize("visit_key", [2, 3, 4])
def test_visits_without_sample_validate(client, visit_key):
    """No sample to compare with: validation only. These visits have no event in the fixture."""
    detail = VisitDetail.model_validate(client.get(f"/visits/{visit_key}").json())
    summary = next(v for v in client.get("/visits").json() if v["visit_key"] == visit_key)
    assert detail.model_dump(mode="json", include=set(summary)) == summary
    kpis = VisitKpis.model_validate(client.get(f"/visits/{visit_key}/kpis").json())
    assert (kpis.n_events_pre, kpis.n_events_post, kpis.delta_tone) == (0, 0, None)
    assert client.get(f"/visits/{visit_key}/events").json() == []


@pytest.mark.parametrize("suffix", ["", "/kpis", "/events"])
def test_unknown_visit_answers_404(client, suffix):
    response = client.get(f"/visits/99{suffix}")
    assert response.status_code == 404
    assert response.json() == {"detail": "no visit with visit_key 99"}


# 6. Contract link

# Columns of a view that are not a field of the same name in its model, with the reason.
HIDDEN_OR_RENAMED = {
    "v_visit_event": {
        "actor1_country_key": "renamed: nested as actor1_country (iso3_code, country_name)",
        "actor2_country_key": "renamed: nested as actor2_country (iso3_code, country_name)",
        "event_type_key": "hidden: surrogate key; cameo_code and is_cooperative are exposed",
    },
    "v_kpi_visit": {},
}
# Model fields that are not a column of the view, with the column they replace.
MODEL_ONLY = {
    "v_visit_event": {"actor1_country": "actor1_country_key", "actor2_country": "actor2_country_key"},
    "v_kpi_visit": {},
}
MODELS = {"v_visit_event": VisitEvent, "v_kpi_visit": VisitKpis}


@pytest.mark.parametrize("view", sorted(MODELS))
def test_model_matches_the_view_contract(view):
    contract = yaml.safe_load((CONTRACTS / f"{view}.yml").read_text(encoding="utf-8"))
    columns = {c["name"] for c in contract["columns"]}
    fields = set(MODELS[view].model_fields)
    hidden = set(HIDDEN_OR_RENAMED[view])
    model_only = set(MODEL_ONLY[view])
    assert hidden <= columns, f"listed as hidden but not in the contract: {hidden - columns}"
    assert columns - hidden - fields == set(), "contract columns neither exposed nor listed as hidden or renamed"
    assert fields - columns - model_only == set(), "model fields that are not contract columns"
    assert set(MODEL_ONLY[view].values()) <= hidden


@pytest.mark.parametrize("view", sorted(MODELS))
def test_nullability_follows_the_contract(view):
    contract = yaml.safe_load((CONTRACTS / f"{view}.yml").read_text(encoding="utf-8"))
    for column in contract["columns"]:
        field = MODELS[view].model_fields.get(column["name"])
        if field is not None:
            nullable = "None" in repr(field.annotation)
            assert nullable == column["nullable"], column["name"]


# 7. /health without warehouse and Neo4j


@pytest.fixture
def unavailable_client(tmp_path):
    env = {
        **NO_CORS_ENV,
        "DIPLOMAP_API_MODE": "warehouse",
        "DIPLOMAP_WAREHOUSE_PATH": str(tmp_path / "missing.duckdb"),
        "NEO4J_URI": "bolt://127.0.0.1:9",
    }
    return TestClient(create_app(environ=env))


def test_health_answers_200_without_warehouse_and_neo4j(unavailable_client):
    response = unavailable_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize("url", ["/leaders", "/visits", "/visits/1", "/visits/1/kpis", "/visits/1/events"])
def test_missing_warehouse_answers_503(unavailable_client, tmp_path, url):
    response = unavailable_client.get(url)
    assert response.status_code == 503
    assert response.json()["detail"] == f"warehouse file not found: {tmp_path / 'missing.duckdb'}"


def test_unconfigured_neo4j_answers_503(unavailable_client):
    response = unavailable_client.get("/network")
    assert response.status_code == 503
    assert "NEO4J_PASSWORD" in response.json()["detail"]
