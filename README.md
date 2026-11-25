# Diplomap
Template by [Riccardo Tommasini](riccardotommasini.com/) from [INSA Lyon](https://www.insa-lyon.fr/).

![Insalogo](./images/logo-insa_0.png)

Students: CESBRON Charles, HABSIEGER Carl, MASSILA AKENDENGUE Daniel, PAGET Pierre-Louis

### Abstract

DiploMap is an interactive globe and diplomatic-network explorer that shows where world leaders travelled and how media coverage and bilateral interactions shift around those visits.

## Project Objectives

The project aims to:

- analyze where leaders travel and how often;
- compare media tone before and after diplomatic visits;
- measure changes in cooperation and conflict;
- identify the bilateral events and sources associated with a visit;
- represent travel relationships as a leader-country network.

## Database Creation

[`DB/createDB.py`](DB/createDB.py) downloads the latest GDELT export, stores
new events in a local DuckDB database, and loads the CAMEO event-code and
country reference tables. It also performs a few checks and summary queries on
the imported data.

Run it from the `DB` directory so that the local reference files are found:

```bash
cd DB
python createDB.py
```

This script helped us become familiar with the structure of GDELT,
understand how its data is represented, and begin analyzing the
available events.

## Business Questions and SQL Queries

[`examples.sql`](examples.sql) contains the SQL queries corresponding to our
five business questions:

1. Where did each leader travel, and how often?
2. How did the media tone of bilateral GDELT events change before and after
   each visit?
3. How did the cooperative or conflictual character of bilateral events
   change?
4. Which bilateral events occurred around a visit, and which source URLs are
   attached?
5. How are leaders and countries connected through travel?

## KPI Table

The same SQL file contains pseudocode for creating `kpi_visit_day`, a derived
table with one row per visit and per day in the PRE and POST windows. It
aggregates bilateral GDELT events from 15 days before arrival and 15 days
after departure, while preserving days with no events.

## Repository Structure

```text
DB/                 Database creation script and reference data
examples.sql        Business-question queries and KPI-table pseudocode
images/             Project images
```
