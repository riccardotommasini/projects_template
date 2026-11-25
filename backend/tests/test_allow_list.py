"""Allow-list of the DuckDB objects read by the API (task P1-13).

5. No statement reaches an object outside the allow-list (serving views, dimensions and
   the documented temporary fact_visit exception); fact_visit is read only by VISIT_SQL,
   through its listed columns; no SQL is built by string operations; the reader refuses
   any statement that is not one of the SQL constants of repository.py.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import duckdb
import pytest
import repository

REPOSITORY_FILE = Path(repository.__file__)
SQL_NAMES = {"LEADERS_SQL", "VISIT_SQL", "KPIS_SQL", "VISIT_EXISTS_SQL", "EVENTS_SQL"}
CTE_NAMES = {"visit"}   # names defined inside the statements themselves


def objects_read(sql: str) -> set[str]:
    """Objects referenced by a statement, as DuckDB's parser sees them (no database needed)."""
    names = duckdb.connect().get_table_names(sql.replace("?", "NULL"))
    return set(names) - CTE_NAMES


def test_registered_sql_is_exactly_the_sql_constants():
    assert repository.REGISTERED_SQL == {getattr(repository, name) for name in SQL_NAMES}


@pytest.mark.parametrize("name", sorted(SQL_NAMES))
def test_statement_reads_only_allow_listed_objects(name):
    used = objects_read(getattr(repository, name))
    assert used, name
    assert used <= repository.ALLOWED_OBJECTS, f"{name} reads {used - repository.ALLOWED_OBJECTS}"


def test_the_only_fact_table_is_the_documented_exception():
    facts = {o for o in repository.ALLOWED_OBJECTS if o.startswith("fact_")}
    assert facts == {"fact_visit"} == set(repository.FACT_EXCEPTIONS)
    assert all(o.startswith(("v_", "dim_", "fact_visit")) for o in repository.ALLOWED_OBJECTS)


def test_fact_visit_only_in_visit_sql_and_only_its_listed_columns():
    for name in SQL_NAMES - {"VISIT_SQL"}:
        assert "fact_visit" not in objects_read(getattr(repository, name)), name
    sql = repository.VISIT_SQL
    assert re.findall(r"\bfact_visit\s+AS\s+(\w+)", sql) == ["fv"], "fact_visit is read once, with alias fv"
    assert "fv.*" not in sql
    used = set(re.findall(r"\bfv\.(\w+)", sql))
    assert used <= repository.FACT_EXCEPTIONS["fact_visit"], used - repository.FACT_EXCEPTIONS["fact_visit"]


def test_sql_constants_are_plain_literals_and_execute_takes_no_built_sql():
    tree = ast.parse(REPOSITORY_FILE.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in SQL_NAMES for t in node.targets):
            assert isinstance(node.value, ast.Constant) and isinstance(node.value.value, str), ast.unparse(node)
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in {"execute", "query", "sql"}:
            sql_arg = node.args[1] if node.func.attr == "query" and len(node.args) > 1 else (node.args[0] if node.args else None)
            if sql_arg is None:
                continue
            assert not isinstance(sql_arg, ast.JoinedStr | ast.BinOp | ast.Call), (
                f"line {node.lineno}: SQL built at the call site: {ast.unparse(sql_arg)}"
            )
            if isinstance(sql_arg, ast.Constant):
                pytest.fail(f"line {node.lineno}: inline SQL, use a registered constant")


def test_reader_refuses_unregistered_sql(warehouse_file):
    reader = repository.WarehouseReader(warehouse_file)
    with reader.connect() as connection, pytest.raises(ValueError, match="only the SQL constants"):
        reader.query(connection, "SELECT * FROM fact_gdelt_event", [])
    with reader.connect() as connection, pytest.raises(ValueError, match="only the SQL constants"):
        reader.query(connection, repository.KPIS_SQL + " OR 1 = 1", [1])


def test_routes_run_only_registered_sql(warehouse_file, monkeypatch):
    """Every statement run by the six routes is a registered constant (spy on the reader)."""
    from conftest import warehouse_client

    client, source = warehouse_client(warehouse_file)
    run: list[str] = []
    original = repository.WarehouseReader.query

    def spy(connection, sql, params):
        run.append(sql)
        return original(connection, sql, params)

    monkeypatch.setattr(source.reader, "query", spy)
    for url in ["/leaders", "/visits", "/visits/1", "/visits/1/kpis", "/visits/1/events", "/network"]:
        assert client.get(url).status_code == 200, url
    assert run and set(run) <= repository.REGISTERED_SQL
    assert set(run) == repository.REGISTERED_SQL, "a constant is never used"
