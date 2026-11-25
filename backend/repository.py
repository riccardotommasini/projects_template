"""Data access of the DiploMap API (task P1-13): sample payloads, DuckDB warehouse, Neo4j graph.

Two sources implement the same methods; DIPLOMAP_API_MODE picks one at startup:
  - SampleSource ("sample", the default): the contract payloads of examples.py;
  - WarehouseSource ("warehouse"): the published DuckDB warehouse, and Neo4j for the network.

DuckDB rules:
  - Only the objects of ALLOWED_OBJECTS are read, through the SQL constants of this
    module (REGISTERED_SQL). Values are bound as ? parameters; no SQL is built from a
    request. WarehouseReader.query refuses any other statement.
  - The file is opened read-only, one connection per request, closed after it.
  - Publication safety (P1-11): DuckDB shares one database instance per process, so a
    new connection still sees the OLD file while any connection to it is open. Each
    request therefore checks the file identity (st_dev, st_ino). When the file was
    replaced, new requests wait until the in-flight requests of the previous file are
    done, then open fresh connections on the new file. A wait longer than the drain
    timeout (DIPLOMAP_DRAIN_TIMEOUT_S, default 10 s) answers 503.

Neo4j rules: the Cypher text is never copied here; it is read from
warehouse/diplomatic_graph/queries.cypher through P4's network_queries(). Neo4j dates are
returned as ISO 8601 strings.

Environment: DIPLOMAP_API_MODE, DIPLOMAP_WAREHOUSE_PATH, DIPLOMAP_DRAIN_TIMEOUT_S,
NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD.
"""

from __future__ import annotations

import os
import threading
import time
from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager
from datetime import date
from typing import Any, Protocol

import duckdb
from examples import LEADERS, NETWORK, VISIT, VISIT_EVENTS, VISIT_KPIS, VISITS

DEFAULT_WAREHOUSE_PATH = "/data/warehouse/diplomap.duckdb"
DEFAULT_DRAIN_TIMEOUT_S = 10.0
DEFAULT_NEO4J_URI = "bolt://localhost:7687"


class NotFound(Exception):
    """The requested visit does not exist (HTTP 404)."""


class Unavailable(Exception):
    """The warehouse file or Neo4j cannot answer (HTTP 503)."""


# Allow-list of the DuckDB objects the API may read.

SERVING_VIEWS = frozenset({"v_visit_event", "v_kpi_visit"})
DIMENSIONS = frozenset({"dim_country", "dim_leader", "dim_visit_type"})

# TEMPORARY EXCEPTION (decided in P1-13): the visit routes need the visit attributes
# (leader, countries, type, dates, windows, lineage) and no serving view exposes them yet.
# fact_visit is read directly, these columns only, in VISIT_SQL only. Remove this entry
# when P4 publishes a serving view v_visit with its contract: VISIT_SQL then reads it.
FACT_EXCEPTIONS: Mapping[str, frozenset[str]] = {
    "fact_visit": frozenset({
        "visit_key", "leader_key", "visitor_country_key", "host_country_key", "visit_type_key",
        "start_date_key", "end_date_key", "duration_days", "is_multilateral", "matched_in_gdelt",
        "wiki_page_id", "wiki_revision_id",
        "pre_window_start", "pre_window_end", "post_window_start", "post_window_end",
    }),
}

ALLOWED_OBJECTS = SERVING_VIEWS | DIMENSIONS | frozenset(FACT_EXCEPTIONS)


# SQL constants: the only statements the API runs.

LEADERS_SQL = """
SELECT l.leader_id, l.leader_name, l.position_title, l.valid_from, l.valid_to,
       c.iso3_code, c.country_name
FROM dim_leader AS l
JOIN dim_country AS c ON c.country_key = l.represented_country_key
ORDER BY l.leader_id, l.valid_from
"""

# One statement for the visit list and the visit detail. The CTE "visit" is the only
# place that reads fact_visit (TEMPORARY EXCEPTION above). Once v_visit exists, its body
# becomes: SELECT * FROM v_visit
VISIT_SQL = """
WITH visit AS (
    SELECT fv.visit_key, l.leader_id, l.leader_name, l.position_title,
           vc.iso3_code AS visitor_iso3_code, vc.country_name AS visitor_country_name,
           hc.iso3_code AS host_iso3_code, hc.country_name AS host_country_name,
           t.visit_type_label, fv.start_date_key, fv.end_date_key, fv.duration_days,
           fv.is_multilateral, fv.matched_in_gdelt,
           fv.pre_window_start, fv.pre_window_end, fv.post_window_start, fv.post_window_end,
           fv.wiki_page_id, fv.wiki_revision_id
    FROM fact_visit AS fv
    JOIN dim_leader AS l ON l.leader_key = fv.leader_key
    JOIN dim_country AS vc ON vc.country_key = fv.visitor_country_key
    JOIN dim_country AS hc ON hc.country_key = fv.host_country_key
    JOIN dim_visit_type AS t ON t.visit_type_key = fv.visit_type_key
)
SELECT *
FROM visit
WHERE (CAST(? AS VARCHAR) IS NULL OR leader_id = ?)
  AND (CAST(? AS BIGINT) IS NULL OR visit_key = ?)
ORDER BY start_date_key, visit_key
"""

KPIS_SQL = """
SELECT visit_key, n_events_pre, n_events_post,
       coop_share_pre, coop_share_post, delta_coop_share,
       tone_pre, tone_post, delta_tone,
       goldstein_pre, goldstein_post, delta_goldstein,
       is_low_volume, has_overlap
FROM v_kpi_visit
WHERE visit_key = ?
"""

# v_kpi_visit holds one row per visit, with or without events: it tells whether a visit exists.
VISIT_EXISTS_SQL = """
SELECT count(*) AS n FROM v_kpi_visit WHERE visit_key = ?
"""

EVENTS_SQL = """
SELECT e.visit_key, e.gdelt_event_id, e.visit_window, e.day_offset, e.event_date_key,
       a1.iso3_code AS actor1_iso3_code, a1.country_name AS actor1_country_name,
       a2.iso3_code AS actor2_iso3_code, a2.country_name AS actor2_country_name,
       e.cameo_code, e.is_cooperative, e.goldstein_scale, e.avg_tone, e.num_mentions, e.source_url
FROM v_visit_event AS e
JOIN dim_country AS a1 ON a1.country_key = e.actor1_country_key
JOIN dim_country AS a2 ON a2.country_key = e.actor2_country_key
WHERE e.visit_key = ?
ORDER BY e.event_date_key, e.gdelt_event_id
"""

REGISTERED_SQL = frozenset({LEADERS_SQL, VISIT_SQL, KPIS_SQL, VISIT_EXISTS_SQL, EVENTS_SQL})


# Readers


class WarehouseReader:
    """Read-only access to the published DuckDB file, safe across atomic replacements."""

    def __init__(self, path: str | os.PathLike, drain_timeout: float = DEFAULT_DRAIN_TIMEOUT_S):
        if drain_timeout <= 0:
            raise ValueError("drain_timeout must be positive")
        self.path = os.fspath(path)
        self.drain_timeout = drain_timeout
        self._condition = threading.Condition()
        self._identity: tuple[int, int] | None = None   # file in use by the in-flight requests
        self._in_flight = 0

    def _file_identity(self) -> tuple[int, int]:
        try:
            status = os.stat(self.path)
        except FileNotFoundError:
            raise Unavailable(f"warehouse file not found: {self.path}") from None
        return status.st_dev, status.st_ino

    @contextmanager
    def connect(self) -> Iterator[duckdb.DuckDBPyConnection]:
        """One short-lived read-only connection, opened on the current file."""
        identity = self._file_identity()
        deadline = time.monotonic() + self.drain_timeout
        with self._condition:
            # A replaced file: let the requests of the previous file finish first, so that
            # DuckDB releases its cached instance and the new connection opens the new file.
            while self._in_flight and self._identity != identity:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise Unavailable("the warehouse is being replaced, retry in a moment")
                self._condition.wait(remaining)
            self._identity = identity
            self._in_flight += 1
        try:
            try:
                connection = duckdb.connect(self.path, read_only=True)
            except duckdb.Error as error:
                raise Unavailable(f"cannot open the warehouse {self.path}: {error}") from error
            try:
                yield connection
            finally:
                connection.close()
        finally:
            with self._condition:
                self._in_flight -= 1
                self._condition.notify_all()

    @staticmethod
    def query(connection: duckdb.DuckDBPyConnection, sql: str, params: list[Any]) -> list[dict[str, Any]]:
        """Run one registered statement with bound parameters; rows as dicts."""
        if sql not in REGISTERED_SQL:
            raise ValueError("only the SQL constants of repository.py may run")
        try:
            cursor = connection.execute(sql, params)
            columns = [d[0] for d in cursor.description]
            return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]
        except duckdb.Error as error:
            raise Unavailable(f"the warehouse cannot answer: {error}") from error


def _iso(value: Any) -> str | None:
    """Neo4j or Python date to an ISO 8601 string."""
    if value is None:
        return None
    if hasattr(value, "iso_format"):   # neo4j.time.Date
        return value.iso_format()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


class Neo4jReader:
    """Runs P4's named read queries of queries.cypher."""

    def __init__(
        self,
        uri: str,
        user: str,
        password: str | None,
        driver: Any = None,
        queries: Callable[[], dict[str, str]] | None = None,
    ):
        self.uri, self.user, self.password = uri, user, password
        self._driver = driver
        self._queries = queries
        self._lock = threading.Lock()

    def _load_queries(self) -> dict[str, str]:
        if self._queries is None:
            try:
                from warehouse.diplomatic_graph.sync import network_queries
            except ImportError as error:
                raise Unavailable(f"P4 network queries not reachable (warehouse/ on PYTHONPATH?): {error}") from error
            self._queries = network_queries
        return self._queries()

    def _get_driver(self) -> Any:
        with self._lock:
            if self._driver is None:
                if not self.password:
                    raise Unavailable("Neo4j is not configured (NEO4J_PASSWORD is not set)")
                from neo4j import GraphDatabase

                # Short timeouts: execute_read retries for 30 s by default, so a Neo4j outage
                # would hold every /network request that long before the 503.
                self._driver = GraphDatabase.driver(
                    self.uri, auth=(self.user, self.password),
                    connection_timeout=3, connection_acquisition_timeout=5, max_transaction_retry_time=2,
                )
            return self._driver

    def run_all(self, names: list[str]) -> dict[str, list[dict[str, Any]]]:
        """Run the named queries in one read session; rows as dicts."""
        queries = self._load_queries()
        missing = [name for name in names if name not in queries]
        if missing:
            raise Unavailable(f"queries.cypher has no query named {', '.join(missing)}")
        from neo4j.exceptions import DriverError, Neo4jError

        try:
            with self._get_driver().session() as session:
                return {
                    name: session.execute_read(lambda tx, q=queries[name]: [r.data() for r in tx.run(q)])
                    for name in names
                }
        except (DriverError, Neo4jError, OSError) as error:
            raise Unavailable(f"Neo4j is unavailable at {self.uri}: {error}") from error


# Sources


class Source(Protocol):
    def leaders(self) -> list[dict[str, Any]]: ...
    def visits(self, leader_id: str | None) -> list[dict[str, Any]]: ...
    def visit(self, visit_key: int) -> dict[str, Any]: ...
    def visit_kpis(self, visit_key: int) -> dict[str, Any]: ...
    def visit_events(self, visit_key: int) -> list[dict[str, Any]]: ...
    def network(self) -> dict[str, Any]: ...


class SampleSource:
    """The contract samples. Only visit 1 has a detail, kpis and events sample."""

    def _sampled(self, visit_key: int, payload: Any) -> Any:
        if visit_key == VISIT["visit_key"]:
            return payload
        if any(v["visit_key"] == visit_key for v in VISITS):
            raise NotFound(f"no sample for visit {visit_key}")
        raise NotFound(f"no visit with visit_key {visit_key}")

    def leaders(self):
        return LEADERS

    def visits(self, leader_id):
        return [v for v in VISITS if leader_id is None or v["leader_id"] == leader_id]

    def visit(self, visit_key):
        return self._sampled(visit_key, VISIT)

    def visit_kpis(self, visit_key):
        return self._sampled(visit_key, VISIT_KPIS)

    def visit_events(self, visit_key):
        return self._sampled(visit_key, VISIT_EVENTS)

    def network(self):
        return NETWORK


SUMMARY_FIELDS = (
    "visit_key", "leader_id", "leader_name", "visitor_country", "host_country", "visit_type_label",
    "start_date_key", "end_date_key", "duration_days", "is_multilateral", "matched_in_gdelt",
)


def _visit_payload(row: dict[str, Any]) -> dict[str, Any]:
    payload = {key: value for key, value in row.items() if not key.startswith(("visitor_", "host_"))}
    payload["visitor_country"] = {"iso3_code": row["visitor_iso3_code"], "country_name": row["visitor_country_name"]}
    payload["host_country"] = {"iso3_code": row["host_iso3_code"], "country_name": row["host_country_name"]}
    return payload


def _event_payload(row: dict[str, Any]) -> dict[str, Any]:
    payload = {key: value for key, value in row.items() if not key.startswith(("actor1_", "actor2_"))}
    for actor in ("actor1", "actor2"):
        payload[f"{actor}_country"] = {
            "iso3_code": row[f"{actor}_iso3_code"], "country_name": row[f"{actor}_country_name"]
        }
    return payload


NETWORK_QUERIES = ["leader_country_graph", "shared_destinations", "reciprocal_visits"]


def network_payload(rows: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """Shape the rows of P4's three network queries into the Network contract."""
    leaders: dict[str, str] = {}
    countries: dict[str, str] = {}
    edges = []
    seen_represents = set()
    for row in rows["leader_country_graph"]:
        leaders[row["leader_id"]] = row["leader_name"]
        countries[row["iso3"]] = row["country_name"]
        if row["relation"] == "REPRESENTS":
            # One REPRESENTS relationship per dim_leader version in the graph: one edge per leader and country.
            key = (row["leader_id"], row["iso3"])
            if key in seen_represents:
                continue
            seen_represents.add(key)
            edges.append({"source": row["leader_id"], "target": row["iso3"], "type": "REPRESENTS",
                          "n_visits": None, "first_visit": None})
        else:
            edges.append({"source": row["leader_id"], "target": row["iso3"], "type": row["relation"],
                          "n_visits": row["n_visits"], "first_visit": _iso(row["first_visit"])})
    nodes = [{"id": i, "type": "leader", "label": leaders[i], "iso3_code": None} for i in sorted(leaders)]
    nodes += [{"id": c, "type": "country", "label": countries[c], "iso3_code": c} for c in sorted(countries)]

    shared = [
        {"leader_a_id": r["leader_a_id"], "leader_b_id": r["leader_b_id"],
         "n_shared": r["n_shared"], "shared_countries": list(r["shared_countries"])}
        for r in rows["shared_destinations"]
    ]

    # TODO(remove when the query returns ids): reciprocal_visits collects leader names; map them
    # back to ids through the graph rows and refuse an ambiguous or unknown name.
    ids_by_name: dict[str, set[str]] = {}
    for leader_id, name in leaders.items():
        ids_by_name.setdefault(name, set()).add(leader_id)

    def ids_of(names: list[str]) -> list[str]:
        result = set()
        for name in names:
            ids = ids_by_name.get(name, set())
            if len(ids) != 1:
                raise Unavailable(
                    f"reciprocal_visits: leader name {name!r} matches {len(ids)} leader ids; "
                    "the query must return leader ids"
                )
            result |= ids
        return sorted(result)

    reciprocal = [
        {"country_a": r["country_a"], "country_b": r["country_b"],
         "leaders_a_to_b": ids_of(r["leaders_a_to_b"]), "leaders_b_to_a": ids_of(r["leaders_b_to_a"]),
         "first_a_to_b": _iso(r["first_a_to_b"]), "first_b_to_a": _iso(r["first_b_to_a"])}
        for r in rows["reciprocal_visits"]
    ]
    return {"nodes": nodes, "edges": edges, "shared_destinations": shared, "reciprocal_visits": reciprocal}


class WarehouseSource:
    """The published DuckDB warehouse, and Neo4j for the network."""

    def __init__(self, reader: WarehouseReader, graph: Neo4jReader):
        self.reader = reader
        self.graph = graph

    def _rows(self, sql: str, params: list[Any]) -> list[dict[str, Any]]:
        with self.reader.connect() as connection:
            return self.reader.query(connection, sql, params)

    def leaders(self):
        leaders: dict[str, dict[str, Any]] = {}
        for row in self._rows(LEADERS_SQL, []):
            leader = leaders.setdefault(row["leader_id"], {"leader_id": row["leader_id"], "offices": []})
            leader["leader_name"] = row["leader_name"]   # rows ordered by valid_from: the latest version wins
            leader["offices"].append({
                "position_title": row["position_title"],
                "represented_country": {"iso3_code": row["iso3_code"], "country_name": row["country_name"]},
                "valid_from": row["valid_from"],
                "valid_to": row["valid_to"],
            })
        return [
            {"leader_id": v["leader_id"], "leader_name": v["leader_name"], "offices": v["offices"]}
            for v in leaders.values()
        ]

    def visits(self, leader_id):
        rows = self._rows(VISIT_SQL, [leader_id, leader_id, None, None])
        payloads = [_visit_payload(row) for row in rows]
        return [{key: payload[key] for key in SUMMARY_FIELDS} for payload in payloads]

    def visit(self, visit_key):
        rows = self._rows(VISIT_SQL, [None, None, visit_key, visit_key])
        if not rows:
            raise NotFound(f"no visit with visit_key {visit_key}")
        return _visit_payload(rows[0])

    def visit_kpis(self, visit_key):
        rows = self._rows(KPIS_SQL, [visit_key])
        if not rows:
            raise NotFound(f"no visit with visit_key {visit_key}")
        return rows[0]

    def visit_events(self, visit_key):
        with self.reader.connect() as connection:
            if not self.reader.query(connection, VISIT_EXISTS_SQL, [visit_key])[0]["n"]:
                raise NotFound(f"no visit with visit_key {visit_key}")
            rows = self.reader.query(connection, EVENTS_SQL, [visit_key])
        return [_event_payload(row) for row in rows]

    def network(self):
        return network_payload(self.graph.run_all(NETWORK_QUERIES))


def source_from_env(environ: Mapping[str, str] = os.environ) -> SampleSource | WarehouseSource:
    """Build the source selected by DIPLOMAP_API_MODE (sample or warehouse). Fails on any other value."""
    mode = environ.get("DIPLOMAP_API_MODE", "sample").strip().lower()
    if mode == "sample":
        return SampleSource()
    if mode != "warehouse":
        raise ValueError(f"DIPLOMAP_API_MODE must be sample or warehouse, not {mode!r}")
    raw_timeout = environ.get("DIPLOMAP_DRAIN_TIMEOUT_S", str(DEFAULT_DRAIN_TIMEOUT_S))
    try:
        drain_timeout = float(raw_timeout)
    except ValueError:
        raise ValueError(f"DIPLOMAP_DRAIN_TIMEOUT_S must be a number of seconds, not {raw_timeout!r}") from None
    reader = WarehouseReader(environ.get("DIPLOMAP_WAREHOUSE_PATH", DEFAULT_WAREHOUSE_PATH), drain_timeout)
    graph = Neo4jReader(
        environ.get("NEO4J_URI", DEFAULT_NEO4J_URI),
        environ.get("NEO4J_USER", "neo4j"),
        environ.get("NEO4J_PASSWORD") or None,
    )
    return WarehouseSource(reader, graph)
