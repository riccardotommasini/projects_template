# What the GDELT measures mean (P2-11, for P4)

The visit KPIs compare GDELT events before and after a visit. Each measure says less than its name suggests:
**tone is the tone of articles, Goldstein is the type of event, and both depend on how much a country pair is covered.**
P4 reads this note before fixing `v_kpi_visit` (P4-04); the report reuses it.

Numbers: `stg_gdelt_event` on the spike week (17–23 Dec 2024, 68,987 events after the four rules of
`gdelt_rules.md`). One week before Christmas, so volumes are indicative.

## The measures

| Measure | What it is | What it is not | Evidence on the week |
| --- | --- | --- | --- |
| `avg_tone` (AvgTone) | Tone of the article(s) that reported the event when GDELT first saw it, from −100 to +100, in practice −11 to +8 (1st–99th percentile), median −2.1 | The tone of the relationship, or of all later coverage. The codebook marks it a legacy field computed on the first 15-minute batch only | 99.2 % of URLs carry one single tone across all their events: tone belongs to the article, not to the event |
| `goldstein_scale` | Theoretical impact of the **event type** on a country's stability, from −10 to +10, fixed per CAMEO code | The severity of this specific event: a small protest and a massive one get the same score | 204 CAMEO codes, 42 distinct values, exactly one value per code |
| `quad_class` / cooperative share | Four classes: 1 verbal cooperation, 2 material cooperation, 3 verbal conflict, 4 material conflict; cooperative = 1 or 2 | A judgement on the relationship; it follows from the CAMEO code | 63.5 % / 10.6 % / 11.0 % / 14.9 %: 74 % of events are cooperative |
| `num_mentions` | Mentions of the event in its first 15-minute batch | Its total coverage or importance | Median 4; used only as the noise filter (R3) |

## What it means for the KPIs

- **Δ tone** = change in how articles about the pair were written, not in how the two states behaved. Write it as "media
  tone", as the business question does.
- **Δ Goldstein** = change in the **mix of event types** (more meetings, fewer threats), not in their intensity. A visit
  itself adds cooperative events (`Make a visit`, `Host a visit`, `Consult`), so a positive post-visit Δ is partly
  mechanical.
- **Tone and Goldstein are not two independent proofs.** They correlate (r = 0.35) and tone falls with conflict: −0.85 in
  verbal cooperation, −4.97 in material conflict. When both move the same way, that is one signal, not two.
- **Δ cooperative share** follows the same event mix as Goldstein; it is easier to read, so it is the better headline.

## Coverage bias

| Fact on the week | Value |
| --- | --- |
| Events involving the United States | 27.3 % |
| Country shares of actor slots: USA, ISR, RUS, GBR, CHN | 13.7 %, 6.2 %, 5.3 %, 5.0 %, 4.3 % |
| Country pairs seen | 3,547 |
| Pairs with fewer than 5 events in the week | 2,034 (57 %) |
| Pairs with at least 15 events in the week | 673 |
| Examples: FRA–USA, FRA–DEU, FRA–CHN, FRA–NGA, FRA–IND, FRA–BRA | 670, 183, 79, 35, 19, 10 |

- A 15-day window holds about two weeks of a pair's events. For 57 % of pairs that is fewer than 10 events, and a
  single article can move the average tone of such a window.
- Comparing visits across pairs mixes very different volumes: a Δ on FRA–USA rests on hundreds of events, one on FRA–BRA
  on about twenty.

## Proposals for P4 (P4 owns the KPI rules)

1. Show the event counts before and after next to every Δ, and flag a visit as low-volume when either window has fewer
   than 10 events (to set with C-02 once real visits are profiled).
2. Label tone as "media tone of the coverage" and Goldstein as "event-type mix", in the API and the front end.
3. Lead with the cooperative share; give Goldstein as a supporting figure.
4. Keep the overlap flag planned in P4-04: the effects of two close visits cannot be separated.

Source for the field definitions: the GDELT 2.0 Event codebook (fields AvgTone, GoldsteinScale, QuadClass, NumMentions),
as already quoted in `table_contracts/fact_gdelt_event.yml`.
