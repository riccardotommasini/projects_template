"""Warehouse build, triggered only after all three landing assets are updated.

Every task that writes to DuckDB runs in the duckdb_writer pool (one slot) and targets the build file; the last
tasks publish it atomically as diplomap.duckdb, then refresh the Neo4j graph. The steps are the functions of
warehouse/pipeline_steps.py. build_production is skipped while P2/P3 have not delivered stg_visit.
"""

from contextlib import contextmanager

import duckdb
from airflow.sdk import DAG, task
from pendulum import datetime

try:
    from airflow.sdk.exceptions import AirflowSkipException
except ImportError:  # older Airflow layout
    from airflow.exceptions import AirflowSkipException

from assets import gdelt_landing, wikidata_landing, wikipedia_landing


@contextmanager
def build_connection():
    """Open the build file for writing and always close it: an unclean close leaves a .wal and blocks publication."""
    from warehouse.pipeline_steps import build_path

    connection = duckdb.connect(str(build_path()))
    try:
        yield connection
    finally:
        connection.close()


with DAG(
    dag_id="diplomap_build_warehouse",
    start_date=datetime(2024, 12, 17, tz="UTC"),
    schedule=[gdelt_landing, wikipedia_landing, wikidata_landing],
    catchup=False,
    tags=["diplomap", "warehouse"],
) as dag:

    @task(pool="duckdb_writer")
    def start_build() -> str:
        from warehouse import pipeline_steps

        return str(pipeline_steps.start_build())

    @task(pool="duckdb_writer")
    def staging() -> dict:
        from warehouse import pipeline_steps as steps

        with build_connection() as connection:
            steps.create_star_schema(connection)
            steps.build_dimensions(connection)
            metrics = steps.load_gdelt_staging(connection, steps.gdelt_raw_dir())
            metrics["stg_gdelt_event_rows"] = steps.build_gdelt_event(connection)
            steps.build_visit_staging(connection)
            steps.run_staging_gate(connection)
        return metrics

    @task(pool="duckdb_writer")
    def production() -> int:
        from warehouse import pipeline_steps as steps

        with build_connection() as connection:
            try:
                return steps.build_production(connection)
            except steps.UpstreamNotReady as error:
                raise AirflowSkipException(str(error)) from error

    @task(pool="duckdb_writer")
    def serving() -> None:
        from warehouse import pipeline_steps as steps

        with build_connection() as connection:
            steps.build_serving(connection)

    @task(pool="duckdb_writer")
    def publish() -> str:
        from warehouse import pipeline_steps

        return str(pipeline_steps.publish())

    @task
    def sync_graph() -> dict:
        from warehouse import pipeline_steps

        return pipeline_steps.sync_graph()

    start_build() >> staging() >> production() >> serving() >> publish() >> sync_graph()
