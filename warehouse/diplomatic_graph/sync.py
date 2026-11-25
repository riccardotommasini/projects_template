"""Project the travel relationships of the warehouse into Neo4j (full rebuild).

    NEO4J_PASSWORD=... python warehouse/diplomatic_graph/sync.py --database data/warehouse/warehouse_build.duckdb

The graph is derived from fact_visit and the dimensions, and rebuilt from scratch on each run:
    (:Country {country_key, iso3, name, region})
    (:Leader  {leader_id, name})
    (:Leader)-[:REPRESENTS {position_title, valid_from, valid_to}]->(:Country)        one per dim_leader version
    (:Leader)-[:VISITED {n_visits, days_on_site, first_visit, last_visit}]->(:Country) one per leader and host
Read queries of the Network view: queries.cypher, loaded with network_queries().
Reads the build file (read-only), so the graph matches the warehouse about to be published.

Requires: duckdb, and neo4j for sync() and the command line.
Connection: NEO4J_URI (default bolt://localhost:7687), NEO4J_USER (default neo4j), NEO4J_PASSWORD.
"""

from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

import duckdb

QUERIES_CYPHER = Path(__file__).with_name("queries.cypher")

EXPORT_SQL = {
    "countries": """
        SELECT country_key, iso3_code AS iso3, country_name AS name, region
        FROM dim_country ORDER BY country_key""",
    "leaders": """
        SELECT leader_id, arg_max(leader_name, valid_from) AS name   -- name of the latest version
        FROM dim_leader GROUP BY leader_id ORDER BY leader_id""",
    "represents": """
        SELECT leader_id, represented_country_key AS country_key, position_title, valid_from, valid_to
        FROM dim_leader ORDER BY leader_id, valid_from""",
    "visited": """
        SELECT l.leader_id, v.host_country_key AS country_key,
               count(*) AS n_visits, sum(v.duration_days) AS days_on_site,
               min(v.start_date_key) AS first_visit, max(v.start_date_key) AS last_visit
        FROM fact_visit v JOIN dim_leader l ON l.leader_key = v.leader_key
        GROUP BY ALL ORDER BY ALL""",
}

CONSTRAINTS = [
    "CREATE CONSTRAINT country_key IF NOT EXISTS FOR (c:Country) REQUIRE c.country_key IS UNIQUE",
    "CREATE CONSTRAINT leader_id IF NOT EXISTS FOR (l:Leader) REQUIRE l.leader_id IS UNIQUE",
]

LOAD_CYPHER = [
    ("countries", "UNWIND $rows AS r CREATE (c:Country) SET c = r"),
    ("leaders", "UNWIND $rows AS r CREATE (l:Leader) SET l = r"),
    ("represents", """
        UNWIND $rows AS r
        MATCH (l:Leader {leader_id: r.leader_id}), (c:Country {country_key: r.country_key})
        CREATE (l)-[:REPRESENTS {position_title: r.position_title, valid_from: r.valid_from, valid_to: r.valid_to}]->(c)"""),
    ("visited", """
        UNWIND $rows AS r
        MATCH (l:Leader {leader_id: r.leader_id}), (c:Country {country_key: r.country_key})
        CREATE (l)-[:VISITED {n_visits: r.n_visits, days_on_site: r.days_on_site,
                              first_visit: r.first_visit, last_visit: r.last_visit}]->(c)"""),
]


def export(connection: duckdb.DuckDBPyConnection) -> dict[str, list[dict]]:
    """Rows of each node and relationship type, read from DuckDB."""
    rows = {}
    for name, sql in EXPORT_SQL.items():
        cursor = connection.execute(sql)
        columns = [d[0] for d in cursor.description]
        rows[name] = [dict(zip(columns, values)) for values in cursor.fetchall()]
    return rows


def sync(connection: duckdb.DuckDBPyConnection, driver: neo4j.Driver) -> dict[str, int]:
    """Replace the Leader/Country graph with the current warehouse content; return the row count per type."""
    rows = export(connection)
    with driver.session() as session:
        for statement in CONSTRAINTS:   # schema changes cannot share the data transaction
            session.run(statement).consume()

        def rebuild(tx):
            # One transaction: a failed load leaves the previous graph in place.
            tx.run("MATCH (n) WHERE n:Leader OR n:Country DETACH DELETE n").consume()
            for name, statement in LOAD_CYPHER:
                tx.run(statement, rows=rows[name]).consume()

        session.execute_write(rebuild)
    return {name: len(values) for name, values in rows.items()}


def network_queries() -> dict[str, str]:
    """Named read queries of queries.cypher, for the network route of the API."""
    parts = re.split(r"^// name: (\w+)\s*$", QUERIES_CYPHER.read_text(), flags=re.MULTILINE)
    return {parts[i]: parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database", type=Path, default=Path("data/warehouse/warehouse_build.duckdb"))
    args = parser.parse_args()
    from neo4j import GraphDatabase

    auth = (os.environ.get("NEO4J_USER", "neo4j"), os.environ["NEO4J_PASSWORD"])
    with duckdb.connect(str(args.database), read_only=True) as connection, \
            GraphDatabase.driver(os.environ.get("NEO4J_URI", "bolt://localhost:7687"), auth=auth) as driver:
        print(sync(connection, driver))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
