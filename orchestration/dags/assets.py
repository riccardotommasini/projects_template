"""Airflow assets emitted by ingestion DAGs and consumed by the warehouse DAG."""

from airflow.sdk import Asset


gdelt_landing = Asset("diplomap://landing/gdelt")
wikipedia_landing = Asset("diplomap://landing/wikipedia")
wikidata_landing = Asset("diplomap://landing/wikidata")
