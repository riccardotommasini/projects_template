-- v_visit_event: GDELT events attributed to a visit, one row per (visit, event). Rules fixed at C-02:
--   1. the pair is the visitor and host countries of the visit, in either direction (actor 1 or actor 2);
--   2. the pair is between countries, not leaders: any event between the two states counts;
--   3. multilateral visits are treated the same way: only the visitor-host pair, not the other participants;
--   4. overlapping windows are left as is: an event inside the windows of two visits is attributed to both.
-- An event is kept when its date is inside the PRE or the POST window; events during the visit days are not.

CREATE OR REPLACE VIEW v_visit_event AS
SELECT v.visit_key,
       e.gdelt_event_id,
       CASE WHEN e.event_date_key <= v.pre_window_end THEN 'PRE' ELSE 'POST' END   AS visit_window,
       -- Days from the visit: -15..-1 before the start, +1..+15 after the end.
       CASE WHEN e.event_date_key <= v.pre_window_end
            THEN e.event_date_key - v.start_date_key
            ELSE e.event_date_key - v.end_date_key END::INTEGER                   AS day_offset,
       e.event_date_key,
       e.actor1_country_key,
       e.actor2_country_key,
       e.event_type_key,
       t.cameo_code,
       t.is_cooperative,
       e.goldstein_scale,
       e.avg_tone,
       e.num_mentions,
       e.source_url
FROM fact_visit v
JOIN fact_gdelt_event e
  ON ((e.actor1_country_key = v.visitor_country_key AND e.actor2_country_key = v.host_country_key)
   OR (e.actor1_country_key = v.host_country_key    AND e.actor2_country_key = v.visitor_country_key))
 AND (e.event_date_key BETWEEN v.pre_window_start  AND v.pre_window_end
   OR e.event_date_key BETWEEN v.post_window_start AND v.post_window_end)
JOIN dim_event_type t ON t.event_type_key = e.event_type_key;
