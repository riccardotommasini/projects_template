# Sample datasets

Small deterministic datasets for local development and tests (C-04): 20 to 50 rows per table, a few of them
deliberately invalid. Each producer adds the samples of its own tables.

| Path | Owner | Content | Checked by |
| --- | --- | --- | --- |
| `api/` | P1 | Example responses of each API route (contract P1-12) | `backend/tests/test_api.py` |
| `fact_visit.csv` | P4 | 31 candidate visits in the shape of `stg_fact_visit` (what the quality gate sees): 24 valid, then one invalid row per `visit_*` rule, identified by `wiki_page_id` 9901 to 9907 | `warehouse/tests/test_fact_visit.py` |

`fact_visit.csv` uses the fictitious leaders of the API examples (`Q100001`, "Sample Leader A", ...). Its keys refer
to dimension rows written in the test until P3 publishes the samples of the dimensions.
