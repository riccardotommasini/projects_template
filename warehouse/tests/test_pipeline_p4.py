"""P4 steps of the warehouse pipeline (DAG diplomap_build_warehouse), chained as P1 wires them.

Run from the repository root:

    pytest warehouse/tests/test_pipeline_p4.py

Requires: duckdb, pytest.

Functions to call, in this order, each with an open DuckDB connection on the warehouse; each one rebuilds its
output from scratch, so an Airflow retry is safe:

    production  warehouse.dimensions_and_facts.build_facts.build_fact_visit(con)
                    needs the dimensions and stg_visit (P3), stg_gdelt_event (P2); runs the visit_* quality rules
                [fact_gdelt_event, P2-09: events of the visitor-host pairs of fact_visit]
    serving     warehouse.views.build_views.build_views(con)          v_visit_event, v_kpi_visit
                warehouse.diplomatic_graph.sync.sync(con, driver)     Neo4j projection, see test_diplomatic_graph.py

Hand-made set: one valid visit France -> Japan (2025-03-10..12) and one visit of an unknown leader; a GDELT
"make a visit" during the stay, two events before and one after.
"""

import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from warehouse.dimensions_and_facts.build_facts import build_fact_visit  # noqa: E402
from warehouse.views.build_views import build_views  # noqa: E402

SEED = """
INSERT INTO dim_country (country_key, country_name, iso3_code, fips_code, cameo_code, region) VALUES
    (1, 'France', 'FRA', 'FR', 'FRA', NULL), (2, 'Japan', 'JPN', 'JA', 'JPN', NULL);
INSERT INTO dim_visit_type VALUES (1, 'state'), (2, 'unknown');
INSERT INTO dim_event_type VALUES (1, '042', '04', 1, TRUE), (2, '190', '19', 4, FALSE);
INSERT INTO dim_leader VALUES (1, 'Q1', 'Leader A', 'President', 1, DATE '2020-01-01', NULL);
INSERT INTO dim_date
SELECT CAST(d AS DATE), year(d), month(d), week(d), day(d)
FROM generate_series(DATE '2024-12-17', DATE '2025-07-15', INTERVAL 1 DAY) AS t(d);
CREATE TABLE stg_visit (leader_id VARCHAR, host_country_iso3 VARCHAR, start_date DATE, end_date DATE,
                        visit_type_label VARCHAR, is_multilateral BOOLEAN,
                        wiki_page_id BIGINT, wiki_revision_id BIGINT);
INSERT INTO stg_visit VALUES
    ('Q1', 'JPN', DATE '2025-03-10', DATE '2025-03-12', 'state', FALSE, 100, 1),
    ('Q9', 'JPN', DATE '2025-03-10', DATE '2025-03-12', 'state', FALSE, 100, 1);
CREATE TABLE stg_gdelt_event (event_date DATE, actor1_country_code VARCHAR, actor2_country_code VARCHAR,
                              event_code VARCHAR);
INSERT INTO stg_gdelt_event VALUES (DATE '2025-03-11', 'FRA', 'JPN', '042');
"""

# Stand-in for P2-09: the events of the France-Japan pair.
FACT_GDELT_EVENT = """
INSERT INTO fact_gdelt_event VALUES
    (1, DATE '2025-03-11', 1, 2, 1, 'u1', 1.0, 2.0, 5),     -- during the visit: in no window
    (2, DATE '2025-03-01', 1, 2, 1, 'u2', 1.0, 2.0, 5),     -- PRE, cooperative
    (3, DATE '2025-03-05', 2, 1, 2, 'u3', -5.0, -4.0, 5),   -- PRE, conflict
    (4, DATE '2025-03-20', 2, 1, 1, 'u4', 3.0, 1.0, 5);     -- POST, cooperative
"""

# visit, n_pre, n_post, coop_pre, coop_post, d_coop, tone_pre, tone_post, d_tone,
# goldstein_pre, goldstein_post, d_goldstein, is_low_volume, has_overlap
EXPECTED_KPI = [(1, 2, 1, 0.5, 1.0, 0.5, -1.0, 1.0, 2.0, -2.0, 3.0, 5.0, True, False)]


def run_p4(connection):
    build_fact_visit(connection)
    if connection.execute("SELECT count(*) FROM fact_gdelt_event").fetchone()[0] == 0:
        connection.execute(FACT_GDELT_EVENT)
    build_views(connection)


def test_p4_steps_chain_from_staging_to_kpi_and_can_rerun():
    connection = duckdb.connect()
    connection.execute((ROOT / "warehouse" / "dimensions_and_facts" / "schema.sql").read_text())
    connection.execute(SEED)

    run_p4(connection)
    assert connection.execute(
        "SELECT visit_key, leader_key, matched_in_gdelt FROM fact_visit").fetchall() == [(1, 1, True)]
    assert connection.execute(
        "SELECT rule_id FROM quality_quarantine").fetchall() == [("visit_01_leader_unknown",)]
    assert connection.execute("SELECT * FROM v_kpi_visit").fetchall() == EXPECTED_KPI

    run_p4(connection)   # Airflow retry
    assert connection.execute("SELECT * FROM v_kpi_visit").fetchall() == EXPECTED_KPI
    assert connection.execute(
        "SELECT run_id, rule_id FROM quality_quarantine ORDER BY run_id").fetchall() == [
        (1, "visit_01_leader_unknown"), (2, "visit_01_leader_unknown")]
