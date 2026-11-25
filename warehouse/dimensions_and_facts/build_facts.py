"""Load the fact tables: build the candidate rows, run the quality gate on them, insert the valid ones.

    python warehouse/dimensions_and_facts/build_facts.py --database data/warehouse/warehouse_build.duckdb

Needs schema.sql, the dimensions, stg_visit (P3) and stg_gdelt_event (P2) in the database.
Writes to the build file only; warehouse/publish.py (P1-11) publishes it as diplomap.duckdb.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "quality_gate"))
import quarantine as gate  # noqa: E402

FACT_VISIT_SQL = HERE / "fact_visit.sql"


def build_fact_visit(connection: duckdb.DuckDBPyConnection) -> int:
    """Rebuild fact_visit from stg_visit and return its row count."""
    connection.execute(FACT_VISIT_SQL.read_text())
    return load_fact_visit(connection)


def load_fact_visit(connection: duckdb.DuckDBPyConnection) -> int:
    """Run the visit_* quality rules on stg_fact_visit, then replace fact_visit with the valid rows."""
    gate.run(connection, ["stg_fact_visit"])
    connection.execute("DELETE FROM fact_visit")
    # visit_key: deterministic order, so the same input always gives the same keys.
    connection.execute(
        """
        INSERT INTO fact_visit
        SELECT row_number() OVER (ORDER BY start_date_key, leader_id, host_country_iso3),
               leader_key, visitor_country_key, host_country_key, visit_type_key,
               start_date_key, end_date_key, duration_days, is_multilateral, matched_in_gdelt,
               wiki_page_id, wiki_revision_id,
               pre_window_start, pre_window_end, post_window_start, post_window_end
        FROM stg_fact_visit
        """
    )
    return connection.execute("SELECT count(*) FROM fact_visit").fetchone()[0]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database", type=Path, default=Path("data/warehouse/warehouse_build.duckdb"))
    args = parser.parse_args()
    with duckdb.connect(str(args.database)) as connection:
        print(f"fact_visit: {build_fact_visit(connection)} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
