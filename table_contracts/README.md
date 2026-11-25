# Table contracts

One YAML file per table or view of the warehouse: grain, columns, keys and business rules. A contract changed after its
validation goes through a PR reviewed by its producer and its consumer.

This file holds the decisions and the key numbers the contracts rely on, one section per owner.

## GDELT (P2)

Measured on the spike week (17–23 Dec 2024, 672 files) with `warehouse/profiling/gdelt_profiling.ipynb`; section numbers
in brackets. The rules built on them, with their options and effect on volume, are in
`warehouse/profiling/gdelt_rules.md` and applied by `warehouse/staging/gdelt.sql`.

| Measure | Value | Section |
| --- | ---: | --- |
| Raw events | 813,679 | first cell |
| Unreadable lines | 0 | load metrics |
| Exact duplicate `GlobalEventID` | 0 | [6] |
| Both actor country codes present | 25.2 % | [2] |
| At least one actor country missing | 74.8 % | [2] |
| … of which the actor geography could fill it (upper bound) | 51.1 % of all events | [2] |
| International organisations facing a country | 0.5 % | [2b] |
| Country codes missing from `DB/CAMEO.country.txt` | 1 (`SSD`, 629 mentions) | [2c] |
| Event reported the same day (`Day` = `DATEADDED` date) | 97.8 % | [3] |
| Event reported within 30 days | 99.2 % | [3] |
| Root events (`IsRootEvent = 1`) | 57.1 % | [4] |
| `NumMentions` median / 90th percentile | 4 / 10 | [5] |
| `NumSources` 90th percentile | 1 | [5] |
| Distinct country pairs; share of the top 100 | 4,193; 49.4 % | [7] |
| **Events after the four rules (`stg_gdelt_event`)** | **68,987 (8.5 %)** | [9] |

The unresolved country codes are listed for P3 in `warehouse/profiling/unresolved_country_codes.csv`.

## Visits and KPIs (P4)

### C-02 decisions (2026-11-09)

How a GDELT event is attributed to a visit. Applied in `warehouse/views/v_visit_event.sql`; tested against a
hand-computed set in `warehouse/tests/test_serving_views.py`.

| Question | Decision |
| --- | --- |
| Direction of the pair | Both directions: actor 1 = visitor and actor 2 = host, or the reverse. |
| Countries or leaders | Countries. Any event between the two states counts; it does not have to involve the leader. |
| Multilateral visits (summits) | Only the visitor–host pair; events between the other participants are not attributed. |
| Overlapping windows | Nothing is removed: an event inside the windows of several visits is attributed to each of them. `v_kpi_visit.has_overlap` flags those visits. |
| Where the visitor–host filter lives | In `v_visit_event`. `fact_gdelt_event` keeps every event between two different states. |

### Other P4 rules

| Rule | Decision | Where |
| --- | --- | --- |
| Windows | 15 days before the start date (PRE) and 15 days after the end date (POST); the visit days belong to no window. | `fact_visit`, `v_visit_event` |
| Leader version | The `dim_leader` version valid on the start date; the visitor country is the country of that version. | `fact_visit.sql` |
| `matched_in_gdelt` | A CAMEO 042 or 043 event between the two countries, either direction, dated inside the visit days. | `fact_visit.sql` |
| Visit scope | Start date in 2025-01-01..2025-06-30 and end date at most 2025-07-15 (end of `dim_date`); other visits are quarantined. | quality rules `visit_*` |
| KPI means | Per event, not weighted by mentions; a window without events gives NULL means and deltas, with a count of 0. | `v_kpi_visit` |
| Low volume | Fewer than 10 events in PRE or POST (threshold from `gdelt_measures.md`, to revisit on the real visits). | `v_kpi_visit.is_low_volume` |
| Overlap | Another visit of the same country pair, either direction, whose PRE..POST span meets this one. | `v_kpi_visit.has_overlap` |

The reading of the measures (tone of the coverage, event-type mix, coverage bias) follows
`warehouse/profiling/gdelt_measures.md` (P2-11).
