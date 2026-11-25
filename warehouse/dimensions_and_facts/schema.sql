/*
Star schema of DiploMap (DuckDB). Source of truth for column names and types:
the report (Figures 2 and 3) and the contracts in table_contracts/.

Two atomic fact tables (fact_visit, fact_gdelt_event) linked only through the
conformed dimensions dim_country and dim_date. The KPI layer (v_kpi_visit,
v_visit_event) is built on top of these tables and lives in warehouse/views/.

The script is a full rebuild: it drops the seven tables in reverse dependency
order, then recreates them. Everything is created in the default schema (main).
Constraints checked here are row-level rules; cross-table rules (for example
"visitor country = country represented by the leader") belong to the quality
gate (warehouse/quality_gate/checks.sql).
*/

DROP TABLE IF EXISTS fact_gdelt_event;
DROP TABLE IF EXISTS fact_visit;
DROP TABLE IF EXISTS dim_leader;
DROP TABLE IF EXISTS dim_event_type;
DROP TABLE IF EXISTS dim_visit_type;
DROP TABLE IF EXISTS dim_date;
DROP TABLE IF EXISTS dim_country;

/* Dimensions */

/* SCD Type 1. Played in four roles: visitor, host, actor 1, actor 2.
   CHAR(3) and CHAR(2) in the report; DuckDB does not enforce CHAR lengths,
   so VARCHAR plus a CHECK is used. */
CREATE TABLE dim_country (
    country_key   INTEGER NOT NULL PRIMARY KEY,
    country_name  VARCHAR NOT NULL,
    iso3_code     VARCHAR NOT NULL UNIQUE CHECK (length(iso3_code) = 3),
    fips_code     VARCHAR UNIQUE CHECK (fips_code IS NULL OR length(fips_code) = 2),
    cameo_code    VARCHAR UNIQUE CHECK (cameo_code IS NULL OR length(cameo_code) = 3),
    region        VARCHAR
);

/* Static calendar, one row per day from 2024-12-17 to 2025-07-15. */
CREATE TABLE dim_date (
    date_key  DATE NOT NULL PRIMARY KEY,
    year      INTEGER NOT NULL,
    month     INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    week      INTEGER NOT NULL CHECK (week BETWEEN 1 AND 53),   /* ISO week */
    day       INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31)
);

/* Static CAMEO taxonomy (version 1.1b3). Codes are strings: leading zeros matter. */
CREATE TABLE dim_event_type (
    event_type_key  INTEGER NOT NULL PRIMARY KEY,
    cameo_code      VARCHAR NOT NULL UNIQUE,
    root_code       VARCHAR NOT NULL CHECK (regexp_matches(root_code, '^(0[1-9]|1[0-9]|20)$')),
    quad_class      INTEGER NOT NULL CHECK (quad_class BETWEEN 1 AND 4),
    is_cooperative  BOOLEAN NOT NULL,
    CHECK (starts_with(cameo_code, root_code)),
    CHECK (is_cooperative = (quad_class IN (1, 2)))
);

/* Static closed list defined by the project. */
CREATE TABLE dim_visit_type (
    visit_type_key    INTEGER NOT NULL PRIMARY KEY,
    visit_type_label  VARCHAR NOT NULL UNIQUE
        CHECK (visit_type_label IN ('state', 'working', 'summit', 'ceremony', 'unknown'))
);

/* SCD Type 2: one row per leader and office period. valid_to is the last day
   in office (inclusive); NULL means the office is still held. */
CREATE TABLE dim_leader (
    leader_key               INTEGER NOT NULL PRIMARY KEY,
    leader_id                VARCHAR NOT NULL,          /* Wikidata QID */
    leader_name              VARCHAR NOT NULL,
    position_title           VARCHAR,
    represented_country_key  INTEGER NOT NULL REFERENCES dim_country (country_key),
    valid_from               DATE NOT NULL,
    valid_to                 DATE,
    UNIQUE (leader_id, valid_from),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

/* Facts */

/* Grain: one leader travelling to one host country on one trip. */
CREATE TABLE fact_visit (
    visit_key            BIGINT  NOT NULL PRIMARY KEY,
    leader_key           INTEGER NOT NULL REFERENCES dim_leader (leader_key),
    visitor_country_key  INTEGER NOT NULL REFERENCES dim_country (country_key),
    host_country_key     INTEGER NOT NULL REFERENCES dim_country (country_key),
    visit_type_key       INTEGER NOT NULL REFERENCES dim_visit_type (visit_type_key),
    start_date_key       DATE    NOT NULL REFERENCES dim_date (date_key),
    end_date_key         DATE    NOT NULL REFERENCES dim_date (date_key),
    duration_days        INTEGER NOT NULL,
    is_multilateral      BOOLEAN NOT NULL,
    matched_in_gdelt     BOOLEAN NOT NULL,
    wiki_page_id         BIGINT  NOT NULL,
    wiki_revision_id     BIGINT  NOT NULL,
    pre_window_start     DATE    NOT NULL,
    pre_window_end       DATE    NOT NULL,
    post_window_start    DATE    NOT NULL,
    post_window_end      DATE    NOT NULL,
    CHECK (start_date_key <= end_date_key),
    CHECK (visitor_country_key <> host_country_key),
    CHECK (duration_days = (end_date_key - start_date_key) + 1),
    CHECK (pre_window_start  = start_date_key - 15),
    CHECK (pre_window_end    = start_date_key - 1),
    CHECK (post_window_start = end_date_key + 1),
    CHECK (post_window_end   = end_date_key + 15)
);

/* Grain: one GDELT event between two different states. The visitor-host filter is in v_visit_event (C-02). */
CREATE TABLE fact_gdelt_event (
    gdelt_event_id      BIGINT  NOT NULL PRIMARY KEY,       /* GLOBALEVENTID */
    event_date_key      DATE    NOT NULL REFERENCES dim_date (date_key),
    actor1_country_key  INTEGER NOT NULL REFERENCES dim_country (country_key),
    actor2_country_key  INTEGER NOT NULL REFERENCES dim_country (country_key),
    event_type_key      INTEGER NOT NULL REFERENCES dim_event_type (event_type_key),
    source_url          VARCHAR,                            /* degenerate dimension */
    goldstein_scale     DOUBLE  NOT NULL CHECK (goldstein_scale BETWEEN -10 AND 10),
    avg_tone            DOUBLE  NOT NULL CHECK (avg_tone BETWEEN -100 AND 100),
    num_mentions        INTEGER NOT NULL CHECK (num_mentions >= 0),
    CHECK (actor1_country_key <> actor2_country_key)
);
