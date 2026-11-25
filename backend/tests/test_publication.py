"""Publication safety of the warehouse reader (task P1-13, finding of P1-11).

4. Requests overlap while warehouse.publish.publish_warehouse swaps the file: never an
   error or a partial state, and a request after the swap returns the new data, even
   when a request on the old file is still in flight (DuckDB would otherwise hand the
   new request its cached instance of the old file).
8. The drain timeout (DIPLOMAP_DRAIN_TIMEOUT_S) bounds the wait: 503 after it.
"""

from __future__ import annotations

import threading
import time

import fixture_warehouse
import pytest
from conftest import NO_CORS_ENV, warehouse_client
from examples import VISIT_EVENTS
from fastapi.testclient import TestClient
from main import create_app

# Second complete state: visit 1 loses its last POST event (n_events_post 2 -> 1).
NEW_EVENTS = VISIT_EVENTS[:-1]
OLD_STATE = (3, 2)
NEW_STATE = (3, 1)


def state(payload: dict) -> tuple[int, int]:
    return payload["n_events_pre"], payload["n_events_post"]


def publish_new(final_path):
    fixture_warehouse.build_and_publish(final_path, events=NEW_EVENTS)


def test_overlapping_requests_see_one_complete_state(warehouse_file):
    client, source = warehouse_client(warehouse_file)
    assert state(client.get("/visits/1/kpis").json()) == OLD_STATE

    seen: list[tuple[int, tuple[int, int]]] = []
    stop = threading.Event()
    lock = threading.Lock()

    def reader():
        own_client = TestClient(create_app(source, environ=NO_CORS_ENV))   # own client, shared reader
        while not stop.is_set():
            response = own_client.get("/visits/1/kpis")
            with lock:
                seen.append((response.status_code, state(response.json()) if response.status_code == 200 else None))

    threads = [threading.Thread(target=reader) for _ in range(4)]
    try:
        for thread in threads:
            thread.start()
        time.sleep(0.3)
        publish_new(warehouse_file)
        time.sleep(0.5)
    finally:
        stop.set()
        for thread in threads:
            thread.join(10)

    assert seen, "the readers made no request"
    assert {code for code, _ in seen} == {200}, [s for s in seen if s[0] != 200][:5]
    assert {s for _, s in seen} <= {OLD_STATE, NEW_STATE}
    assert OLD_STATE in {s for _, s in seen} and NEW_STATE in {s for _, s in seen}
    assert state(client.get("/visits/1/kpis").json()) == NEW_STATE


def test_request_after_the_swap_waits_for_the_old_one_and_sees_new_data(warehouse_file):
    client, source = warehouse_client(warehouse_file)
    holding = threading.Event()
    release = threading.Event()

    def old_request():
        with source.reader.connect() as connection:   # a request still running on the old file
            assert connection.execute("SELECT n_events_post FROM v_kpi_visit WHERE visit_key = 1").fetchone()[0] == 2
            holding.set()
            release.wait(10)

    result: dict = {}

    def new_request():
        response = client.get("/visits/1/kpis")
        result["status"], result["state"] = response.status_code, state(response.json())

    old = threading.Thread(target=old_request)
    new = threading.Thread(target=new_request)
    try:
        old.start()
        assert holding.wait(10)
        publish_new(warehouse_file)
        new.start()
        new.join(0.5)
        assert new.is_alive(), "the new request did not wait for the request on the old file"
        release.set()
        new.join(10)
    finally:
        release.set()
        old.join(10)
        new.join(10)
    assert result == {"status": 200, "state": NEW_STATE}


def test_drain_timeout_answers_503(warehouse_file):
    client, source = warehouse_client(warehouse_file, drain_timeout=0.3)
    holding = threading.Event()
    release = threading.Event()

    def old_request():
        with source.reader.connect():
            holding.set()
            release.wait(10)

    old = threading.Thread(target=old_request)
    try:
        old.start()
        assert holding.wait(10)
        publish_new(warehouse_file)
        started = time.monotonic()
        response = client.get("/visits/1/kpis")
        waited = time.monotonic() - started
    finally:
        release.set()
        old.join(10)
    assert response.status_code == 503
    assert response.json() == {"detail": "the warehouse is being replaced, retry in a moment"}
    assert 0.25 <= waited < 3
    # Once the old request is done, the new file is served.
    assert state(client.get("/visits/1/kpis").json()) == NEW_STATE


def test_requests_on_an_unchanged_file_do_not_wait(warehouse_file):
    client, source = warehouse_client(warehouse_file, drain_timeout=0.3)
    with source.reader.connect():
        response = client.get("/visits/1/kpis")   # same file: no drain
    assert response.status_code == 200


@pytest.mark.parametrize("timeout", [0, -1])
def test_drain_timeout_must_be_positive(timeout, warehouse_file):
    from repository import WarehouseReader

    with pytest.raises(ValueError, match="positive"):
        WarehouseReader(warehouse_file, timeout)
