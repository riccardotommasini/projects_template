"""Download one complete week of GDELT event exports into the raw landing zone."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


MASTERFILELIST_URL = "http://data.gdeltproject.org/gdeltv2/masterfilelist.txt"
DEFAULT_START_DATE = date(2024, 12, 17)
DOWNLOAD_RETRIES = 3
RETRY_DELAY_SECONDS = 2


def parse_timestamp(value: str) -> datetime:
    """Parse a GDELT timestamp and return a timezone-aware UTC datetime."""
    return datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)


def md5_file(path: Path) -> str:
    """Return the MD5 checksum used by the GDELT master file list."""
    digest = hashlib.md5()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, destination: Path) -> int:
    """Download a URL atomically and return the resulting file size."""
    temporary = destination.with_suffix(destination.suffix + ".part")
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            with temporary.open("wb") as stream:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    stream.write(chunk)
        temporary.replace(destination)
    finally:
        if temporary.exists():
            temporary.unlink()
    return destination.stat().st_size


def download_with_retries(
    url: str,
    destination: Path,
    retries: int = DOWNLOAD_RETRIES,
) -> tuple[int, int]:
    """Download a file with bounded retries and return its size and attempts."""
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return download(url, destination), attempt
        except (OSError, urllib.error.URLError) as error:
            last_error = error
            if attempt < retries:
                time.sleep(RETRY_DELAY_SECONDS * attempt)
    raise RuntimeError(f"Download failed after {retries} attempts: {last_error}")


def validate_zip(path: Path) -> None:
    """Fail fast when a downloaded archive is not a valid ZIP file."""
    with zipfile.ZipFile(path) as archive:
        if len(archive.namelist()) != 1:
            raise ValueError(f"Unexpected archive members in {path.name}")


def fetch_masterfilelist(start_day: date, end_day: date) -> list[dict[str, object]]:
    """Read the official catalog and select event exports for a seven-day period."""
    entries: list[dict[str, object]] = []
    with urllib.request.urlopen(MASTERFILELIST_URL, timeout=120) as response:
        for raw_line in response:
            parts = raw_line.decode("utf-8").strip().split()
            if len(parts) != 3 or ".export.CSV.zip" not in parts[2]:
                continue
            timestamp = parts[2].rsplit("/", 1)[-1].split(".")[0]
            export_time = parse_timestamp(timestamp)
            if start_day <= export_time.date() <= end_day:
                entries.append(
                    {
                        "timestamp_utc": timestamp,
                        "expected_size_bytes": int(parts[0]),
                        "expected_md5": parts[1],
                        "url": parts[2],
                    }
                )
    return entries


def download_week(
    output_dir: Path,
    start_day: date,
    end_day: date,
    overwrite: bool,
) -> list[dict[str, object]]:
    """Download catalogued event exports and return one manifest row per file."""
    rows: list[dict[str, object]] = []
    entries = fetch_masterfilelist(start_day, end_day)
    for entry in entries:
        timestamp = str(entry["timestamp_utc"])
        current_day = parse_timestamp(timestamp).date()
        day_dir = output_dir / current_day.isoformat()
        day_dir.mkdir(parents=True, exist_ok=True)
        destination = day_dir / f"{timestamp}.export.CSV.zip"
        row: dict[str, object] = {
            "date_utc": current_day.isoformat(),
            "timestamp_utc": timestamp,
            "url": entry["url"],
            "file": str(destination.relative_to(output_dir)),
            "expected_size_bytes": entry["expected_size_bytes"],
            "expected_md5": entry["expected_md5"],
            "attempts": 0,
        }
        try:
            existing_is_valid = False
            existing_is_corrupt = destination.exists() and not overwrite
            if destination.exists() and not overwrite:
                existing_size = destination.stat().st_size
                existing_md5 = md5_file(destination)
                existing_is_valid = (
                    existing_size == entry["expected_size_bytes"]
                    and existing_md5 == entry["expected_md5"]
                )
                existing_is_corrupt = not existing_is_valid
            if existing_is_valid:
                size = destination.stat().st_size
                row["status"] = "skipped_valid"
                row["attempts"] = 0
            else:
                size, attempts = download_with_retries(str(entry["url"]), destination)
                row["attempts"] = attempts
                validate_zip(destination)
                row["status"] = "redownloaded_corrupt" if existing_is_corrupt else "downloaded"
            actual_md5 = md5_file(destination)
            row["size_bytes"] = size
            row["md5"] = actual_md5
            row["integrity_ok"] = (
                size == entry["expected_size_bytes"]
                and actual_md5 == entry["expected_md5"]
            )
            if not row["integrity_ok"]:
                row["status"] = "integrity_failed"
        except (OSError, RuntimeError, ValueError, urllib.error.URLError) as error:
            row["status"] = "download_failed"
            row["error"] = str(error)
            row["size_bytes"] = 0
            row["md5"] = ""
            row["integrity_ok"] = False
        rows.append(row)
        print(f"{row['status']}: {timestamp}", flush=True)
    return rows


def write_manifest(output_dir: Path, rows: list[dict[str, object]]) -> None:
    """Write file-level and daily summary manifests."""
    with (output_dir / "manifest.json").open("w", encoding="utf-8") as stream:
        json.dump(rows, stream, indent=2)

    with (output_dir / "manifest.csv").open("w", newline="", encoding="utf-8") as stream:
        fields = [
            "date_utc", "timestamp_utc", "url", "file", "status",
            "expected_size_bytes", "size_bytes", "expected_md5", "md5",
            "integrity_ok", "attempts", "error",
        ]
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    summary: dict[str, dict[str, int]] = {}
    for row in rows:
        day = str(row["date_utc"])
        day_summary = summary.setdefault(
            day,
            {"file_count": 0, "total_size_bytes": 0, "failed_count": 0, "integrity_failures": 0},
        )
        if row["integrity_ok"]:
            day_summary["file_count"] += 1
            day_summary["total_size_bytes"] += int(row["size_bytes"])
        else:
            day_summary["failed_count"] += 1
            if row["status"] == "integrity_failed":
                day_summary["integrity_failures"] += 1

    with (output_dir / "daily_summary.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=[
                "date_utc", "file_count", "total_size_bytes",
                "failed_count", "integrity_failures",
            ],
        )
        writer.writeheader()
        for day, values in sorted(summary.items()):
            writer.writerow({"date_utc": day, **values})

    with (output_dir / "manifest_metadata.json").open("w", encoding="utf-8") as stream:
        dates = sorted(summary)
        json.dump(
            {
                "source": "GDELT masterfilelist",
                "masterfilelist_url": MASTERFILELIST_URL,
                "start_date_utc": dates[0] if dates else None,
                "end_date_utc": dates[-1] if dates else None,
                "expected_file_count": len(rows),
                "expected_files_per_day": {
                    day: values["file_count"] + values["failed_count"]
                    for day, values in sorted(summary.items())
                },
                "verified_file_count": sum(
                    values["file_count"] for values in summary.values()
                ),
            },
            stream,
            indent=2,
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path("data/raw_landing/gdelt"))
    parser.add_argument("--start-date", type=date.fromisoformat, default=DEFAULT_START_DATE)
    parser.add_argument("--end-date", type=date.fromisoformat)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    end_day = args.end_date or (args.start_date + timedelta(days=6))
    if end_day != args.start_date + timedelta(days=6):
        parser.error("The spike must cover exactly seven consecutive days")
    print(f"Downloading catalogued UTC days: {args.start_date} to {end_day}")
    rows = download_week(args.output_dir, args.start_date, end_day, args.overwrite)
    write_manifest(args.output_dir, rows)
    failures = sum(not row["integrity_ok"] for row in rows)
    print(f"Files expected: {len(rows)}; integrity failures: {failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
