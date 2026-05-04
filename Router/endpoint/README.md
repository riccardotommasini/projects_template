## API Documentation

### GET `/carbon`
Calculate the carbon footprint of a query request.

Estimates the environmental impact (CO2 emissions) associated with processing the given text query across available LLM models.

Query parameters:
- `query` (string, required): the text query to evaluate

Response shape:
- `request_metrics.input_tokens`: input token count
- `models.<model>.output_tokens_estimated`: estimated output token count for the model
- `models.<model>.total_tokens`: input + output tokens for the model
- `models.<model>.carbon_cost_per_token_kg_co2`: carbon cost per token
- `models.<model>.total_carbon_cost_kg_co2`: total carbon cost for the model
- `models_sorted_by_greenest`: models sorted from lowest to highest carbon cost

### GET `/utility-scores`
Score a text query with the GreenKNNRouter.

Returns a list of models with their utility scores (considering both performance and carbon cost), sorted in descending order.

Query parameters:
- `query` (string, required): the text query to evaluate

Response shape:
- `routers`: array of models with:
  - `model`: model name
  - `utility`: utility score (combined performance and carbon efficiency)
  - `performance`: performance score
  - `co2`: CO2 cost score
- `difficulty_score`: estimated query difficulty [0, 1]
- `threshold`: router difficulty threshold
- `best_model`: model name selected with the best utility score

### Carbon cost formula
`carbon_cost = carbon_cost_per_token * (input_tokens + output_tokens)`

### Utility scoring formula
`utility = w1 * performance - w2 * carbon_cost`

Where w1 and w2 are weighting parameters configured in the GreenKNNRouter.