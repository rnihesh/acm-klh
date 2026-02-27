"""
Seed Neo4j with generated mock data via the FastAPI upload endpoints.

Usage:
    # Ensure backend is running at localhost:8000
    uv run python data/generator/seed_neo4j.py
"""

import json
import os
import sys
import httpx

API_BASE = os.getenv("API_URL", "http://localhost:8000")
SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "sample")


def upload_file(endpoint: str, filepath: str, params: dict | None = None):
    """Upload a file to the API."""
    with open(filepath, "rb") as f:
        files = {"file": (os.path.basename(filepath), f, "application/json")}
        resp = httpx.post(
            f"{API_BASE}{endpoint}",
            files=files,
            params=params or {},
            timeout=60,
        )
    resp.raise_for_status()
    return resp.json()


def main():
    if not os.path.exists(os.path.join(SAMPLE_DIR, "taxpayers.json")):
        print("Sample data not found. Run mock_gst_data.py first.")
        sys.exit(1)

    print(f"Seeding Neo4j via {API_BASE}...\n")

    # 1. Upload taxpayers
    print("Uploading taxpayers...")
    result = upload_file(
        "/api/data/upload-taxpayers",
        os.path.join(SAMPLE_DIR, "taxpayers.json"),
    )
    print(f"  {result}\n")

    # 2. Upload GSTR-1
    print("Uploading GSTR-1 invoices...")
    result = upload_file(
        "/api/data/upload",
        os.path.join(SAMPLE_DIR, "gstr1_invoices.json"),
        {"return_type": "GSTR1", "return_period": "012026"},
    )
    print(f"  {result}\n")

    # 3. Upload GSTR-2B
    print("Uploading GSTR-2B invoices...")
    result = upload_file(
        "/api/data/upload",
        os.path.join(SAMPLE_DIR, "gstr2b_invoices.json"),
        {"return_type": "GSTR2B", "return_period": "012026"},
    )
    print(f"  {result}\n")

    # 4. Upload GSTR-3B
    print("Uploading GSTR-3B returns...")
    result = upload_file(
        "/api/data/upload",
        os.path.join(SAMPLE_DIR, "gstr3b_returns.json"),
        {"return_type": "GSTR3B", "return_period": "012026"},
    )
    print(f"  {result}\n")

    # 5. Trigger reconciliation
    print("Triggering reconciliation...")
    resp = httpx.post(
        f"{API_BASE}/api/reconcile",
        params={"return_period": "012026"},
        timeout=60,
    )
    print(f"  {resp.json()}\n")

    print("Seeding complete!")


if __name__ == "__main__":
    main()
