-- BQ1. Where did each leader travel, and how often?
-- This query lists each leader's destination countries, visit count, and total days spent there.
select l.leader_name,
       c.country_name as host_country,
       count(*) as n_visits,
       sum(v.duration_days) as days_on_site
  from fact_visit v
  join dim_leader l
on l.leader_key = v.leader_key
  join dim_country c
on c.country_key = v.host_country_key
 group by l.leader_id,
          l.leader_name,
          c.country_name
 order by l.leader_name,
          n_visits desc;

-- BQ2. How did the media tone of bilateral GDELT events change before and after each visit?
-- This query compares the average media tone and number of bilateral events before and after each visit.
with w as (
   select visit_key,
          window_period,
          sum(n_events) as n_events,
          sum(sum_avg_tone) / nullif(
             sum(n_events),
             0
          ) as mean_avg_tone
     from kpi_visit_day
    group by visit_key,
             window_period
)
select l.leader_name,
       c.country_name as host_country,
       v.start_date_key,
       pr.mean_avg_tone as tone_pre,
       po.mean_avg_tone as tone_post,
       po.mean_avg_tone - pr.mean_avg_tone as delta_avg_tone,
       pr.n_events as n_pre,
       po.n_events as n_post
  from fact_visit v
  join w pr
on pr.visit_key = v.visit_key
   and pr.window_period = 'PRE'
  join w po
on po.visit_key = v.visit_key
   and po.window_period = 'POST'
  join dim_leader l
on l.leader_key = v.leader_key
  join dim_country c
on c.country_key = v.host_country_key
 order by delta_avg_tone desc nulls last;

-- BQ3. How did the cooperative or conflictual character of bilateral events change?
-- This query measures how cooperation (n_cooperative) and conflict indicators (sum_goldstein) changed between the pre-visit and post-visit periods.
with w as (
   select visit_key,
          window_period,
          sum(n_events) as n_events,
          sum(sum_goldstein) / nullif(
             sum(n_events),
             0
          ) as mean_goldstein,
          sum(n_cooperative) * 1.0 / nullif(
             sum(n_events),
             0
          ) as coop_share
     from kpi_visit_day
    group by visit_key,
             window_period
)
select l.leader_name,
       c.country_name as host_country,
       v.start_date_key,
       po.mean_goldstein - pr.mean_goldstein as delta_goldstein,
       po.coop_share - pr.coop_share as delta_coop_share,
       pr.n_events as n_pre,
       po.n_events as n_post
  from fact_visit v
  join w pr
on pr.visit_key = v.visit_key
   and pr.window_period = 'PRE'
  join w po
on po.visit_key = v.visit_key
   and po.window_period = 'POST'
  join dim_leader l
on l.leader_key = v.leader_key
  join dim_country c
on c.country_key = v.host_country_key
 order by delta_goldstein desc nulls last;

-- BQ4. Which bilateral events occurred around a visit, and which source URLs are attached?
-- This query returns the bilateral events surrounding a visit (parameter :visit_key), including their indicators and source URLs.
select case
   when e.event_date_key between v.pre_window_start and v.pre_window_end   then
      'PRE'
   when e.event_date_key between v.post_window_start and v.post_window_end then
      'POST'
       end as window_period,
       e.event_date_key,
       t.cameo_code,
       t.quad_class,
       e.goldstein_scale,
       e.avg_tone,
       e.num_mentions,
       e.source_url
  from fact_visit v
  join fact_gdelt_event e
on ( e.event_date_key between v.pre_window_start and v.pre_window_end
    or e.event_date_key between v.post_window_start and v.post_window_end )
   and ( ( e.actor1_country_key = v.visitor_country_key
   and e.actor2_country_key = v.host_country_key )
    or ( e.actor1_country_key = v.host_country_key
   and e.actor2_country_key = v.visitor_country_key ) )
  join dim_event_type t
on t.event_type_key = e.event_type_key
 where v.visit_key = :visit_key
 order by e.event_date_key,
          e.num_mentions desc;

-- BQ5. How are leaders and countries connected through travel?
/**
Leader–country network: edges of the Network view 
The Network view reads a graph projected from the star schema: one Leader node 
per person and one Country node per country, linked by (Leader)-[:REPRESENTS]->(Country) 
and (Leader)-[:VISITED {n_visits, first_visit}]->(Country), built from the BQ5 edge list. 
Like the KPI table, it is derived and can be rebuilt at any time. 
**/
select l.leader_id,
       l.leader_name,
       cv.country_name as from_country,
       ch.country_name as to_country,
       count(*) as n_visits,
       min(v.start_date_key) as first_visit
  from fact_visit v
  join dim_leader l
on l.leader_key = v.leader_key
  join dim_country cv
on cv.country_key = v.visitor_country_key
  join dim_country ch
on ch.country_key = v.host_country_key
 group by l.leader_id,
          l.leader_name,
          cv.country_name,
          ch.country_name; 



-- Besides the graph, we could also look at the reciprocal visits between pairs of countries. 
select ca.country_name as country_a,
       cb.country_name as country_b,
       v1.start_date_key as visit_a_to_b,
       v2.start_date_key as return_visit_b_to_a
  from fact_visit v1
  join fact_visit v2
on v2.visitor_country_key = v1.host_country_key
   and v2.host_country_key = v1.visitor_country_key
   and v2.start_date_key > v1.start_date_key
  join dim_country ca
on ca.country_key = v1.visitor_country_key
  join dim_country cb
on cb.country_key = v1.host_country_key
 order by visit_a_to_b;


-- KPI table: one row per visit and per day in its PRE and POST windows.
-- Each visit receives 15 PRE rows (before arrival) and 15 POST rows (after departure),
-- including days without matching events so that aggregate means remain exact.
-- n_events is counting the number of bilateral events on that day, depending on GDELT some events could be counted multiple times if they have multiple mentions

/** 

FOR EACH visit IN fact_visit:

    DEFINE the PRE window:
        from 15 days before the visit arrival date
        to 1 day before the visit arrival date

    DEFINE the POST window:
        from 1 day after the visit departure date
        to 15 days after the visit departure date

    FOR EACH day IN the PRE window:

        SET window_period = "PRE"
        SET day_offset = number of days between the day and the arrival date
        -- day_offset values: -15, -14, ..., -1

        FIND all GDELT events:
            - occurring on this day
            - whose actors are the visitor and the host
            - in either direction:
                visitor -> host
                host -> visitor

        AGGREGATE the events:
            n_events = number of events
            sum_avg_tone = sum of the average tones
            sum_goldstein = sum of the Goldstein scales
            n_cooperative = number of cooperative events

        IF no event exists:
            SET all aggregate values to zero

        SET is_window_overlapping = FALSE

        FOR EACH other_visit IN fact_visit:

            SKIP the current visit

            IF the two visits involve the same pair of countries,
            regardless of direction,
            AND the current day belongs to the other visit's PRE or POST window:
                SET is_window_overlapping = TRUE
                STOP checking other visits

        INSERT one row into kpi_visit_day


    FOR EACH day IN the POST window:

        SET window_period = "POST"
        SET day_offset = number of days between the day and the departure date
        -- day_offset values: 1, 2, ..., 15

        FIND all GDELT events:
            - occurring on this day
            - whose actors are the visitor and the host
            - in either direction:
                visitor -> host
                host -> visitor

        AGGREGATE the events:
            n_events = number of events
            sum_avg_tone = sum of the average tones
            sum_goldstein = sum of the Goldstein scales
            n_cooperative = number of cooperative events

        IF no event exists:
            SET all aggregate values to zero

        SET is_window_overlapping = FALSE

        FOR EACH other_visit IN fact_visit:

            SKIP the current visit

            IF the two visits involve the same pair of countries,
            regardless of direction,
            AND the current day belongs to the other visit's PRE or POST window:
                SET is_window_overlapping = TRUE
                STOP checking other visits

        INSERT one row into kpi_visit_day

    **/