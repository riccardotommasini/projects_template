"""Create the serving views on top of fact_visit and fact_gdelt_event, in the build file
(warehouse/publish.py publishes it as diplomap.duckdb).

    python warehouse/views/build_views.py --database data/warehouse/warehouse_build.duckdb
"""

from __future__ import annotations

import argparse
from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
VIEWS = ["v_visit_event", "v_kpi_visit"]   # dependency order


def build_views(connection: duckdb.DuckDBPyConnection) -> None:
    """Create or replace every serving view."""
    for view in VIEWS:
        connection.execute((HERE / f"{view}.sql").read_text())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database", type=Path, default=Path("data/warehouse/warehouse_build.duckdb"))
    args = parser.parse_args()
    with duckdb.connect(str(args.database)) as connection:
        build_views(connection)
    print(f"views: {', '.join(VIEWS)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
