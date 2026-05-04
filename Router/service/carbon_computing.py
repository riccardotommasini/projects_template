"""Carbon footprint computation helpers for the FastAPI endpoint."""

import os

try:
	from openai import OpenAI
except ImportError:  # pragma: no cover
	OpenAI = None

CARBON_COST_PER_TOKEN = {
	"gpt-4": 0.00000015,
	"gpt-4-turbo": 0.00000012,
	"gpt-3.5-turbo": 0.00000005,
	"claude-3-opus": 0.00000018,
	"claude-3-sonnet": 0.00000008,
	"llama-2-70b": 0.00000004,
	"mistral-7b": 0.00000002,
	"gemini-pro": 0.00000010,
}

ESTIMATED_OUTPUT_TOKENS = {
	"gpt-4": 150,
	"gpt-4-turbo": 140,
	"gpt-3.5-turbo": 120,
	"claude-3-opus": 160,
	"claude-3-sonnet": 130,
	"llama-2-70b": 110,
	"mistral-7b": 100,
	"gemini-pro": 125,
}


def _count_input_tokens(query: str) -> int:
	"""Count input tokens for the request query.

	Uses the OpenAI token counter when the optional dependency and API key are
	available, and falls back to a simple local estimate otherwise.
	"""
	text = query.strip()
	if not text:
		return 0

	api_key = os.getenv("OPENAI_API_KEY", "").strip()
	if OpenAI is not None and api_key:
		try:
			client = OpenAI(api_key=api_key)
			model_name = os.getenv("LLMROUTER_TOKEN_COUNT_MODEL", "gpt-5")
			response = client.responses.input_tokens.count(
				model=model_name,
				input=[{"role": "user", "content": text}],
			)
			return int(response.input_tokens)
		except Exception as e:
			print(f"Error counting tokens with OpenAI API: {str(e)}")
			pass

	print("Warning: OpenAI API not available or failed, using fallback token count.")
	return len(text.split())


def calculate_request_carbon_footprint(query: str) -> dict:
	"""Return mock carbon footprint metrics for each model.

	The request input size is derived from the query text, while output tokens depend on the model.
	"""
	input_tokens = _count_input_tokens(query)

	results = {
		"request_metrics": {
			"input_tokens": input_tokens,
		},
		"models": {},
	}

	for model, carbon_per_token in CARBON_COST_PER_TOKEN.items():
		output_tokens = ESTIMATED_OUTPUT_TOKENS.get(model, 100)
		total_tokens = input_tokens + output_tokens
		total_carbon = carbon_per_token * total_tokens

		results["models"][model] = {
			"output_tokens_estimated": output_tokens,
			"total_tokens": total_tokens,
			"carbon_cost_per_token_kg_co2": carbon_per_token,
			"total_carbon_cost_kg_co2": round(total_carbon, 10),
			"total_carbon_cost_mg_co2": round(total_carbon * 1_000_000, 3),
		}

	return results
