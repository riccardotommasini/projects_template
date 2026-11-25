/*
Structural tests of the star schema. Convention: each test is a SELECT that
returns one row per violation, so zero rows means the test passes.
Each test starts with a marker comment of the form: test: name
Run through warehouse/tests/test_star_schema.py after loading schema.sql.
*/

/* test: all_tables_exist */
SELECT expected.t AS missing_table
FROM (VALUES ('dim_country'), ('dim_date'), ('dim_event_type'), ('dim_leader'),
             ('dim_visit_type'), ('fact_visit'), ('fact_gdelt_event')) AS expected(t)
WHERE expected.t NOT IN (SELECT table_name FROM duckdb_tables() WHERE schema_name = 'main');

/* test: every_table_has_a_primary_key */
SELECT table_name
FROM duckdb_tables()
WHERE schema_name = 'main'
  AND table_name NOT IN (SELECT table_name FROM duckdb_constraints()
                         WHERE constraint_type = 'PRIMARY KEY');

/* test: expected_foreign_keys_exist */
SELECT e.child AS child_table, e.parent AS parent_table, e.n AS expected_count
FROM (VALUES ('dim_leader', 'dim_country', 1),
             ('fact_visit', 'dim_leader', 1),
             ('fact_visit', 'dim_country', 2),
             ('fact_visit', 'dim_visit_type', 1),
             ('fact_visit', 'dim_date', 2),
             ('fact_gdelt_event', 'dim_date', 1),
             ('fact_gdelt_event', 'dim_country', 2),
             ('fact_gdelt_event', 'dim_event_type', 1)) AS e(child, parent, n)
WHERE e.n <> (SELECT count(*) FROM duckdb_constraints() c
              WHERE c.constraint_type = 'FOREIGN KEY'
                AND c.table_name = e.child
                AND c.referenced_table = e.parent);

/* test: no_foreign_key_points_outside_the_model */
SELECT table_name, referenced_table
FROM duckdb_constraints()
WHERE constraint_type = 'FOREIGN KEY'
  AND referenced_table NOT IN (SELECT table_name FROM duckdb_tables() WHERE schema_name = 'main');
