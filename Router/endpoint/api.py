import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from service.carbon_computing import calculate_request_carbon_footprint
from service.greenrouter_service import UtilityScoringService


DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

def get_cors_origins() -> list[str]:
    raw_origins = os.getenv("LLMROUTER_CORS_ORIGINS", "").strip()
    if raw_origins:
        origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
        if origins:
            return origins
    return DEFAULT_CORS_ORIGINS


main = FastAPI(title="LLMRouter API", version="0.1.0")
app = main

main.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@main.get("/")
def root() -> dict[str, str]:
    return {"message": "LLMRouter API is running. See available endpoints at /docs."}


@main.get("/carbon")
def get_carbon_footprint(query: str) -> JSONResponse:
    """
    Calculate the carbon footprint of a query request.

    Estimates the environmental impact (CO2 emissions) associated with processing
    the given text query across available LLM models.

    Args:
        query: the query text passed as query string

    Returns:
        JSONResponse containing carbon footprint metrics in grams of CO2 equivalent
    """
    return JSONResponse(content=calculate_request_carbon_footprint(query))


@main.get("/utility-scores")
def get_utility_scores(query: str) -> JSONResponse:
    """
    Score a text query with the GreenKNNRouter.

    Returns a list of models with their utility scores, sorted in descending order.

    Args:
        query: the query text passed as query string

    Returns:
        JSONResponse containing:
          - routers: list of models [{"model", "utility", "performance", "co2"}, ...]
          - difficulty_score: difficulty score [0,1]
          - threshold: router threshold
          - best_model: model selected with the best utility
    """
    result = UtilityScoringService.score_query(query)
    return JSONResponse(content=result)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:main", host="127.0.0.1", port=8000, reload=True)