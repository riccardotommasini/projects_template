# FastAPI app of the DiploMap backend. /health is a liveness check (the compose
# healthcheck uses it): it never touches the warehouse or Neo4j. The API routes live
# in api.py; the data source (sample or warehouse) is chosen from the environment.
#
# Environment: see repository.py, plus DIPLOMAP_CORS_ORIGINS (comma-separated origins
# allowed to call the API from a browser; GET only, no credentials).
import os
from collections.abc import Mapping
from typing import Any

from api import add_examples, router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from repository import Source, source_from_env

DEFAULT_CORS_ORIGINS = "http://127.0.0.1:3000,http://localhost:3000,http://localhost:5173"


def cors_origins(environ: Mapping[str, str]) -> list[str]:
    raw = environ.get("DIPLOMAP_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def create_app(source: Source | None = None, environ: Mapping[str, str] = os.environ) -> FastAPI:
    app = FastAPI(
        title="DiploMap API",
        version="0.1.0",
        description=(
            "Read-only API of the Globe and Network views. DIPLOMAP_API_MODE=sample serves the contract "
            "samples; DIPLOMAP_API_MODE=warehouse reads the published DuckDB warehouse and Neo4j."
        ),
    )
    app.state.source = source if source is not None else source_from_env(environ)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(environ),
        allow_methods=["GET"],
        allow_credentials=False,
    )
    app.include_router(router)

    @app.get("/health", operation_id="health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    def openapi() -> dict[str, Any]:
        """OpenAPI document with the example responses of api.py (nulls kept)."""
        if app.openapi_schema is None:
            schema = get_openapi(
                title=app.title, version=app.version, description=app.description, routes=app.routes
            )
            app.openapi_schema = add_examples(schema)
        return app.openapi_schema

    app.openapi = openapi
    return app


app = create_app()
