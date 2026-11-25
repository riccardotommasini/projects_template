# Backend image: FastAPI app serving /health, /docs, /openapi.json and the API
# routes (contract P1-12, handlers P1-13). The modules are copied flat into /app.
# Warehouse mode also needs ./warehouse mounted read-only at /opt/diplomap/warehouse
# with PYTHONPATH=/opt/diplomap (P4's queries.cypher), and /data mounted read-only.
FROM python:3.12.16-slim-bookworm

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py api.py schemas.py examples.py repository.py ./

RUN useradd --uid 10001 --no-create-home app
USER app

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
