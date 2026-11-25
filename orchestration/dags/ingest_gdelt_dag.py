"""GDELT ingestion: download the event exports of a UTC day range into the raw landing zone.

Trigger with the parameters start_date and end_date (ISO dates, both included). The default is one month
inside the study period. Files already downloaded and valid are skipped, so a retry or a re-run is cheap.
The task fails if one file is missing or fails its size/MD5 check; the manifests are written either way.
"""

from datetime import date
from pathlib import Path

from airflow.sdk import DAG, Param, get_current_context, task
from assets import gdelt_landing
from pendulum import datetime

with DAG(
    dag_id="diplomap_ingest_gdelt",
    start_date=datetime(2024, 12, 17, tz="UTC"),
    schedule=None,
    catchup=False,
    params={
        "start_date": Param("2025-01-01", type="string", format="date"),
        "end_date": Param("2025-01-31", type="string", format="date"),
    },
    tags=["diplomap", "ingestion"],
) as dag:

    @task(outlets=[gdelt_landing], retries=1)
    def download_gdelt() -> dict:
        from ingestion.gdelt_events.spike_week import download_week, write_manifest
        from warehouse.pipeline_steps import gdelt_raw_dir

        params = get_current_context()["params"]
        start_day = date.fromisoformat(params["start_date"])
        end_day = date.fromisoformat(params["end_date"])
        if end_day < start_day:
            raise ValueError(f"end_date {end_day} is before start_date {start_day}")

        output_dir: Path = gdelt_raw_dir()
        output_dir.mkdir(parents=True, exist_ok=True)
        rows = download_week(output_dir, start_day, end_day, overwrite=False)
        write_manifest(output_dir, rows)
        failures = [row for row in rows if not row["integrity_ok"]]
        if not rows:
            raise RuntimeError(f"No GDELT export listed for {start_day} to {end_day}")
        if failures:
            raise RuntimeError(f"{len(failures)} of {len(rows)} GDELT files failed integrity checks")
        return {"files": len(rows), "start_date": str(start_day), "end_date": str(end_day)}

    download_gdelt()
