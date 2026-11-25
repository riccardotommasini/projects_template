-- stg_gdelt_raw -> stg_gdelt_event: the four GDELT rules accepted at C-06.
-- Options, numbers and effect on volume: warehouse/profiling/gdelt_rules.md.

CREATE OR REPLACE TABLE stg_gdelt_event AS
WITH typed AS (
    SELECT *,
           strptime(Day::VARCHAR, '%Y%m%d')::DATE              AS event_date,
           strptime(DATEADDED::VARCHAR, '%Y%m%d%H%M%S')        AS date_added
    FROM stg_gdelt_raw
),
kept AS (
    SELECT *
    FROM typed
    -- R1: two different states. CAMEO region and city codes (first 28 rows of DB/CAMEO.country.txt) are not states.
    WHERE Actor1CountryCode IS NOT NULL
      AND Actor2CountryCode IS NOT NULL
      AND Actor1CountryCode <> Actor2CountryCode
      AND Actor1CountryCode NOT IN ('WSB', 'BAG', 'GZS', 'AFR', 'ASA', 'BLK', 'CRB', 'CAU', 'CFR', 'CAS', 'CEU', 'EIN', 'EAF', 'EEU',
                                    'EUR', 'LAM', 'MEA', 'MDT', 'NAF', 'NMR', 'PGS', 'SCN', 'SAM', 'SAS', 'SEA', 'SAF', 'WAF', 'WST')
      AND Actor2CountryCode NOT IN ('WSB', 'BAG', 'GZS', 'AFR', 'ASA', 'BLK', 'CRB', 'CAU', 'CFR', 'CAS', 'CEU', 'EIN', 'EAF', 'EEU',
                                    'EUR', 'LAM', 'MEA', 'MDT', 'NAF', 'NMR', 'PGS', 'SCN', 'SAM', 'SAS', 'SEA', 'SAF', 'WAF', 'WST')
      -- R2: reference date = Day; inside the study period (visit windows, ±15 days around Jan-Jun 2025);
      --     reported at most 30 days after it happened.
      AND event_date BETWEEN DATE '2024-12-17' AND DATE '2025-07-15'
      AND date_diff('day', event_date, date_added::DATE) <= 30
      -- R3: noise filter.
      AND NumMentions >= 2
)
SELECT GlobalEventID          AS gdelt_event_id,
       event_date,
       date_added,
       Actor1CountryCode      AS actor1_country_code,
       Actor2CountryCode      AS actor2_country_code,
       EventCode              AS event_code,
       EventRootCode          AS event_root_code,
       QuadClass              AS quad_class,
       GoldsteinScale         AS goldstein_scale,
       AvgTone                AS avg_tone,
       NumMentions            AS num_mentions,
       IsRootEvent = 1        AS is_root_event,   -- kept for the P2-04 sensitivity variant
       SOURCEURL              AS source_url,
       source_file
FROM kept
-- R4: one row per action, pair and article; the first reported is kept.
QUALIFY row_number() OVER (
    PARTITION BY Day, Actor1CountryCode, Actor2CountryCode, EventCode, SOURCEURL
    ORDER BY DATEADDED, GlobalEventID
) = 1;
