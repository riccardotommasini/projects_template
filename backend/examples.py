"""Example responses of the DiploMap API (task P1-12): one payload per endpoint.

ALL DATA HERE IS FICTIONAL. The leaders ("Sample Leader A", QIDs Q100001 and up),
their offices, visits, GDELT events, URLs (example.com) and Wikipedia ids are
invented. Only the country codes and names are real, so that a globe can place
them when frontend developers use these files as mock data.

This module is the single source of the examples. They appear in the OpenAPI
document (/docs) and are written to sample_datasets/api/<name>.json by
backend/export_openapi.py. The payloads are plain JSON (dates as ISO strings)
and agree with each other:
  - visit 1 is the same in "visits", "visit", "visit_kpis" and "visit_events";
  - the PRE and POST events of "visit_events" give the counts, means and deltas
    of "visit_kpis";
  - the VISITED edges of "network" aggregate the visits of "visits", and its
    shared destinations and reciprocal visits follow from those edges.
"""

from __future__ import annotations

FRA = {"iso3_code": "FRA", "country_name": "France"}
JPN = {"iso3_code": "JPN", "country_name": "Japan"}
DEU = {"iso3_code": "DEU", "country_name": "Germany"}

LEADERS = [
    {
        "leader_id": "Q100001",
        "leader_name": "Sample Leader A",
        "offices": [
            {
                "position_title": "President",
                "represented_country": FRA,
                "valid_from": "2022-05-14",
                "valid_to": None,
            }
        ],
    },
    {
        "leader_id": "Q100002",
        "leader_name": "Sample Leader B",
        "offices": [
            {
                "position_title": "Minister of Foreign Affairs",
                "represented_country": JPN,
                "valid_from": "2021-11-10",
                "valid_to": "2024-09-30",
            },
            {
                "position_title": "Prime Minister",
                "represented_country": JPN,
                "valid_from": "2024-10-01",
                "valid_to": None,
            },
        ],
    },
    {
        "leader_id": "Q100003",
        "leader_name": "Sample Leader C",
        "offices": [
            {
                "position_title": "Chancellor",
                "represented_country": DEU,
                "valid_from": "2025-01-15",
                "valid_to": None,
            }
        ],
    },
]

VISITS = [
    {
        "visit_key": 1,
        "leader_id": "Q100001",
        "leader_name": "Sample Leader A",
        "visitor_country": FRA,
        "host_country": JPN,
        "visit_type_label": "state",
        "start_date_key": "2025-03-10",
        "end_date_key": "2025-03-12",
        "duration_days": 3,
        "is_multilateral": False,
        "matched_in_gdelt": True,
    },
    {
        "visit_key": 2,
        "leader_id": "Q100001",
        "leader_name": "Sample Leader A",
        "visitor_country": FRA,
        "host_country": DEU,
        "visit_type_label": "working",
        "start_date_key": "2025-04-02",
        "end_date_key": "2025-04-02",
        "duration_days": 1,
        "is_multilateral": False,
        "matched_in_gdelt": False,
    },
    {
        "visit_key": 3,
        "leader_id": "Q100002",
        "leader_name": "Sample Leader B",
        "visitor_country": JPN,
        "host_country": FRA,
        "visit_type_label": "working",
        "start_date_key": "2025-05-20",
        "end_date_key": "2025-05-21",
        "duration_days": 2,
        "is_multilateral": False,
        "matched_in_gdelt": True,
    },
    {
        "visit_key": 4,
        "leader_id": "Q100003",
        "leader_name": "Sample Leader C",
        "visitor_country": DEU,
        "host_country": JPN,
        "visit_type_label": "summit",
        "start_date_key": "2025-06-15",
        "end_date_key": "2025-06-17",
        "duration_days": 3,
        "is_multilateral": True,
        "matched_in_gdelt": True,
    },
]

VISIT = {
    **VISITS[0],
    "position_title": "President",
    "pre_window_start": "2025-02-23",
    "pre_window_end": "2025-03-09",
    "post_window_start": "2025-03-13",
    "post_window_end": "2025-03-27",
    "wiki_page_id": 90000001,
    "wiki_revision_id": 1200000001,
}


def _event(event_id, window, offset, day, actor1, actor2, cameo, cooperative, goldstein, tone, mentions, url):
    return {
        "visit_key": 1,
        "gdelt_event_id": event_id,
        "visit_window": window,
        "day_offset": offset,
        "event_date_key": day,
        "actor1_country": actor1,
        "actor2_country": actor2,
        "cameo_code": cameo,
        "is_cooperative": cooperative,
        "goldstein_scale": goldstein,
        "avg_tone": tone,
        "num_mentions": mentions,
        "source_url": url,
    }


VISIT_EVENTS = [
    _event(1220000001, "PRE", -10, "2025-02-28", FRA, JPN, "036", True, 4.0, 1.25, 6,
           "https://news.example.com/2025/02/28/sample-1"),
    _event(1220000002, "PRE", -5, "2025-03-05", JPN, FRA, "112", False, -2.0, -3.5, 3,
           "https://news.example.com/2025/03/05/sample-2"),
    _event(1220000003, "PRE", -1, "2025-03-09", FRA, JPN, "042", True, 1.9, 0.75, 12, None),
    _event(1220000004, "POST", 2, "2025-03-14", JPN, FRA, "057", True, 8.0, 2.5, 9,
           "https://news.example.com/2025/03/14/sample-4"),
    _event(1220000005, "POST", 8, "2025-03-20", FRA, JPN, "043", True, 2.8, 1.5, 4,
           "https://news.example.com/2025/03/20/sample-5"),
]

VISIT_KPIS = {
    "visit_key": 1,
    "n_events_pre": 3,
    "n_events_post": 2,
    "coop_share_pre": 0.6666666666666666,
    "coop_share_post": 1.0,
    "delta_coop_share": 0.33333333333333337,
    "tone_pre": -0.5,
    "tone_post": 2.0,
    "delta_tone": 2.5,
    "goldstein_pre": 1.3,
    "goldstein_post": 5.4,
    "delta_goldstein": 4.1000000000000005,
    "is_low_volume": True,
    "has_overlap": False,
}

NETWORK = {
    "nodes": [
        {"id": "Q100001", "type": "leader", "label": "Sample Leader A", "iso3_code": None},
        {"id": "Q100002", "type": "leader", "label": "Sample Leader B", "iso3_code": None},
        {"id": "Q100003", "type": "leader", "label": "Sample Leader C", "iso3_code": None},
        {"id": "DEU", "type": "country", "label": "Germany", "iso3_code": "DEU"},
        {"id": "FRA", "type": "country", "label": "France", "iso3_code": "FRA"},
        {"id": "JPN", "type": "country", "label": "Japan", "iso3_code": "JPN"},
    ],
    "edges": [
        {"source": "Q100001", "target": "FRA", "type": "REPRESENTS", "n_visits": None, "first_visit": None},
        {"source": "Q100001", "target": "DEU", "type": "VISITED", "n_visits": 1, "first_visit": "2025-04-02"},
        {"source": "Q100001", "target": "JPN", "type": "VISITED", "n_visits": 1, "first_visit": "2025-03-10"},
        {"source": "Q100002", "target": "JPN", "type": "REPRESENTS", "n_visits": None, "first_visit": None},
        {"source": "Q100002", "target": "FRA", "type": "VISITED", "n_visits": 1, "first_visit": "2025-05-20"},
        {"source": "Q100003", "target": "DEU", "type": "REPRESENTS", "n_visits": None, "first_visit": None},
        {"source": "Q100003", "target": "JPN", "type": "VISITED", "n_visits": 1, "first_visit": "2025-06-15"},
    ],
    "shared_destinations": [
        {"leader_a_id": "Q100001", "leader_b_id": "Q100003", "n_shared": 1, "shared_countries": ["JPN"]},
    ],
    "reciprocal_visits": [
        {
            "country_a": "FRA",
            "country_b": "JPN",
            "leaders_a_to_b": ["Q100001"],
            "leaders_b_to_a": ["Q100002"],
            "first_a_to_b": "2025-03-10",
            "first_b_to_a": "2025-05-20",
        },
    ],
}

# File name (without .json) in sample_datasets/api/ -> payload.
EXAMPLES: dict[str, object] = {
    "leaders": LEADERS,
    "visits": VISITS,
    "visit": VISIT,
    "visit_kpis": VISIT_KPIS,
    "visit_events": VISIT_EVENTS,
    "network": NETWORK,
}
