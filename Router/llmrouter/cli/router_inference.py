"""
Router Inference Script for LLMRouter - KNN Only
"""

import atexit
import argparse
import json
import os
import sys
import yaml
from typing import Dict, Any, Optional, List
from pathlib import Path

from llmrouter.models import KNNRouter
from llmrouter.utils import call_api
from custom_routers.greenrouter import GreenKNNRouter

def _safe_unlink(path: str) -> None:
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass


ROUTER_REGISTRY = {
    "knnrouter": KNNRouter,
    "greenrouter": GreenKNNRouter,
}


def load_router(router_name: str, config_path: str, load_model_path: Optional[str] = None):
    router_name_lower = router_name.lower()

    if router_name_lower not in ROUTER_REGISTRY:
        raise ValueError(
            f"Unknown router: {router_name}. Available routers: {list(ROUTER_REGISTRY.keys())}"
        )

    router_class = ROUTER_REGISTRY[router_name_lower]

    if load_model_path:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}
        if "model_path" not in config:
            config["model_path"] = {}
        config["model_path"]["load_model_path"] = load_model_path

        import tempfile
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False, encoding="utf-8") as temp_config:
            yaml.safe_dump(config, temp_config)
            config_path = temp_config.name
        atexit.register(_safe_unlink, config_path)

    try:
        router = router_class(yaml_path=config_path)
    except TypeError as e:
        raise ValueError(f"Failed to initialize router '{router_name}'. Error: {str(e)}") from e

    return router


def route_query(query: str, router_instance: Any, router_name: str) -> Dict[str, Any]:
    try:
        query_input = {"query": query}
        routing_result = router_instance.route_single(query_input)

        model_name = (
            routing_result.get("model_name")
            or routing_result.get("predicted_llm")
            or routing_result.get("predicted_llm_name")
        )

        if not model_name:
            return {
                "success": False,
                "error": "Router did not return a model name",
                "routing_result": routing_result,
            }

        return {
            "success": True,
            "query": query,
            "model_name": model_name,
            "routing_result": routing_result,
        }

    except Exception as e:
        import traceback
        return {
            "success": False,
            "query": query,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


def infer_query(
    query: str,
    router_instance: Any,
    router_name: str,
    temperature: float = 0.8,
    max_tokens: int = 1024,
) -> Dict[str, Any]:
    try:
        query_input = {"query": query}
        routing_result = router_instance.route_single(query_input)

        model_name = (
            routing_result.get("model_name")
            or routing_result.get("predicted_llm")
            or routing_result.get("predicted_llm_name")
        )

        if not model_name:
            return {
                "success": False,
                "query": query,
                "error": "Router did not return a model name",
                "routing_result": routing_result,
            }

        api_model_name = model_name
        api_endpoint = None
        service = None

        if hasattr(router_instance, 'llm_data') and router_instance.llm_data:
            if model_name in router_instance.llm_data:
                api_model_name = router_instance.llm_data[model_name].get("model", model_name)
                api_endpoint = router_instance.llm_data[model_name].get(
                    "api_endpoint", router_instance.cfg.get("api_endpoint")
                )
                service = router_instance.llm_data[model_name].get("service")
            else:
                for key, value in router_instance.llm_data.items():
                    if value.get("model") == model_name or key == model_name:
                        api_model_name = value.get("model", model_name)
                        api_endpoint = value.get(
                            "api_endpoint", router_instance.cfg.get("api_endpoint")
                        )
                        service = value.get("service")
                        break

        if api_endpoint is None:
            api_endpoint = router_instance.cfg.get("api_endpoint")

        if not api_endpoint:
            return {
                "success": False,
                "query": query,
                "error": f"API endpoint not found for model '{model_name}'. Please specify 'api_endpoint' in llm_data JSON or router YAML config.",
                "routing_result": routing_result,
            }

        request = {
            "api_endpoint": api_endpoint,
            "query": query,
            "model_name": model_name,
            "api_name": api_model_name,
        }
        if service:
            request["service"] = service

        result = call_api(request, max_tokens=max_tokens, temperature=temperature)
        response = result.get("response", "No response generated")

        return {
            "success": True,
            "query": query,
            "model_name": model_name,
            "api_model_name": api_model_name,
            "response": response,
            "routing_result": routing_result,
        }

    except Exception as e:
        import traceback
        return {
            "success": False,
            "query": query,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


def load_queries_from_file(file_path: str) -> List[str]:
    file_ext = Path(file_path).suffix.lower()

    with open(file_path, "r", encoding="utf-8") as f:
        if file_ext == ".json":
            data = json.load(f)
            if isinstance(data, list):
                if all(isinstance(item, str) for item in data):
                    return data
                elif all(isinstance(item, dict) and "query" in item for item in data):
                    return [item["query"] for item in data]
            raise ValueError("JSON file must contain list of strings or list of dicts with 'query' field")

        elif file_ext == ".jsonl":
            queries = []
            for line in f:
                line = line.strip()
                if line:
                    obj = json.loads(line)
                    if isinstance(obj, dict) and "query" in obj:
                        queries.append(obj["query"])
                    elif isinstance(obj, str):
                        queries.append(obj)
            return queries

        else:
            return [line.strip() for line in f if line.strip()]


def save_results_to_file(results: List[Dict[str, Any]], output_path: str, output_format: str = "json"):
    with open(output_path, "w", encoding="utf-8") as f:
        if output_format == "jsonl":
            for result in results:
                f.write(json.dumps(result, ensure_ascii=False) + "\n")
        else:
            json.dump(results, f, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(
        description="Router Inference Script - KNN Only",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m llmrouter.cli.router_inference --router knnrouter --config config.yaml --query "What is ML?" --route-only
  python -m llmrouter.cli.router_inference --router knnrouter --config config.yaml --input queries.txt --output results.json
        """
    )

    parser.add_argument("--router", type=str, required=True, help="Router method name (knnrouter)")
    parser.add_argument("--config", type=str, required=True, help="Path to YAML configuration file")

    query_group = parser.add_mutually_exclusive_group(required=True)
    query_group.add_argument("--query", type=str, help="Single query string")
    query_group.add_argument("--input", type=str, help="Path to input file (.txt, .json, .jsonl)")

    parser.add_argument("--load_model_path", type=str, default=None, help="Override model load path")
    parser.add_argument("--route-only", action="store_true", help="Only route, no API call")
    parser.add_argument("--output", type=str, default=None, help="Path to output file")
    parser.add_argument("--output-format", type=str, choices=["json", "jsonl"], default="json")
    parser.add_argument("--temp", type=float, default=0.8, help="Temperature (default: 0.8)")
    parser.add_argument("--max-tokens", type=int, default=1024, help="Max tokens (default: 1024)")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")

    args = parser.parse_args()

    if not os.path.exists(args.config):
        print(f"Error: Config file not found: {args.config}", file=sys.stderr)
        sys.exit(1)

    try:
        router_instance = load_router(args.router, args.config, args.load_model_path)
        if args.verbose:
            print("Router loaded successfully!", file=sys.stderr)
    except Exception as e:
        print(f"Error loading router: {e}", file=sys.stderr)
        sys.exit(1)

    if args.query:
        queries = [args.query]
    else:
        if not os.path.exists(args.input):
            print(f"Error: Input file not found: {args.input}", file=sys.stderr)
            sys.exit(1)
        try:
            queries = load_queries_from_file(args.input)
            if args.verbose:
                print(f"Loaded {len(queries)} queries from {args.input}", file=sys.stderr)
        except Exception as e:
            print(f"Error loading queries: {e}", file=sys.stderr)
            sys.exit(1)

    results = []
    for i, query in enumerate(queries):
        if args.verbose:
            print(f"\nProcessing query {i+1}/{len(queries)}: {query[:50]}...", file=sys.stderr)

        if args.route_only:
            result = route_query(query, router_instance, args.router)
        else:
            result = infer_query(
                query, router_instance, args.router,
                temperature=args.temp, max_tokens=args.max_tokens,
            )

        results.append(result)

        if args.verbose:
            if result["success"]:
                print(f"  └ Routed to: {result.get('model_name')}", file=sys.stderr)
            else:
                print(f"  └ Error: {result.get('error')}", file=sys.stderr)

    if args.output:
        try:
            save_results_to_file(results, args.output, args.output_format)
            if args.verbose:
                print(f"\nResults saved to {args.output}", file=sys.stderr)
        except Exception as e:
            print(f"Error saving results: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        if len(results) == 1:
            print(json.dumps(results[0], indent=2, ensure_ascii=False))
        else:
            print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()