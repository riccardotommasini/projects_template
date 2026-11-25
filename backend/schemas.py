"""Response schemas of the DiploMap API (task P1-12, Pydantic v2).

Sources of truth for the field names (snake_case, same names as the columns):
  - table_contracts/*.yml of this branch (dim_country, dim_leader, dim_visit_type, fact_visit);
  - v_visit_event and v_kpi_visit contracts read, without merging, from
    origin/p4-model-views at commit 889a1a1507471cb2aebfebea098482c9d9075275
    (table_contracts/v_visit_event.yml, table_contracts/v_kpi_visit.yml);
  - the Network shape follows warehouse/diplomatic_graph/queries.cypher of the same commit.

Conventions:
  - Countries are nested objects (iso3_code, country_name); surrogate keys
    (country_key, leader_key, event_type_key) are not exposed. visit_key is the
    public visit identifier.
  - Dates are ISO 8601 strings (YYYY-MM-DD).
  - A column marked nullable in its contract is Optional here.
  - Every model forbids extra fields: a handler returning an unexpected column
    fails validation instead of leaking it silently.
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

LeaderId = Annotated[str, Field(pattern=r"^Q[0-9]+$", description="Wikidata QID.", examples=["Q100001"])]
Iso3Code = Annotated[str, Field(pattern=r"^[A-Z]{3}$", description="ISO 3166 alpha-3 code.", examples=["FRA"])]
Share = Annotated[float, Field(ge=0, le=1)]
Delta = Annotated[float, Field(ge=-200, le=200)]


class ApiModel(BaseModel):
    """Base of every response model: unknown fields are rejected."""

    model_config = ConfigDict(extra="forbid")


# Enumerations


class VisitWindow(str, Enum):
    """Window of an attributed event: 15 days before the start date or after the end date."""

    PRE = "PRE"
    POST = "POST"


class VisitTypeLabel(str, Enum):
    """Closed list of dim_visit_type."""

    state = "state"
    working = "working"
    summit = "summit"
    ceremony = "ceremony"
    unknown = "unknown"


class NodeType(str, Enum):
    leader = "leader"
    country = "country"


class EdgeType(str, Enum):
    VISITED = "VISITED"
    REPRESENTS = "REPRESENTS"


# Shared objects


class Country(ApiModel):
    """A country of dim_country, nested wherever a fact holds a country key."""

    iso3_code: Iso3Code
    country_name: str = Field(description="English name of the country.")


class ErrorResponse(ApiModel):
    """Body of the 404 and 501 responses."""

    detail: str = Field(examples=["not implemented"])


# GET /leaders


class Office(ApiModel):
    """One dim_leader version (SCD Type 2): an office held during a period."""

    position_title: str | None = Field(description="Office held, for example President.")
    represented_country: Country
    valid_from: date = Field(description="First day in office.")
    valid_to: date | None = Field(description="Last day in office, inclusive. Null while the office is held.")


class Leader(ApiModel):
    """A leader (one item per leader_id) with the offices of dim_leader, oldest first."""

    leader_id: LeaderId
    leader_name: str = Field(description="Full name (latest version).")
    offices: list[Office] = Field(min_length=1)


# GET /visits and GET /visits/{visit_key}


class VisitSummary(ApiModel):
    """One row of fact_visit, with its leader and countries resolved."""

    visit_key: int = Field(description="Public identifier of the visit.")
    leader_id: LeaderId
    leader_name: str
    visitor_country: Country = Field(description="Country represented by the leader on the start date.")
    host_country: Country = Field(description="Country visited.")
    visit_type_label: VisitTypeLabel
    start_date_key: date = Field(description="First day of the visit.")
    end_date_key: date = Field(description="Last day of the visit.")
    duration_days: int = Field(ge=1, description="Length in days, both ends included.")
    is_multilateral: bool = Field(description="True for a multilateral event such as a summit.")
    matched_in_gdelt: bool = Field(description="True when GDELT also codes the visit (CAMEO 042 or 043).")


class VisitDetail(VisitSummary):
    """A visit with the office of the leader, its PRE and POST windows and its lineage."""

    position_title: str | None = Field(description="Office held by the leader on the start date.")
    pre_window_start: date = Field(description="Start date minus 15 days.")
    pre_window_end: date = Field(description="Start date minus 1 day.")
    post_window_start: date = Field(description="End date plus 1 day.")
    post_window_end: date = Field(description="End date plus 15 days.")
    wiki_page_id: int = Field(description="Lineage: scraped Wikipedia page.")
    wiki_revision_id: int = Field(description="Lineage: revision of the page that was scraped.")


# GET /visits/{visit_key}/kpis  (v_kpi_visit)


class VisitKpis(ApiModel):
    """PRE vs POST indicators of one visit (one row of v_kpi_visit).

    A window without events gives null means and null deltas, with a count of 0.
    The counts are always returned next to the deltas.
    """

    visit_key: int
    n_events_pre: int = Field(ge=0, description="Events in the PRE window.")
    n_events_post: int = Field(ge=0, description="Events in the POST window.")
    coop_share_pre: Share | None = Field(description="Share of cooperative events (quad class 1-2) in PRE.")
    coop_share_post: Share | None = Field(description="Same in POST.")
    delta_coop_share: Delta | None = Field(description="POST minus PRE. Headline indicator.")
    tone_pre: float | None = Field(ge=-100, le=100, description="Mean media tone of the coverage in PRE.")
    tone_post: float | None = Field(ge=-100, le=100, description="Same in POST.")
    delta_tone: Delta | None = Field(description='POST minus PRE. Label: "media tone of the coverage".')
    goldstein_pre: float | None = Field(ge=-10, le=10, description="Mean Goldstein score in PRE.")
    goldstein_post: float | None = Field(ge=-10, le=10, description="Same in POST.")
    delta_goldstein: Delta | None = Field(description='POST minus PRE. Label: "event-type mix".')
    is_low_volume: bool = Field(description="True when PRE or POST holds fewer than 10 events.")
    has_overlap: bool = Field(description="True when another visit of the same country pair overlaps this one.")


# GET /visits/{visit_key}/events  (v_visit_event)


class VisitEvent(ApiModel):
    """A GDELT event attributed to the PRE or POST window of a visit (one row of v_visit_event)."""

    visit_key: int
    gdelt_event_id: int = Field(description="GLOBALEVENTID.")
    visit_window: VisitWindow
    day_offset: int = Field(
        ge=-15, le=15, description="Days from the visit: -15..-1 before the start, +1..+15 after the end."
    )
    event_date_key: date = Field(description="Date of the event.")
    actor1_country: Country
    actor2_country: Country
    cameo_code: str = Field(pattern=r"^[0-9]{2,4}$", description="CAMEO event code, for example 042.")
    is_cooperative: bool = Field(description="True for quad classes 1 and 2.")
    goldstein_scale: float = Field(ge=-10, le=10)
    avg_tone: float = Field(ge=-100, le=100, description="Tone of the first article.")
    num_mentions: int = Field(ge=0)
    source_url: str | None = Field(description="URL of the first article.")


# GET /network  (Neo4j projection)


class NetworkNode(ApiModel):
    """A Leader or Country node. id is the QID of a leader or the ISO3 code of a country."""

    id: str
    type: NodeType
    label: str = Field(description="Leader name or country name.")
    iso3_code: Iso3Code | None = Field(description="Set for countries, null for leaders.")


class NetworkEdge(ApiModel):
    """Leader VISITED Country, or Leader REPRESENTS Country (one edge per leader and country)."""

    source: str = Field(description="Leader id.")
    target: str = Field(description="Country id (ISO3).")
    type: EdgeType
    n_visits: int | None = Field(ge=1, description="Number of visits; null for REPRESENTS.")
    first_visit: date | None = Field(description="Start date of the first visit; null for REPRESENTS.")


class SharedDestination(ApiModel):
    """Two leaders who visited the same countries (leader_a_id < leader_b_id)."""

    leader_a_id: LeaderId
    leader_b_id: LeaderId
    n_shared: int = Field(ge=1)
    shared_countries: list[Iso3Code] = Field(min_length=1)


class ReciprocalVisit(ApiModel):
    """A country pair where a leader of each country visited the other one (country_a < country_b)."""

    country_a: Iso3Code
    country_b: Iso3Code
    leaders_a_to_b: list[LeaderId] = Field(min_length=1)
    leaders_b_to_a: list[LeaderId] = Field(min_length=1)
    first_a_to_b: date
    first_b_to_a: date


class Network(ApiModel):
    """Network view: the leader-country graph plus the two analyses of business question 5."""

    nodes: list[NetworkNode]
    edges: list[NetworkEdge]
    shared_destinations: list[SharedDestination]
    reciprocal_visits: list[ReciprocalVisit]
