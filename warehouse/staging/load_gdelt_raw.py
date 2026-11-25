"""Load raw GDELT event exports into a typed DuckDB staging table."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import time
import zipfile
from pathlib import Path

import duckdb
import psutil


GDELT_COLUMNS = [
    ("GlobalEventID", "BIGINT"),
    ("Day", "INTEGER"),
    ("MonthYear", "INTEGER"),
    ("Year", "INTEGER"),
    ("FractionDate", "DOUBLE"),
    ("Actor1Code", "VARCHAR"),
    ("Actor1Name", "VARCHAR"),
    ("Actor1CountryCode", "VARCHAR"),
    ("Actor1KnownGroupCode", "VARCHAR"),
    ("Actor1EthnicCode", "VARCHAR"),
    ("Actor1Religion1Code", "VARCHAR"),
    ("Actor1Religion2Code", "VARCHAR"),
    ("Actor1Type1Code", "VARCHAR"),
    ("Actor1Type2Code", "VARCHAR"),
    ("Actor1Type3Code", "VARCHAR"),
    ("Actor2Code", "VARCHAR"),
    ("Actor2Name", "VARCHAR"),
    ("Actor2CountryCode", "VARCHAR"),
    ("Actor2KnownGroupCode", "VARCHAR"),
    ("Actor2EthnicCode", "VARCHAR"),
    ("Actor2Religion1Code", "VARCHAR"),
    ("Actor2Religion2Code", "VARCHAR"),
    ("Actor2Type1Code", "VARCHAR"),
    ("Actor2Type2Code", "VARCHAR"),
    ("Actor2Type3Code", "VARCHAR"),
    ("IsRootEvent", "INTEGER"),
    ("EventCode", "VARCHAR"),
    ("EventBaseCode", "VARCHAR"),
    ("EventRootCode", "VARCHAR"),
    ("QuadClass", "INTEGER"),
    ("GoldsteinScale", "DOUBLE"),
    ("NumMentions", "BIGINT"),
    ("NumSources", "BIGINT"),
    ("NumArticles", "BIGINT"),
    ("AvgTone", "DOUBLE"),
    ("Actor1Geo_Type", "INTEGER"),
    ("Actor1Geo_FullName", "VARCHAR"),
    ("Actor1Geo_CountryCode", "VARCHAR"),
    ("Actor1Geo_ADM1Code", "VARCHAR"),
    ("Actor1Geo_ADM2Code", "VARCHAR"),
    ("Actor1Geo_Lat", "DOUBLE"),
    ("Actor1Geo_Long", "DOUBLE"),
    ("Actor1Geo_FeatureID", "VARCHAR"),
    ("Actor2Geo_Type", "INTEGER"),
    ("Actor2Geo_FullName", "VARCHAR"),
    ("Actor2Geo_CountryCode", "VARCHAR"),
    ("Actor2Geo_ADM1Code", "VARCHAR"),
    ("Actor2Geo_ADM2Code", "VARCHAR"),
    ("Actor2Geo_Lat", "DOUBLE"),
    ("Actor2Geo_Long", "DOUBLE"),
    ("Actor2Geo_FeatureID", "VARCHAR"),
    ("ActionGeo_Type", "INTEGER"),
    ("ActionGeo_FullName", "VARCHAR"),
    ("ActionGeo_CountryCode", "VARCHAR"),
    ("ActionGeo_ADM1Code", "VARCHAR"),
    ("ActionGeo_ADM2Code", "VARCHAR"),
    ("ActionGeo_Lat", "DOUBLE"),
    ("ActionGeo_Long", "DOUBLE"),
    ("ActionGeo_FeatureID", "VARCHAR"),
    ("DATEADDED", "BIGINT"),
    ("SOURCEURL", "VARCHAR"),
]

TABLE_NAME = "stg_gdelt_raw"
REJECTS_TABLE = "stg_gdelt_raw_rejects"


def create_schema(connection: duckdb.DuckDBPyConnection) -> None:
    columns = ",\n".join(f'"{name}" {kind}' for name, kind in GDELT_COLUMNS)
    connection.execute(f"CREATE TABLE IF NOT EXISTS {TABLE_NAME} ({columns})")
    # Lineage: the archive each row came from, so a file can be reloaded without duplicates.
    connection.execute(f"ALTER TABLE {TABLE_NAME} ADD COLUMN IF NOT EXISTS source_file VARCHAR")
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {REJECTS_TABLE} (
            file_name VARCHAR,
            reject_line BIGINT,
            reject_reason VARCHAR,
            raw_line VARCHAR
        )
        """
    )


def extract_csv(archive: Path, temporary_dir: Path) -> Path:
    with zipfile.ZipFile(archive) as source:
        members = [member for member in source.namelist() if member.endswith(".CSV")]
    if len(members) != 1:
        raise ValueError(f"{archive.name} contains {len(members)} CSV members")
    target = temporary_dir / Path(members[0]).name
    with zipfile.ZipFile(archive) as source, target.open("wb") as destination:
        with source.open(members[0]) as stream:
            shutil.copyfileobj(stream, destination)
    return target


def load_archive(
    connection: duckdb.DuckDBPyConnection,
    archive: Path,
    temporary_dir: Path,
) -> dict[str, int | str]:
    csv_path = extract_csv(archive, temporary_dir)
    columns = "{" + ", ".join(f"'{name}': '{kind}'" for name, kind in GDELT_COLUMNS) + "}"
    # DuckDB keeps rejected lines in session-wide temp tables; clear them per file.
    connection.execute("DROP TABLE IF EXISTS reject_errors")
    connection.execute("DROP TABLE IF EXISTS reject_scans")
    connection.begin()
    try:
        # Replace this file's rows so a rerun never duplicates them.
        connection.execute(f"DELETE FROM {TABLE_NAME} WHERE source_file = ?", [archive.name])
        connection.execute(f"DELETE FROM {REJECTS_TABLE} WHERE file_name = ?", [archive.name])
        connection.execute(
            f"""
            INSERT INTO {TABLE_NAME}
            SELECT *, ? AS source_file
            FROM read_csv(
                '{csv_path.as_posix()}',
                delim='\\t',
                header=false,
                columns={columns},
                nullstr='',
                store_rejects=true
            )
            """,
            [archive.name],
        )
        connection.execute(
            f"""
            INSERT INTO {REJECTS_TABLE}
            SELECT ?, line, error_type || ': ' || error_message, csv_line
            FROM reject_errors
            -- One row per bad line: a truncated line otherwise logs one error per missing column.
            QUALIFY row_number() OVER (PARTITION BY line ORDER BY column_idx) = 1
            """,
            [archive.name],
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    loaded_rows = connection.execute(
        f"SELECT COUNT(*) FROM {TABLE_NAME} WHERE source_file = ?", [archive.name]
    ).fetchone()[0]
    with csv_path.open("rb") as stream:
        raw_rows = sum(1 for _ in stream)
    return {
        "file": archive.name,
        "raw_rows": raw_rows,
        "loaded_rows": loaded_rows,
        "read_errors": max(raw_rows - loaded_rows, 0),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=Path("data/raw_landing/gdelt"))
    parser.add_argument("--database", type=Path, default=Path("data/warehouse/diplomap.duckdb"))
    parser.add_argument("--metrics", type=Path)
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    archives = sorted(args.raw_dir.glob("*/*.export.CSV.zip"))
    if not archives:
        raise SystemExit(f"No GDELT archives found under {args.raw_dir}")
    args.database.parent.mkdir(parents=True, exist_ok=True)
    metrics_path = args.metrics or args.raw_dir / "load_metrics.json"
    process = psutil.Process(os.getpid())
    started = time.perf_counter()
    peak_rss = process.memory_info().rss

    with duckdb.connect(str(args.database)) as connection:
        if args.reset:
            connection.execute(f"DROP TABLE IF EXISTS {TABLE_NAME}")
            connection.execute(f"DROP TABLE IF EXISTS {REJECTS_TABLE}")
        create_schema(connection)
        with tempfile.TemporaryDirectory(prefix="gdelt_load_") as temporary:
            file_results = []
            for archive in archives:
                file_result = load_archive(connection, archive, Path(temporary))
                file_results.append(file_result)
                peak_rss = max(peak_rss, process.memory_info().rss)

        total_rows = connection.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]
        reject_rows = connection.execute(
            f"SELECT COUNT(DISTINCT (file_name, reject_line)) FROM {REJECTS_TABLE}"
        ).fetchone()[0]

    metrics = {
        "database": str(args.database),
        "table": TABLE_NAME,
        "files_processed": len(archives),
        "rows_loaded": total_rows,
        "unreadable_rows": reject_rows,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "peak_memory_bytes": peak_rss,
        "file_results": file_results,
    }
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    with metrics_path.open("w", encoding="utf-8") as stream:
        json.dump(metrics, stream, indent=2)
    print(json.dumps(metrics, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
