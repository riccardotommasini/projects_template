"""Regenerate backend/openapi.json and sample_datasets/api/*.json from the code.

    python backend/export_openapi.py
"""

import json
from pathlib import Path

from examples import EXAMPLES
from main import app

BACKEND = Path(__file__).resolve().parent
SAMPLES = BACKEND.parent / "sample_datasets" / "api"


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    write_json(BACKEND / "openapi.json", app.openapi())
    SAMPLES.mkdir(parents=True, exist_ok=True)
    for name, payload in EXAMPLES.items():
        write_json(SAMPLES / f"{name}.json", payload)
    print(f"wrote {BACKEND / 'openapi.json'} and {len(EXAMPLES)} files in {SAMPLES}")
