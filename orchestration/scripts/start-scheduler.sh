#!/usr/bin/env bash
# Runs the Airflow scheduler and the dag-processor in the same container.
# Exits as soon as either process stops, so Docker restarts the whole container.
set -uo pipefail

airflow scheduler &
scheduler_pid=$!
airflow dag-processor &
processor_pid=$!

stop_all() {
  kill -TERM "$scheduler_pid" "$processor_pid" 2>/dev/null
  wait
}
trap 'stop_all; exit 0' TERM INT

wait -n
status=$?
echo "start-scheduler: a process exited with status ${status}, stopping the other one" >&2
stop_all
if [ "$status" -eq 0 ]; then
  status=1
fi
exit "$status"
