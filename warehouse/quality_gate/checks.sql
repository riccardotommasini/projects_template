-- Quality gate: declared rules and the tables the gate writes to.
-- Run by warehouse/quality_gate/quarantine.py before the facts are loaded.
--
-- A rule = one row of quality_rule. invalid_when is a SQL predicate on one row of table_name that is TRUE when the
-- row is invalid; it may use window functions (e.g. uniqueness). A NULL result counts as valid, so test NULLs
-- explicitly. Rules run in rule_id order and each one removes its rows before the next runs.
-- Each owner declares the rules of their own tables (P3-09, P4-02); P2 owns the mechanism and the GDELT rules.

CREATE TABLE IF NOT EXISTS quality_rule (
    rule_id       VARCHAR PRIMARY KEY,
    table_name    VARCHAR NOT NULL,
    owner         VARCHAR NOT NULL,
    description   VARCHAR NOT NULL,   -- the reason written to quarantine
    invalid_when  VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS quality_quarantine (
    run_id          INTEGER   NOT NULL,
    rule_id         VARCHAR   NOT NULL,
    table_name      VARCHAR   NOT NULL,
    reason          VARCHAR   NOT NULL,
    row_data        JSON      NOT NULL,   -- the whole rejected row
    quarantined_at  TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS quality_log (
    run_id        INTEGER   NOT NULL,
    rule_id       VARCHAR   NOT NULL,
    table_name    VARCHAR   NOT NULL,
    status        VARCHAR   NOT NULL,   -- passed | failed | table_missing
    checked_rows  BIGINT,
    failed_rows   BIGINT,
    run_at        TIMESTAMP NOT NULL
);

-- Result of the latest run, one line per rule.
CREATE OR REPLACE VIEW v_quality_last_run AS
SELECT * FROM quality_log WHERE run_id = (SELECT max(run_id) FROM quality_log) ORDER BY rule_id;

-- GDELT (P2), on stg_gdelt_event. Mirrors the constraints of fact_gdelt_event so that loading it never fails.
INSERT OR REPLACE INTO quality_rule VALUES
('gdelt_01_id_missing', 'stg_gdelt_event', 'P2', 'GLOBALEVENTID is missing',
    $$gdelt_event_id IS NULL$$),
('gdelt_02_id_duplicate', 'stg_gdelt_event', 'P2', 'GLOBALEVENTID already seen (first reported row kept)',
    $$row_number() OVER (PARTITION BY gdelt_event_id ORDER BY date_added, source_file) > 1$$),
('gdelt_03_date_out_of_range', 'stg_gdelt_event', 'P2', 'Event date missing or outside 2024-12-17..2025-07-15 (dim_date)',
    $$event_date IS NULL OR event_date NOT BETWEEN DATE '2024-12-17' AND DATE '2025-07-15'$$),
('gdelt_04_country_invalid', 'stg_gdelt_event', 'P2', 'Actor country missing, not a 3-letter code, or the same on both sides',
    $$actor1_country_code IS NULL OR actor2_country_code IS NULL
      OR NOT regexp_full_match(actor1_country_code, '[A-Z]{3}') OR NOT regexp_full_match(actor2_country_code, '[A-Z]{3}')
      OR actor1_country_code = actor2_country_code$$),
('gdelt_05_event_code_invalid', 'stg_gdelt_event', 'P2', 'CAMEO code missing, malformed, or not under its root code',
    $$event_code IS NULL OR event_root_code IS NULL
      OR NOT regexp_full_match(event_code, '[0-9]{2,4}')
      OR NOT regexp_full_match(event_root_code, '0[1-9]|1[0-9]|20')
      OR NOT starts_with(event_code, event_root_code)$$),
('gdelt_06_quad_class_invalid', 'stg_gdelt_event', 'P2', 'QuadClass missing or outside 1..4',
    $$quad_class IS NULL OR quad_class NOT BETWEEN 1 AND 4$$),
('gdelt_07_goldstein_invalid', 'stg_gdelt_event', 'P2', 'Goldstein missing or outside -10..10',
    $$goldstein_scale IS NULL OR goldstein_scale NOT BETWEEN -10 AND 10$$),
('gdelt_08_tone_invalid', 'stg_gdelt_event', 'P2', 'AvgTone missing or outside -100..100',
    $$avg_tone IS NULL OR avg_tone NOT BETWEEN -100 AND 100$$),
('gdelt_09_mentions_invalid', 'stg_gdelt_event', 'P2', 'NumMentions missing or negative',
    $$num_mentions IS NULL OR num_mentions < 0$$);

-- Visits (P4), on stg_fact_visit (warehouse/dimensions_and_facts/fact_visit.sql). Mirrors the constraints of
-- fact_visit plus the scope of the study, so that loading it never fails.
INSERT OR REPLACE INTO quality_rule VALUES
('visit_01_leader_unknown', 'stg_fact_visit', 'P4', 'No dim_leader version valid on the first day of the visit',
    $$leader_key IS NULL$$),
('visit_02_host_unknown', 'stg_fact_visit', 'P4', 'Host country missing or not in dim_country',
    $$host_country_key IS NULL$$),
('visit_03_same_country', 'stg_fact_visit', 'P4', 'Host country is the country of the visiting leader',
    $$visitor_country_key = host_country_key$$),
('visit_04_dates_invalid', 'stg_fact_visit', 'P4', 'Start or end date missing, or end before start',
    $$start_date_key IS NULL OR end_date_key IS NULL OR end_date_key < start_date_key$$),
('visit_05_out_of_scope', 'stg_fact_visit', 'P4', 'Start outside 2025-01-01..2025-06-30 or end after 2025-07-15 (dim_date)',
    $$start_date_key NOT BETWEEN DATE '2025-01-01' AND DATE '2025-06-30' OR end_date_key > DATE '2025-07-15'$$),
('visit_06_field_missing', 'stg_fact_visit', 'P4', 'is_multilateral or Wikipedia lineage (page, revision) missing',
    $$is_multilateral IS NULL OR wiki_page_id IS NULL OR wiki_revision_id IS NULL$$),
('visit_07_duplicate', 'stg_fact_visit', 'P4', 'Same leader, host and start date already seen (latest revision kept)',
    $$row_number() OVER (PARTITION BY leader_id, host_country_key, start_date_key ORDER BY wiki_revision_id DESC) > 1$$);
-- To add when dim_country and dim_event_type exist (P3-10): country and CAMEO codes known by the dimensions.
