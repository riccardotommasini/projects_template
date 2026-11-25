"""Quality gate: run the rules of checks.sql, move invalid rows to quarantine, log every rule.

    python warehouse/quality_gate/quarantine.py --database data/warehouse/diplomap.duckdb

Each rule runs in its own transaction: its invalid rows are copied to quality_quarantine (reason + whole row as
JSON), deleted from their table, and one line is written to quality_log. Coverage indicators are the views of
indicators.sql, refreshed at the end of each run.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
CHECKS_SQL = HERE / "checks.sql"
INDICATORS_SQL = HERE / "indicators.sql"


def table_exists(connection: duckdb.DuckDBPyConnection, table: str) -> bool:
    return connection.execute(
        "SELECT count(*) FROM information_schema.tables WHERE table_name = ?", [table]
    ).fetchone()[0] > 0


def run(connection: duckdb.DuckDBPyConnection, tables: list[str] | None = None) -> list[dict]:
    """Run every declared rule (optionally only those of `tables`) and return one result per rule."""
    connection.execute(CHECKS_SQL.read_text())
    run_id = connection.execute("SELECT coalesce(max(run_id), 0) + 1 FROM quality_log").fetchone()[0]
    rules = connection.execute(
        "SELECT rule_id, table_name, description, invalid_when FROM quality_rule ORDER BY rule_id"
    ).fetchall()

    results = []
    for rule_id, table, reason, invalid_when in rules:
        if tables is not None and table not in tables:
            continue
        result = {"rule_id": rule_id, "table_name": table, "status": "table_missing",
                  "checked_rows": None, "failed_rows": None}
        connection.begin()
        try:
            if table_exists(connection, table):
                checked = connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
                connection.execute(
                    f"""
                    CREATE OR REPLACE TEMP TABLE quality_failed AS
                    SELECT rid, row_data FROM (
                        SELECT rowid AS rid, to_json(t) AS row_data, ({invalid_when}) AS invalid FROM {table} t
                    ) WHERE invalid
                    """
                )
                failed = connection.execute("SELECT count(*) FROM quality_failed").fetchone()[0]
                connection.execute(
                    """
                    INSERT INTO quality_quarantine
                    SELECT ?, ?, ?, ?, row_data, current_timestamp FROM quality_failed
                    """,
                    [run_id, rule_id, table, reason],
                )
                connection.execute(f"DELETE FROM {table} WHERE rowid IN (SELECT rid FROM quality_failed)")
                result.update(status="failed" if failed else "passed", checked_rows=checked, failed_rows=failed)
            connection.execute(
                "INSERT INTO quality_log VALUES (?, ?, ?, ?, ?, ?, current_timestamp)",
                [run_id, rule_id, table, result["status"], result["checked_rows"], result["failed_rows"]],
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        results.append(result)

    if table_exists(connection, "stg_gdelt_raw") and table_exists(connection, "stg_gdelt_event"):
        connection.execute(INDICATORS_SQL.read_text())
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database", type=Path, default=Path("data/warehouse/diplomap.duckdb"))
    parser.add_argument("--table", action="append", dest="tables", help="only the rules of this table (repeatable)")
    args = parser.parse_args()
    with duckdb.connect(str(args.database)) as connection:
        for result in run(connection, args.tables):
            print(f"{result['status']:>13}  {result['rule_id']:<30} {result['failed_rows'] or 0:>8} / "
                  f"{result['checked_rows'] or 0} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
