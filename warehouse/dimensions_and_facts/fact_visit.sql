-- stg_visit + dimensions -> stg_fact_visit: candidate rows of fact_visit, before the quality gate.
-- Built by build_facts.build_fact_visit(), which then runs the P4 rules of checks.sql and loads fact_visit.
--
-- Input expected from P3 (staging of the Wikipedia trips), one row per trip and host country:
--   stg_visit(leader_id VARCHAR      -- Wikidata QID
--             host_country_iso3 VARCHAR, start_date DATE, end_date DATE,
--             visit_type_label VARCHAR, is_multilateral BOOLEAN,
--             wiki_page_id BIGINT, wiki_revision_id BIGINT)
-- A missing key gives a NULL here on purpose: the gate quarantines the row with its reason instead of dropping it.

CREATE OR REPLACE TABLE stg_fact_visit AS
SELECT v.leader_id,
       v.host_country_iso3,
       l.leader_key,                                    -- version valid on the first day of the visit
       l.represented_country_key                        AS visitor_country_key,
       h.country_key                                    AS host_country_key,
       coalesce(t.visit_type_key, u.visit_type_key)     AS visit_type_key,   -- unlisted label -> 'unknown'
       v.start_date                                     AS start_date_key,
       v.end_date                                       AS end_date_key,
       (v.end_date - v.start_date) + 1                  AS duration_days,
       v.is_multilateral,
       -- Visit also coded in GDELT: CAMEO 042 (make a visit) or 043 (host a visit), same pair in either order,
       -- event date inside the visit days.
       EXISTS (
           SELECT 1
           FROM stg_gdelt_event e
           JOIN dim_country a1 ON a1.cameo_code = e.actor1_country_code
           JOIN dim_country a2 ON a2.cameo_code = e.actor2_country_code
           WHERE e.event_code IN ('042', '043')
             AND e.event_date BETWEEN v.start_date AND v.end_date
             AND ((a1.country_key = l.represented_country_key AND a2.country_key = h.country_key)
               OR (a2.country_key = l.represented_country_key AND a1.country_key = h.country_key))
       )                                                AS matched_in_gdelt,
       v.wiki_page_id,
       v.wiki_revision_id,
       v.start_date - 15                                AS pre_window_start,
       v.start_date - 1                                 AS pre_window_end,
       v.end_date + 1                                   AS post_window_start,
       v.end_date + 15                                  AS post_window_end
FROM stg_visit v
LEFT JOIN dim_leader l
       ON l.leader_id = v.leader_id
      AND v.start_date BETWEEN l.valid_from AND coalesce(l.valid_to, DATE '9999-12-31')
LEFT JOIN dim_country h    ON h.iso3_code = v.host_country_iso3
LEFT JOIN dim_visit_type t ON t.visit_type_label = v.visit_type_label
CROSS JOIN (SELECT visit_type_key FROM dim_visit_type WHERE visit_type_label = 'unknown') u;
