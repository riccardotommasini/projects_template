"""Routes of the DiploMap API (contract P1-12, handlers P1-13).

The handlers delegate to the source chosen at startup (repository.source_from_env):
the contract samples in sample mode, the DuckDB warehouse and Neo4j in warehouse mode.
Response models forbid extra fields, so an unexpected column fails loudly.

Errors: 404 for an unknown visit (in sample mode also for a visit without a sample),
503 when the warehouse file or Neo4j is unavailable.

Flat imports: in the container the backend files sit side by side in /app
(uvicorn main:app); the tests put backend/ on sys.path.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Any, TypeVar

from examples import EXAMPLES
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from repository import NotFound, Source, Unavailable
from schemas import (
    ErrorResponse,
    Leader,
    Network,
    VisitDetail,
    VisitEvent,
    VisitKpis,
    VisitSummary,
)

router = APIRouter()

VisitKey = Annotated[int, Path(ge=1, description="Public identifier of the visit.")]

SAMPLE_404 = (
    " In sample mode only visit 1 has a sample: visits 2 to 4 answer 404 \"no sample for visit k\"."
)

# operation id -> example name in examples.EXAMPLES (shown as the 200 example in /docs).
ROUTE_EXAMPLES = {
    "list_leaders": "leaders",
    "list_visits": "visits",
    "get_visit": "visit",
    "get_visit_kpis": "visit_kpis",
    "get_visit_events": "visit_events",
    "get_network": "network",
}


def _responses(*, not_found: bool = False) -> dict[int | str, dict[str, Any]]:
    """OpenAPI error responses of a route: the 503 and, for one visit, the 404."""
    responses: dict[int | str, dict[str, Any]] = {
        503: {"model": ErrorResponse, "description": "Warehouse or Neo4j unavailable."},
    }
    if not_found:
        responses[404] = {"model": ErrorResponse, "description": "No visit with this visit_key."}
    return responses


def add_examples(openapi_schema: dict[str, Any]) -> dict[str, Any]:
    """Put the 200 example of each route into a generated OpenAPI document.

    Done after generation on purpose: FastAPI drops null values from examples
    declared on the route, which would hide the nullable fields (valid_to,
    source_url, the deltas) from the example responses.
    """
    for item in openapi_schema["paths"].values():
        for operation in item.values():
            name = ROUTE_EXAMPLES.get(operation.get("operationId"))
            if name is not None:
                content = operation["responses"]["200"]["content"]["application/json"]
                content["example"] = EXAMPLES[name]
    return openapi_schema


def get_source(request: Request) -> Source:
    return request.app.state.source


SourceDep = Annotated[Source, Depends(get_source)]

T = TypeVar("T")


def _answer(call: Callable[[], T]) -> T:
    """Map the repository errors to HTTP errors."""
    try:
        return call()
    except NotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Unavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get(
    "/leaders",
    response_model=list[Leader],
    operation_id="list_leaders",
    summary="List the leaders and their offices",
    tags=["leaders"],
    responses=_responses(),
)
def list_leaders(source: SourceDep) -> Any:
    """Leaders of dim_leader, one item per leader_id, with their offices (SCD Type 2 versions)."""
    return _answer(source.leaders)


@router.get(
    "/visits",
    response_model=list[VisitSummary],
    operation_id="list_visits",
    summary="List the visits",
    tags=["visits"],
    responses=_responses(),
)
def list_visits(
    source: SourceDep,
    leader_id: Annotated[
        str | None, Query(pattern=r"^Q[0-9]+$", description="Only the visits of this leader (Wikidata QID).")
    ] = None,
) -> Any:
    """Visits of fact_visit (Globe view), ordered by start date, optionally for one leader."""
    return _answer(lambda: source.visits(leader_id))


@router.get(
    "/visits/{visit_key}",
    response_model=VisitDetail,
    operation_id="get_visit",
    summary="Get one visit",
    tags=["visits"],
    responses=_responses(not_found=True),
    description="One visit with the office of its leader, its PRE and POST windows and its lineage." + SAMPLE_404,
)
def get_visit(source: SourceDep, visit_key: VisitKey) -> Any:
    return _answer(lambda: source.visit(visit_key))


@router.get(
    "/visits/{visit_key}/kpis",
    response_model=VisitKpis,
    operation_id="get_visit_kpis",
    summary="Get the PRE vs POST indicators of one visit",
    tags=["visits"],
    responses=_responses(not_found=True),
    description=(
        "One row of v_kpi_visit. Null means and deltas when a window has no event; counts always present."
        + SAMPLE_404
    ),
)
def get_visit_kpis(source: SourceDep, visit_key: VisitKey) -> Any:
    return _answer(lambda: source.visit_kpis(visit_key))


@router.get(
    "/visits/{visit_key}/events",
    response_model=list[VisitEvent],
    operation_id="get_visit_events",
    summary="List the GDELT events attributed to one visit",
    tags=["visits"],
    responses=_responses(not_found=True),
    description=(
        "Rows of v_visit_event for the visit, ordered by event date: events of the PRE and POST windows. "
        "A visit without events answers an empty list." + SAMPLE_404
    ),
)
def get_visit_events(source: SourceDep, visit_key: VisitKey) -> Any:
    return _answer(lambda: source.visit_events(visit_key))


@router.get(
    "/network",
    response_model=Network,
    operation_id="get_network",
    summary="Get the leader-country network",
    tags=["network"],
    responses=_responses(),
)
def get_network(source: SourceDep) -> Any:
    """Leader VISITED and REPRESENTS Country graph (Neo4j projection), shared destinations, reciprocal visits."""
    return _answer(source.network)
