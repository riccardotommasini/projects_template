"""Service for GreenKNNRouter utility scoring."""

import os
from typing import List, Dict, Any

from custom_routers.greenrouter import GreenKNNRouter


class UtilityScoringService:
    """Service for scoring queries with the GreenKNNRouter."""

    _router_instance = None

    @classmethod
    def get_router(cls) -> GreenKNNRouter:
        """Load or retrieve the GreenKNNRouter instance."""
        if cls._router_instance is None:
            project_root = os.path.dirname(os.path.dirname(__file__))
            config_path = os.path.join(
                project_root,
                "custom_routers/greenrouter/config.yaml",
            )
            if not os.path.exists(config_path):
                raise FileNotFoundError(
                    f"Configuration file not found: {config_path}"
                )
            cls._router_instance = GreenKNNRouter(yaml_path=config_path)
        return cls._router_instance

    @classmethod
    def score_query(cls, query_text: str) -> Dict[str, Any]:
        """
        Score a text query with the GreenKNNRouter.

        Args:
            query_text: the query text

        Returns:
            dict with:
              - routers: list of models with their utility scores, sorted in descending order
              - difficulty_score: estimated difficulty score [0,1]
              - threshold: router difficulty threshold
        """
        router = cls.get_router()

        # Route the query
        result = router.route_single({"query": query_text})

        # Extract and sort utility scores
        utility_scores = result.get("utility_scores", {})
        routers = [
            {
                "model": model,
                "utility": float(score),
                "performance": float(result.get("perf_scores", {}).get(model, 0.0)),
                "co2": float(result.get("co2_scores", {}).get(model, 0.0)),
            }
            for model, score in utility_scores.items()
        ]

        # Sort by utility descending
        routers.sort(key=lambda x: x["utility"], reverse=True)

        return {
            "routers": routers,
            "difficulty_score": float(result.get("difficulty_score", 0.0)),
            "threshold": float(result.get("threshold", 0.0)),
            "best_model": result.get("model_name"),
        }
