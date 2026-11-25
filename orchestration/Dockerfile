# Airflow image for DiploMap: official image plus orchestration/requirements.txt,
# installed against the official Airflow constraints file.
FROM apache/airflow:3.3.2-python3.12

ARG AIRFLOW_VERSION=3.3.2
ARG PYTHON_VERSION=3.12

COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir "apache-airflow==${AIRFLOW_VERSION}" -r /requirements.txt \
    --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-${PYTHON_VERSION}.txt"

COPY --chmod=0755 scripts/start-scheduler.sh /opt/airflow/scripts/start-scheduler.sh
