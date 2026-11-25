"""Steps of the warehouse pipeline (DAG diplomap_build_warehouse), as plain functions.

The DAG only chains these functions, so they can be run and tested without Airflow. Every step that writes to
DuckDB takes an open connection on the build file (never on the published file) and rebuilds its output from
scratch, so an Airflow retry is safe. Order:

    start_build            delete the stale build file                          (publish.py, P1-11)
    create_star_schema     schema.sql: the seven star schema tables
    build_dimensions       dimensions.sql                                       (P2/P3 content)
    load_gdelt_staging     raw GDELT archives -> stg_gdelt_raw                  (P2)
    build_gdelt_event      gdelt.sql: stg_gdelt_raw -> stg_gdelt_event          (P2)
    build_visit_staging    leaders.sql, visits.sql: stg_leader, stg_visit       (P3)
    run_staging_gate       quality gate on the staging tables
    build_production       fact_visit (+ quality gate), then facts.sql          (P4, P2-09)
    build_serving          v_visit_event, v_kpi_visit                           (P4)
    publish                atomic swap of the build file as diplomap.duckdb     (P1-11)
    sync_graph             Neo4j projection read from the published file        (P4-05)

Wikipedia and Wikidata ingestion (P2, P3) are not wired here: until their pipelines are merged,
dimensions.sql, leaders.sql, visits.sql and facts.sql are placeholders, stg_visit does not exist, and
build_production raises UpstreamNotReady instead of building an empty fact_visit.
"""

from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

import duckdb

from warehouse.dimensions_and_facts.build_facts import build_fact_visit
from warehouse.publish import prepare_build_path, publish_warehouse
from warehouse.quality_gate import quarantine as gate
from warehouse.staging import load_gdelt_raw
from warehouse.views.build_views import build_views

HERE = Path(__file__).resolve().parent
FACTS_DIR = HERE / "dimensions_and_facts"
STAGING_DIR = HERE / "staging"

# Staging tables that the gate must not touch at this stage: stg_fact_visit is checked by build_fact_visit,
# the raw GDELT tables are loaded as is.
GATE_EXCLUDED = {"stg_fact_visit", "stg_gdelt_raw", "stg_gdelt_raw_rejects"}


class UpstreamNotReady(RuntimeError):
    """An input table owned by another pipeline (P2, P3) does not exist yet."""


def data_dir() -> Path:
    return Path(os.environ.get("DIPLOMAP_DATA_DIR", "/data"))


def gdelt_raw_dir(root: Path | None = None) -> Path:
    return (root or data_dir()) / "raw_landing" / "gdelt"


def build_path(root: Path | None = None) -> Path:
    return (root or data_dir()) / "warehouse" / "warehouse_build.duckdb"


def final_path(root: Path | None = None) -> Path:
    return (root or data_dir()) / "warehouse" / "diplomap.duckdb"


def table_exists(connection: duckdb.DuckDBPyConnection, table: str) -> bool:
    return gate.table_exists(connection, table)


def run_sql_file(connection: duckdb.DuckDBPyConnection, path: Path) -> None:
    """Execute a SQL script; a file that only holds comments (a placeholder not delivered yet) is a no-op."""
    script = path.read_text()
    if any(line.strip() and not line.strip().startswith("--") for line in script.splitlines()):
        connection.execute(script)


def start_build(root: Path | None = None) -> Path:
    return prepare_build_path(build_path(root), final_path=final_path(root))


def create_star_schema(connection: duckdb.DuckDBPyConnection) -> None:
    run_sql_file(connection, FACTS_DIR / "schema.sql")


def build_dimensions(connection: duckdb.DuckDBPyConnection) -> None:
    run_sql_file(connection, FACTS_DIR / "dimensions.sql")


def load_gdelt_staging(connection: duckdb.DuckDBPyConnection, raw_dir: Path) -> dict:
    """Load every raw GDELT archive under raw_dir into stg_gdelt_raw and return the load metrics."""
    archives = sorted(raw_dir.glob("*/*.export.CSV.zip"))
    if not archives:
        raise FileNotFoundError(f"No GDELT archives found under {raw_dir}")
    started = time.perf_counter()
    load_gdelt_raw.create_schema(connection)
    with tempfile.TemporaryDirectory(prefix="gdelt_load_") as temporary:
        file_results = [load_gdelt_raw.load_archive(connection, a, Path(temporary)) for a in archives]
    return {
        "files_processed": len(archives),
        "rows_loaded": connection.execute(f"SELECT count(*) FROM {load_gdelt_raw.TABLE_NAME}").fetchone()[0],
        "unreadable_rows": sum(r["read_errors"] for r in file_results),
        "elapsed_seconds": round(time.perf_counter() - started, 3),
    }


def build_gdelt_event(connection: duckdb.DuckDBPyConnection) -> int:
    run_sql_file(connection, STAGING_DIR / "gdelt.sql")
    return connection.execute("SELECT count(*) FROM stg_gdelt_event").fetchone()[0]


def build_visit_staging(connection: duckdb.DuckDBPyConnection) -> None:
    for script in ("leaders.sql", "visits.sql"):
        run_sql_file(connection, STAGING_DIR / script)


def run_staging_gate(connection: duckdb.DuckDBPyConnection) -> list[dict]:
    tables = [
        row[0]
        for row in connection.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'stg\\_%' ESCAPE '\\'"
        ).fetchall()
        if row[0] not in GATE_EXCLUDED
    ]
    return gate.run(connection, tables) if tables else []


def build_production(connection: duckdb.DuckDBPyConnection) -> int:
    """Build fact_visit (quality gate included) and fact_gdelt_event; return the fact_visit row count."""
    missing = [t for t in ("stg_visit", "stg_gdelt_event") if not table_exists(connection, t)]
    if missing:
        raise UpstreamNotReady(f"missing input table(s): {', '.join(missing)}")
    visits = build_fact_visit(connection)
    run_sql_file(connection, FACTS_DIR / "facts.sql")
    return visits


def build_serving(connection: duckdb.DuckDBPyConnection) -> None:
    build_views(connection)


def publish(root: Path | None = None) -> Path:
    return publish_warehouse(build_path(root), final_path(root))


def sync_graph(root: Path | None = None) -> dict[str, int]:
    """Replace the Neo4j Leader/Country graph with the published warehouse (NEO4J_* environment variables)."""
    from neo4j import GraphDatabase

    from warehouse.diplomatic_graph.sync import sync

    auth = (os.environ.get("NEO4J_USER", "neo4j"), os.environ["NEO4J_PASSWORD"])
    with duckdb.connect(str(final_path(root)), read_only=True) as connection, \
            GraphDatabase.driver(os.environ.get("NEO4J_URI", "bolt://localhost:7687"), auth=auth) as driver:
        return sync(connection, driver)
