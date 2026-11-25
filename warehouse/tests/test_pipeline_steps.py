"""Tests for the warehouse pipeline steps (warehouse/pipeline_steps.py), chained as the DAG chains them.

Run from the repository root:

    pytest warehouse/tests/test_pipeline_steps.py

Requires: duckdb, psutil, pytest.

On a data directory holding the GDELT regression archive: the build runs up to the serving views, publishes
diplomap.duckdb atomically, and a second run gives the same result. build_production refuses to run while P3's
stg_visit does not exist.
"""

import shutil
import sys
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from warehouse import pipeline_steps as steps

ARCHIVE = ROOT / "warehouse" / "tests" / "fixtures" / "gdelt_regression" / "regression.export.CSV.zip"


@pytest.fixture
def data_root(tmp_path):
    day = tmp_path / "raw_landing" / "gdelt" / "2025-01-15"
    day.mkdir(parents=True)
    shutil.copy(ARCHIVE, day / "20250115000000.export.CSV.zip")
    (tmp_path / "warehouse").mkdir()
    return tmp_path


def run_build(root):
    steps.start_build(root)
    with duckdb.connect(str(steps.build_path(root))) as connection:
        steps.create_star_schema(connection)
        steps.build_dimensions(connection)
        metrics = steps.load_gdelt_staging(connection, steps.gdelt_raw_dir(root))
        events = steps.build_gdelt_event(connection)
        steps.build_visit_staging(connection)
        steps.run_staging_gate(connection)
        with pytest.raises(steps.UpstreamNotReady, match="stg_visit"):
            steps.build_production(connection)
        steps.build_serving(connection)
    return metrics, events


def test_build_runs_to_the_serving_views_and_publishes(data_root):
    metrics, events = run_build(data_root)

    assert metrics["files_processed"] == 1
    assert metrics["rows_loaded"] > 0
    assert events > 0
    assert steps.publish(data_root) == steps.final_path(data_root)
    assert not steps.build_path(data_root).exists()
    with duckdb.connect(str(steps.final_path(data_root)), read_only=True) as connection:
        assert connection.execute("SELECT count(*) FROM stg_gdelt_event").fetchone()[0] == events
        assert connection.execute("SELECT count(*) FROM v_kpi_visit").fetchone()[0] == 0


def test_rebuild_gives_the_same_result(data_root):
    first = run_build(data_root)
    steps.publish(data_root)
    second = run_build(data_root)

    assert first[1] == second[1]
    assert first[0]["rows_loaded"] == second[0]["rows_loaded"]


def test_gdelt_staging_fails_without_archives(tmp_path):
    with duckdb.connect() as connection, pytest.raises(FileNotFoundError):
        steps.load_gdelt_staging(connection, tmp_path)


def test_placeholder_sql_file_is_a_noop(tmp_path):
    placeholder = tmp_path / "placeholder.sql"
    placeholder.write_text("-- This script will be written later.\n")
    with duckdb.connect() as connection:
        steps.run_sql_file(connection, placeholder)
