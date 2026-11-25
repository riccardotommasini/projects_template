"""Tests of the API contract (task P1-12).

Run from the repository root:

    pytest backend/tests/test_api.py

Requires: fastapi, pydantic, httpx, pytest (backend/requirements.txt plus pytest and httpx).

What is tested:
1. Every example file of sample_datasets/api/ validates against the response
   model of its route, and equals its payload in backend/examples.py.
2. The OpenAPI document generates, lists every endpoint, every route has a
   response_model, operation ids are unique, every data route documents its
   example and its errors.
3. backend/openapi.json equals app.openapi().
4. The examples agree with each other (event counts and means versus kpis,
   visit 1 across files, network versus visits).
5. /health answers 200; invalid parameters answer 422; an unexpected field fails.
   The routes in each mode are tested in test_sample_mode.py and test_warehouse_mode.py.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.exceptions import ResponseValidationError
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
SAMPLES = ROOT / "sample_datasets" / "api"
OPENAPI_FILE = BACKEND / "openapi.json"
REGENERATE = "python backend/export_openapi.py"

# Flat imports, as in the container (/app holds main.py, api.py, schemas.py, examples.py).
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from examples import EXAMPLES
from main import app, create_app
from repository import SampleSource
from schemas import Leader, Network, VisitDetail, VisitEvent, VisitKpis, VisitSummary

# path -> (operation id, response model, example file name)
ROUTES = {
    "/leaders": ("list_leaders", list[Leader], "leaders"),
    "/visits": ("list_visits", list[VisitSummary], "visits"),
    "/visits/{visit_key}": ("get_visit", VisitDetail, "visit"),
    "/visits/{visit_key}/kpis": ("get_visit_kpis", VisitKpis, "visit_kpis"),
    "/visits/{visit_key}/events": ("get_visit_events", list[VisitEvent], "visit_events"),
    "/network": ("get_network", Network, "network"),
}
VISIT_ROUTES = [path for path in ROUTES if path.startswith("/visits/")]


def api_routes() -> dict[str, APIRoute]:
    return {route.path: route for route in app.routes if isinstance(route, APIRoute)}


def load(name: str):
    path = SAMPLES / f"{name}.json"
    assert path.is_file(), f"missing example {path}; run: {REGENERATE}"
    return json.loads(path.read_text(encoding="utf-8"))


def d(value: str) -> date:
    return date.fromisoformat(value)


@pytest.fixture(scope="module")
def client():
    # Sample mode whatever the environment of the test run.
    return TestClient(create_app(SampleSource(), environ={}))


# 1. Example files


@pytest.mark.parametrize("path", ROUTES)
def test_example_file_validates_against_its_response_model(path):
    _, model, name = ROUTES[path]
    route = api_routes()[path]
    payload = load(name)
    TypeAdapter(route.response_model).validate_python(payload)
    TypeAdapter(model).validate_python(payload)
    assert payload == EXAMPLES[name], f"{name}.json differs from backend/examples.py; run: {REGENERATE}"


def test_one_example_file_per_endpoint():
    expected = {name for _, _, name in ROUTES.values()}
    assert set(EXAMPLES) == expected
    assert {p.stem for p in SAMPLES.glob("*.json")} == expected


def test_openapi_shows_the_example_of_each_route():
    """The example shown in /docs for each route is the payload of its file."""
    spec = app.openapi()
    for path, (_, _, name) in ROUTES.items():
        content = spec["paths"][path]["get"]["responses"]["200"]["content"]["application/json"]
        assert content["example"] == EXAMPLES[name]


# 2. OpenAPI document


def test_openapi_lists_every_endpoint():
    spec = app.openapi()
    assert set(spec["paths"]) == set(ROUTES) | {"/health"}
    for path in spec["paths"]:
        assert set(spec["paths"][path]) == {"get"}, path


def test_every_route_has_its_response_model():
    routes = api_routes()
    assert set(routes) == set(ROUTES) | {"/health"}
    for path, route in routes.items():
        assert route.response_model is not None, path
        if path in ROUTES:
            assert route.response_model == ROUTES[path][1], path


def test_operation_ids_are_unique_and_stable():
    spec = app.openapi()
    ids = [operation["operationId"] for item in spec["paths"].values() for operation in item.values()]
    assert len(ids) == len(set(ids)), ids
    assert set(ids) == {op for op, _, _ in ROUTES.values()} | {"health"}


def test_every_data_route_documents_its_example_and_errors():
    spec = app.openapi()
    for path in ROUTES:
        operation = spec["paths"][path]["get"]
        assert operation.get("summary"), path
        responses = operation["responses"]
        assert "example" in responses["200"]["content"]["application/json"], path
        assert "501" not in responses, path
        assert responses["503"]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ErrorResponse"
        }, path
        assert ("404" in responses) == (path in VISIT_ROUTES), path


# 3. Exported document is up to date


def test_openapi_file_is_up_to_date():
    assert OPENAPI_FILE.is_file(), f"missing {OPENAPI_FILE}; run: {REGENERATE}"
    exported = json.loads(OPENAPI_FILE.read_text(encoding="utf-8"))
    assert exported == app.openapi(), f"backend/openapi.json is stale; run: {REGENERATE}"


# 4. Cross-example consistency


def test_event_counts_match_kpis():
    events, kpis = load("visit_events"), load("visit_kpis")
    mine = [e for e in events if e["visit_key"] == kpis["visit_key"]]
    assert len(mine) == len(events), "the events example holds the events of one visit"
    assert sum(e["visit_window"] == "PRE" for e in mine) == kpis["n_events_pre"]
    assert sum(e["visit_window"] == "POST" for e in mine) == kpis["n_events_post"]
    assert kpis["is_low_volume"] == (min(kpis["n_events_pre"], kpis["n_events_post"]) < 10)


def test_event_means_and_deltas_match_kpis():
    events, kpis = load("visit_events"), load("visit_kpis")
    for measure, column in (("coop_share", "is_cooperative"), ("tone", "avg_tone"), ("goldstein", "goldstein_scale")):
        means = {}
        for window in ("PRE", "POST"):
            values = [float(e[column]) for e in events if e["visit_window"] == window]
            means[window] = sum(values) / len(values) if values else None
        assert kpis[f"{measure}_pre"] == pytest.approx(means["PRE"]), measure
        assert kpis[f"{measure}_post"] == pytest.approx(means["POST"]), measure
        assert kpis[f"delta_{measure}"] == pytest.approx(means["POST"] - means["PRE"]), measure


def test_events_fall_in_their_window():
    visit, events = load("visit"), load("visit_events")
    pair = {visit["visitor_country"]["iso3_code"], visit["host_country"]["iso3_code"]}
    for e in events:
        assert e["visit_key"] == visit["visit_key"]
        assert {e["actor1_country"]["iso3_code"], e["actor2_country"]["iso3_code"]} == pair
        day = d(e["event_date_key"])
        if e["visit_window"] == "PRE":
            assert d(visit["pre_window_start"]) <= day <= d(visit["pre_window_end"])
            assert e["day_offset"] == (day - d(visit["start_date_key"])).days
        else:
            assert d(visit["post_window_start"]) <= day <= d(visit["post_window_end"])
            assert e["day_offset"] == (day - d(visit["end_date_key"])).days


def test_visit_is_consistent_across_examples():
    visit, visits = load("visit"), load("visits")
    summary = next(v for v in visits if v["visit_key"] == visit["visit_key"])
    assert {k: visit[k] for k in summary} == summary
    start, end = d(visit["start_date_key"]), d(visit["end_date_key"])
    assert visit["duration_days"] == (end - start).days + 1
    assert d(visit["pre_window_start"]) == start.fromordinal(start.toordinal() - 15)
    assert d(visit["post_window_end"]) == end.fromordinal(end.toordinal() + 15)


def test_visits_match_leaders():
    leaders = {leader["leader_id"]: leader for leader in load("leaders")}
    for visit in load("visits"):
        leader = leaders[visit["leader_id"]]
        assert visit["leader_name"] == leader["leader_name"]
        start = d(visit["start_date_key"])
        office = next(
            o for o in leader["offices"]
            if d(o["valid_from"]) <= start and (o["valid_to"] is None or start <= d(o["valid_to"]))
        )
        assert visit["visitor_country"] == office["represented_country"], visit["visit_key"]
        assert visit["visitor_country"] != visit["host_country"]


def test_network_matches_visits_and_leaders():
    network, visits, leaders = load("network"), load("visits"), load("leaders")
    nodes = {n["id"]: n for n in network["nodes"]}
    assert len(nodes) == len(network["nodes"]), "node ids are unique"
    for edge in network["edges"]:
        assert nodes[edge["source"]]["type"] == "leader"
        assert nodes[edge["target"]]["type"] == "country"
    keys = [(e["source"], e["target"], e["type"]) for e in network["edges"]]
    assert len(keys) == len(set(keys)), "one edge per leader, country and type"

    visited = defaultdict(list)
    for v in visits:
        visited[(v["leader_id"], v["host_country"]["iso3_code"])].append(v["start_date_key"])
    assert {
        (e["source"], e["target"]): (e["n_visits"], e["first_visit"]) for e in network["edges"] if e["type"] == "VISITED"
    } == {key: (len(days), min(days)) for key, days in visited.items()}

    represents = {
        (leader["leader_id"], o["represented_country"]["iso3_code"]) for leader in leaders for o in leader["offices"]
    }
    assert {(e["source"], e["target"]) for e in network["edges"] if e["type"] == "REPRESENTS"} == represents
    for e in network["edges"]:
        if e["type"] == "REPRESENTS":
            assert e["n_visits"] is None and e["first_visit"] is None


def test_network_analyses_follow_from_the_edges():
    network = load("network")
    visited = defaultdict(set)
    first = {}
    country_of = {}
    for e in network["edges"]:
        if e["type"] == "VISITED":
            visited[e["source"]].add(e["target"])
            first[(e["source"], e["target"])] = e["first_visit"]
        else:
            country_of[e["source"]] = e["target"]

    shared = []
    for a in sorted(visited):
        for b in sorted(visited):
            common = sorted(visited[a] & visited[b])
            if a < b and common:
                shared.append({"leader_a_id": a, "leader_b_id": b, "n_shared": len(common), "shared_countries": common})
    assert network["shared_destinations"] == shared

    reciprocal = {}
    for la, ca in country_of.items():
        for lb, cb in country_of.items():
            if ca < cb and cb in visited[la] and ca in visited[lb]:
                item = reciprocal.setdefault((ca, cb), {"a": set(), "b": set(), "fa": [], "fb": []})
                item["a"].add(la)
                item["b"].add(lb)
                item["fa"].append(first[(la, cb)])
                item["fb"].append(first[(lb, ca)])
    assert [
        (r["country_a"], r["country_b"], set(r["leaders_a_to_b"]), set(r["leaders_b_to_a"]),
         r["first_a_to_b"], r["first_b_to_a"])
        for r in network["reciprocal_visits"]
    ] == [
        (ca, cb, v["a"], v["b"], min(v["fa"]), min(v["fb"])) for (ca, cb), v in sorted(reciprocal.items())
    ]


# 5. Behaviour of the app


def test_health_answers_200(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize("url", ["/visits?leader_id=leader-a","/visits/0", "/visits/abc/kpis"])
def test_invalid_parameters_answer_422(client, url):
    assert client.get(url).status_code == 422


def test_extra_field_fails_validation():
    with pytest.raises(ValidationError, match="unexpected_column"):
        VisitKpis.model_validate({**EXAMPLES["visit_kpis"], "unexpected_column": 1})
    with pytest.raises(ValidationError, match="unexpected_column"):
        VisitSummary.model_validate({**EXAMPLES["visits"][0], "unexpected_column": 1})


def test_handler_returning_an_extra_column_fails_loudly():
    """A future handler that returns an unexpected SQL column must not leak it: the response fails."""
    probe = FastAPI()

    @probe.get("/kpis", response_model=VisitKpis)
    def kpis():
        return {**EXAMPLES["visit_kpis"], "visitor_country_key": 7}

    with pytest.raises(ResponseValidationError, match="visitor_country_key"):
        TestClient(probe).get("/kpis")
