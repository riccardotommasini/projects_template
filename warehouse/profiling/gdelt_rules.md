# GDELT rules dossier (P2-02, C-06)

The four rules below are accepted and implemented in `warehouse/staging/gdelt.sql` (`stg_gdelt_raw` → `stg_gdelt_event`,
tested in `warehouse/tests/test_staging_gdelt.py`). On the spike week (17–23 Dec 2024) they take **813,679 raw events to
68,987 usable state-pair events (8.5 %)**. Each rule gives its options, the number that decided it, and its effect on volume.

Every number comes from `gdelt_profiling.ipynb` (section in brackets), run on `stg_gdelt_raw` loaded with
`warehouse/staging/load_gdelt_raw.py`. Visit windows are ±15 days around January–June 2025 visits (checks on
`fact_visit` in `schema.sql`), so the study period is 17/12/2024–15/07/2025.

## Funnel of the accepted rules

| Step | Rule | Events left | Kept from previous step |
| --- | --- | ---: | ---: |
| 0 | Raw week | 813,679 | |
| 1 | R1: two different state actors | 140,292 | 17.2 % |
| 2 | R2: event dated inside the study period | 136,932 | 97.6 % |
| 2 | R2: reported within 30 days of the event | 136,932 | 100 % |
| 3 | R3: `NumMentions >= 2` | 104,975 | 76.7 % |
| 4 | R4: one row per (day, pair, CAMEO code, article) | 68,987 | 65.7 % |

On the spike week the 30-day limit removes nothing once the period bound applies: every event reported more than 30
days late is also dated before 17/12/2024. It matters for the full period, at the end of the last windows.

The last filter, keeping only visitor–host pairs of `fact_visit`, belongs to C-02 and P4 (`v_visit_event`), not to this dossier.

## R1 — Country of each actor

**Accepted: keep an event only when both `Actor1CountryCode` and `Actor2CountryCode` are real countries and differ.
No fallback on the actor's geography for now.**

| Option | Events | Effect | Source |
| --- | ---: | --- | --- |
| Both actor country codes present | 204,965 | 25.2 % of all events | [9] |
| … minus CAMEO region and city codes (`EUR`, `AFR`, `MEA`, `BAG`, `GZS`, `WSB`…) | 190,819 | −14,146 | [9] |
| … minus same country on both sides (domestic events) | **140,292** | −50,527 | [9] |
| Add actor-geo fallback (`ActorNGeo_CountryCode`, FIPS) | up to +224,360 | +160 %, precision unknown | [9] |

- **Region codes** are in `DB/CAMEO.country.txt` (its first 28 rows) but are not states; a visit is between two states.
- **International organisations** (type `IGO`, e.g. `UNO`) face a country in only 4,117 events (0.5 %) [2b]. Excluded: a visit
  pair is two states.
- **Geo fallback** would more than double the volume, but the actor's geography is the place named in the article, not the
  actor's nationality ("police in Lagos" is Nigerian, "the president in Paris" may not be French). It also needs the FIPS→CAMEO
  mapping of P3-07. Proposed check once P3-07 exists: hand-check 50 rescued events and adopt the fallback only if at least
  90 % are right.
- **Unresolved codes:** one GDELT code is missing from the CAMEO reference, `SSD` (South Sudan, 629 actor mentions) [2c].
  Sent to P3 in `unresolved_country_codes.csv`.

## R2 — Reference date and late events

**Accepted: the event date is `Day` (SQLDATE) and must fall inside 17/12/2024–15/07/2025. Drop events reported more than
30 days after they happened. Ask P1 to extend ingestion by 30 days, to 14/08/2025.**

| Max delay between event and report | State-pair events covered | Source |
| --- | ---: | --- |
| same day | 97.33 % | [9] |
| 7 days | 98.39 % | [9] |
| 15 days | 98.39 % | [9] |
| **30 days** | **99.25 %** | [9] |
| 1 year | 99.99 % | [9] |

- `Day` says when the event happened, which is what a before/after visit window measures. `DATEADDED` says when GDELT
  first saw it; the two agree for 97.8 % of all events [3].
- No event is reported before it happens (0 negative delays), so ingestion does not need to start earlier than 17/12/2024.
- At the end, an event of the last window (up to 15/07/2025) can be reported later. Ingesting up to 14/08/2025 captures
  99.25 % of them, against 98.39 % with no extension and the same 98.39 % with 15 days. **Request to P1 (P1-09).**
- Events reported more than 30 days later are 0.75 % of state pairs. The oldest are parsing errors, not news: rows dated
  2014 point to December 2024 articles (e.g. an Al Jazeera piece of 18/12/2024 on the fall of al-Assad dated 21/12/2014).
- Events dated outside 17/12/2024–15/07/2025 are filtered in staging rather than quarantined, since the extension makes
  them expected. The `fact_gdelt_event` contract still says quarantine: contract change to propose to P4.

## R3 — Noise filters

**Accepted: `NumMentions >= 2`. Keep `IsRootEvent = 1` as a sensitivity variant for P2-04, not as the rule.**

| Filter on state pairs | Events kept | Share | Avg tone | Avg Goldstein | Cooperative | Source |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| none | 140,292 | 100 % | −1.94 | 0.81 | 74.2 % | [9] |
| **`NumMentions >= 2`** | **107,493** | **76.6 %** | −1.87 | 0.90 | 74.7 % | [9] |
| `NumMentions >= 3` | 58,706 | 41.8 % | −1.79 | 0.86 | 74.2 % | [9] |
| `IsRootEvent = 1` | 75,157 | 53.6 % | −1.46 | 0.91 | 75.4 % | [9] |
| root and `NumMentions >= 2` | 60,414 | 43.1 % | −1.42 | 0.96 | 75.5 % | [9] |
| `NumSources >= 2` | 3,579 | 2.6 % | −2.93 | 0.31 | 68.8 % | [9] |

- **Mentions ≥ 2** removes events seen once in a single article, the most likely misreads, and moves the KPI inputs the
  least (tone +0.07). Median `NumMentions` is 4 [5].
- **Root events** halve the volume and shift tone by +0.48: lead paragraphs are more positive, so the filter changes what
  the KPI measures, not only the noise. Visit windows are small (one pair, ±15 days), so volume matters.
- **`NumSources`** is unusable: its 90th percentile is 1 [5]. Keeping ≥ 2 leaves 2.6 % of events.
- P2-04 measures the effect of the chosen filter on the KPIs of a sample of visits, once visits exist.

## R4 — Deduplication

**Accepted: one row per (`Day`, `Actor1CountryCode`, `Actor2CountryCode`, `EventCode`, `SOURCEURL`), keeping the first
reported (`DATEADDED`, then lowest `GlobalEventID`). Exact `GlobalEventID` uniqueness stays a quality check.**

| Key on state pairs | Events kept | Share | Avg tone after | Source |
| --- | ---: | ---: | ---: | --- |
| `GlobalEventID` (exact) | 140,292 | 100 % | −1.94 | [9] |
| **day + directed pair + `EventCode` + URL** | **81,466** | **58.1 %** | **−1.95** | [9] |
| day + undirected pair + `EventRootCode` + URL | 61,540 | 43.9 % | −2.25 | [9] |
| day + directed pair + `EventCode`, no URL | 50,676 | 36.1 % | −1.52 | [9] |

- **Exact duplicates:** 0 in the week [6]. The contract's check stays, as a guard.
- **Recommended key:** GDELT codes the same action in the same article several times, once per actor sub-code (`USAGOV`,
  `USAMIL`…). At country level those rows are one event. Removing them leaves the tone unchanged (−1.94 → −1.95), the
  sign that they are copies.
- **Undirected + root code** also merges different actions (A threatens B and B accuses A) and shifts tone by −0.31.
- **No URL** merges different articles about the same action. How many outlets cover an event is real signal, and the
  key shifts tone by +0.42, so it removes information, not duplicates. The 66.5 % "near duplicates" of the profiling [6]
  come from this key.

## Decisions and follow-ups

- [x] R1: state pairs only, region codes and IGOs out, no geo fallback until the P3-07 check
- [x] R2: `Day` as reference date inside the study period, 30-day reporting limit
- [x] R3: `NumMentions >= 2`; `is_root_event` kept in `stg_gdelt_event` for the P2-04 sensitivity variant
- [x] R4: dedup key (day, directed pair, `EventCode`, URL), first reported kept
- [ ] Ask P1 to extend ingestion to 14/08/2025 (P1-09)
- [ ] Propose to P4 the `fact_gdelt_event` contract change: out-of-period events filtered, not quarantined
- [ ] Geo fallback: hand-check 50 rescued events once P3-07 delivers the FIPS mapping
