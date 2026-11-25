-- GDELT coverage indicators (P2-07), refreshed by quarantine.py when the GDELT staging tables exist.
-- "Rejected" = raw events of the day that did not reach stg_gdelt_event: dropped by the four staging rules
-- (warehouse/staging/gdelt.sql) or quarantined by the quality gate.

-- One row per event date: raw volume, kept volume, quarantined volume and the share rejected.
CREATE OR REPLACE VIEW v_quality_gdelt_daily AS
WITH raw AS (
    SELECT strptime(Day::VARCHAR, '%Y%m%d')::DATE AS event_date, count(*) AS raw_events
    FROM stg_gdelt_raw GROUP BY 1
),
kept AS (
    SELECT event_date, count(*) AS kept_events FROM stg_gdelt_event GROUP BY 1
),
quarantined AS (
    SELECT (row_data ->> 'event_date')::DATE AS event_date, count(*) AS quarantined_events
    FROM quality_quarantine WHERE table_name = 'stg_gdelt_event' GROUP BY 1
)
SELECT raw.event_date,
       raw.raw_events,
       coalesce(kept.kept_events, 0)               AS kept_events,
       coalesce(quarantined.quarantined_events, 0) AS quarantined_events,
       round(100 * (1 - coalesce(kept.kept_events, 0) / raw.raw_events), 2) AS pct_rejected
FROM raw
LEFT JOIN kept USING (event_date)
LEFT JOIN quarantined USING (event_date)
ORDER BY raw.event_date;

-- One row per country: kept events where it is actor 1 or actor 2, and the share of kept events involving it.
CREATE OR REPLACE VIEW v_quality_gdelt_country AS
WITH slots AS (
    SELECT actor1_country_code AS country_code, 1 AS as_actor1, 0 AS as_actor2 FROM stg_gdelt_event
    UNION ALL
    SELECT actor2_country_code, 0, 1 FROM stg_gdelt_event
)
SELECT country_code,
       count(*)       AS events,
       sum(as_actor1)::BIGINT AS as_actor1,
       sum(as_actor2)::BIGINT AS as_actor2,
       round(100 * count(*) / (SELECT count(*) FROM stg_gdelt_event), 2) AS pct_of_events
FROM slots
GROUP BY country_code
ORDER BY events DESC;
