"""Testable skeleton for the Wikipedia ingestion pipeline."""

from airflow.providers.standard.operators.empty import EmptyOperator
from airflow.sdk import DAG, task
from pendulum import datetime

from assets import wikipedia_landing


with DAG(
    dag_id="diplomap_ingest_wikipedia",
    start_date=datetime(2024, 12, 17, tz="UTC"),
    schedule=None,
    catchup=False,
    tags=["diplomap", "ingestion"],
) as dag:
    start = EmptyOperator(task_id="start")

    @task(outlets=[wikipedia_landing])
    def test_imports() -> None:
        import ingestion
        import warehouse

        assert ingestion is not None
        assert warehouse is not None

    finish = EmptyOperator(task_id="finish")
    start >> test_imports() >> finish
