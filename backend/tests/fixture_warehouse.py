"""Test warehouse built from the contract samples (backend/examples.py).

Uses the production builders instead of copies: the real star schema
(warehouse/dimensions_and_facts/schema.sql), P4's serving views
(warehouse.views.build_views) and P1-11's publication (warehouse.publish).
The rows are derived from the samples, so the warehouse routes can be compared
with the sample files.

Also usable outside pytest, for example to write a file for a Docker check:

    python backend/tests/fixture_warehouse.py /tmp/diplomap.duckdb

The fake Neo4j driver returns rows shaped like P4's queries.cypher for the same data.
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import duckdb

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
for path in (ROOT, BACKEND):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from examples import LEADERS, VISIT, VISIT_EVENTS, VISITS

from warehouse.publish import prepare_build_path, publish_warehouse
from warehouse.views.build_views import build_views

SCHEMA_SQL = ROOT / "warehouse" / "dimensions_and_facts" / "schema.sql"

# Codes of the sample countries in the other code systems of dim_country.
COUNTRY_CODES = {"FRA": ("FR", "FRA"), "JPN": ("JA", "JPN"), "DEU": ("GM", "DEU")}
VISIT_TYPES = ["state", "working", "summit", "ceremony", "unknown"]
# Not in the samples (only visit 1 has lineage): deterministic stand-ins for visits 2 to 4.
WIKI_STANDIN = {k: (90000000 + k, 1200000000 + k) for k in range(2, 5)}


def _d(value: str) -> date:
    return date.fromisoformat(value)


def populate(connection: duckdb.DuckDBPyConnection, events: list[dict] | None = None) -> None:
    """Create the star schema and the views, then load rows derived from the samples."""
    events = VISIT_EVENTS if events is None else events
    connection.execute(SCHEMA_SQL.read_text())

    countries: dict[str, tuple[int, str]] = {}
    for leader in LEADERS:
        for office in leader["offices"]:
            c = office["represented_country"]
            countries.setdefault(c["iso3_code"], (len(countries) + 1, c["country_name"]))
    for visit in VISITS:
        for c in (visit["visitor_country"], visit["host_country"]):
            countries.setdefault(c["iso3_code"], (len(countries) + 1, c["country_name"]))
    for iso3, (key, name) in countries.items():
        fips, cameo = COUNTRY_CODES[iso3]
        connection.execute("INSERT INTO dim_country VALUES (?, ?, ?, ?, ?, NULL)", [key, name, iso3, fips, cameo])

    connection.execute(
        "INSERT INTO dim_date SELECT CAST(d AS DATE), year(d), month(d), week(d), day(d) "
        "FROM generate_series(DATE '2024-12-17', DATE '2025-07-15', INTERVAL 1 DAY) AS t(d)"
    )
    for key, label in enumerate(VISIT_TYPES, start=1):
        connection.execute("INSERT INTO dim_visit_type VALUES (?, ?)", [key, label])

    event_types: dict[str, int] = {}
    for event in VISIT_EVENTS:
        if event["cameo_code"] not in event_types:
            event_types[event["cameo_code"]] = len(event_types) + 1
            quad_class = 1 if event["is_cooperative"] else 3
            connection.execute(
                "INSERT INTO dim_event_type VALUES (?, ?, ?, ?, ?)",
                [event_types[event["cameo_code"]], event["cameo_code"], event["cameo_code"][:2],
                 quad_class, event["is_cooperative"]],
            )

    versions = []   # (leader_key, leader_id, valid_from, valid_to, position_title)
    for leader in LEADERS:
        for office in leader["offices"]:
            key = len(versions) + 1
            versions.append((key, leader["leader_id"], office["valid_from"], office["valid_to"], office["position_title"]))
            connection.execute(
                "INSERT INTO dim_leader VALUES (?, ?, ?, ?, ?, ?, ?)",
                [key, leader["leader_id"], leader["leader_name"], office["position_title"],
                 countries[office["represented_country"]["iso3_code"]][0], office["valid_from"], office["valid_to"]],
            )

    for visit in VISITS:
        start, end = _d(visit["start_date_key"]), _d(visit["end_date_key"])
        leader_key = next(
            k for k, lid, vf, vt, _ in versions
            if lid == visit["leader_id"] and _d(vf) <= start and (vt is None or start <= _d(vt))
        )
        wiki = (
            (VISIT["wiki_page_id"], VISIT["wiki_revision_id"])
            if visit["visit_key"] == VISIT["visit_key"] else WIKI_STANDIN[visit["visit_key"]]
        )
        connection.execute(
            "INSERT INTO fact_visit VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
            "CAST(? AS DATE) - 15, CAST(? AS DATE) - 1, CAST(? AS DATE) + 1, CAST(? AS DATE) + 15)",
            [visit["visit_key"], leader_key, countries[visit["visitor_country"]["iso3_code"]][0],
             countries[visit["host_country"]["iso3_code"]][0], VISIT_TYPES.index(visit["visit_type_label"]) + 1,
             start, end, visit["duration_days"], visit["is_multilateral"], visit["matched_in_gdelt"],
             wiki[0], wiki[1], start, start, end, end],
        )

    for event in events:
        connection.execute(
            "INSERT INTO fact_gdelt_event VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [event["gdelt_event_id"], event["event_date_key"],
             countries[event["actor1_country"]["iso3_code"]][0], countries[event["actor2_country"]["iso3_code"]][0],
             event_types[event["cameo_code"]], event["source_url"], event["goldstein_scale"], event["avg_tone"],
             event["num_mentions"]],
        )
    build_views(connection)


def build_and_publish(final_path: Path, events: list[dict] | None = None) -> Path:
    """Build in warehouse_build.duckdb next to final_path, then publish atomically (P1-11)."""
    build_path = final_path.with_name("warehouse_build.duckdb")
    prepare_build_path(build_path, final_path=final_path)
    with duckdb.connect(str(build_path)) as connection:
        populate(connection, events)
    return publish_warehouse(build_path, final_path)


# Fake Neo4j driver


def network_rows() -> dict[str, list[dict]]:
    """Rows shaped like P4's three queries for the sample data, with neo4j.time.Date values.

    leader_country_graph returns one REPRESENTS row per dim_leader version (Sample Leader B
    has two, both for Japan); reciprocal_visits collects leader names, as in queries.cypher.
    """
    from neo4j.time import Date

    def nd(value: str) -> Date:
        return Date.from_native(_d(value))

    graph = []
    names = {leader["leader_id"]: leader["leader_name"] for leader in LEADERS}
    country_names = {}
    visited: dict[tuple[str, str], list[dict]] = {}
    for visit in VISITS:
        visited.setdefault((visit["leader_id"], visit["host_country"]["iso3_code"]), []).append(visit)
        country_names[visit["host_country"]["iso3_code"]] = visit["host_country"]["country_name"]
    for leader in LEADERS:
        for office in leader["offices"]:
            country_names[office["represented_country"]["iso3_code"]] = office["represented_country"]["country_name"]
    for leader in sorted(LEADERS, key=lambda item: item["leader_id"]):
        lid = leader["leader_id"]
        rows = []
        for office in leader["offices"]:
            iso3 = office["represented_country"]["iso3_code"]
            rows.append(("REPRESENTS", iso3, None, None, None, None))
        for (vid, iso3), visits in visited.items():
            if vid == lid:
                starts = sorted(v["start_date_key"] for v in visits)
                rows.append(("VISITED", iso3, len(visits), sum(v["duration_days"] for v in visits),
                             nd(starts[0]), nd(starts[-1])))
        for relation, iso3, n_visits, days, first, last in sorted(rows, key=lambda r: (r[0], r[1])):
            graph.append({"leader_id": lid, "leader_name": names[lid], "relation": relation, "iso3": iso3,
                          "country_name": country_names[iso3], "n_visits": n_visits, "days_on_site": days,
                          "first_visit": first, "last_visit": last})
    shared = [{"leader_a_id": "Q100001", "leader_a": names["Q100001"], "leader_b_id": "Q100003",
               "leader_b": names["Q100003"], "n_shared": 1, "shared_countries": ["JPN"]}]
    reciprocal = [{"country_a": "FRA", "country_b": "JPN",
                   "leaders_a_to_b": [names["Q100001"]], "leaders_b_to_a": [names["Q100002"]],
                   "first_a_to_b": nd("2025-03-10"), "first_b_to_a": nd("2025-05-20")}]
    return {"leader_country_graph": graph, "shared_destinations": shared, "reciprocal_visits": reciprocal}


class _Record:
    def __init__(self, data: dict):
        self._data = data

    def data(self) -> dict:
        return dict(self._data)


class FakeDriver:
    """Minimal stand-in for neo4j.Driver: session().execute_read(fn) with tx.run(query) records."""

    def __init__(self, rows_by_query_text: dict[str, list[dict]]):
        self.rows_by_query_text = rows_by_query_text
        self.queries_run: list[str] = []

    def session(self, **_):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute_read(self, function):
        return function(self)

    def run(self, query: str):
        self.queries_run.append(query)
        return [_Record(row) for row in self.rows_by_query_text[query]]


if __name__ == "__main__":
    target = Path(sys.argv[1])
    if target.exists():
        raise SystemExit(f"{target} exists, refusing to overwrite it")
    build_and_publish(target)
    print(f"wrote {target}")
