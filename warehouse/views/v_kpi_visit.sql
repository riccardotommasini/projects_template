-- v_kpi_visit: one row per visit, PRE vs POST indicators computed on v_visit_event.
-- Reading of the measures: warehouse/profiling/gdelt_measures.md (P2-11).
--   tone       = media tone of the articles that reported the events, not the tone of the relationship;
--   goldstein  = mix of event types, not their intensity; a visit mechanically adds cooperative events;
--   coop_share = share of cooperative events (quad class 1-2); same signal as Goldstein, easier to read.
-- Means are per event (not weighted by mentions). A window with no event gives NULL means and NULL deltas.

CREATE OR REPLACE VIEW v_kpi_visit AS
WITH w AS (
    SELECT v.visit_key,
           count(e.gdelt_event_id) FILTER (WHERE e.visit_window = 'PRE')        AS n_events_pre,
           count(e.gdelt_event_id) FILTER (WHERE e.visit_window = 'POST')       AS n_events_post,
           avg(e.avg_tone)         FILTER (WHERE e.visit_window = 'PRE')        AS tone_pre,
           avg(e.avg_tone)         FILTER (WHERE e.visit_window = 'POST')       AS tone_post,
           avg(e.goldstein_scale)  FILTER (WHERE e.visit_window = 'PRE')        AS goldstein_pre,
           avg(e.goldstein_scale)  FILTER (WHERE e.visit_window = 'POST')       AS goldstein_post,
           avg(e.is_cooperative::INTEGER) FILTER (WHERE e.visit_window = 'PRE')  AS coop_share_pre,
           avg(e.is_cooperative::INTEGER) FILTER (WHERE e.visit_window = 'POST') AS coop_share_post
    FROM fact_visit v
    LEFT JOIN v_visit_event e ON e.visit_key = v.visit_key
    GROUP BY v.visit_key
)
SELECT w.visit_key,
       w.n_events_pre,
       w.n_events_post,
       w.coop_share_pre,
       w.coop_share_post,
       w.coop_share_post - w.coop_share_pre                                 AS delta_coop_share,
       w.tone_pre,
       w.tone_post,
       w.tone_post - w.tone_pre                                             AS delta_tone,
       w.goldstein_pre,
       w.goldstein_post,
       w.goldstein_post - w.goldstein_pre                                   AS delta_goldstein,
       -- ponytail: threshold of 10 events proposed in gdelt_measures.md, to revisit on the real visits.
       least(w.n_events_pre, w.n_events_post) < 10                          AS is_low_volume,
       -- Another visit of the same country pair (either direction) whose PRE..POST span meets this one:
       -- some events are attributed to both visits and their effects cannot be separated.
       EXISTS (
           SELECT 1
           FROM fact_visit o
           WHERE o.visit_key <> v.visit_key
             AND least(o.visitor_country_key, o.host_country_key)    = least(v.visitor_country_key, v.host_country_key)
             AND greatest(o.visitor_country_key, o.host_country_key) = greatest(v.visitor_country_key, v.host_country_key)
             AND o.pre_window_start <= v.post_window_end
             AND v.pre_window_start <= o.post_window_end
       )                                                                    AS has_overlap
FROM w
JOIN fact_visit v ON v.visit_key = w.visit_key;
