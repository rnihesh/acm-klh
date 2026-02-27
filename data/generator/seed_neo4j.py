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

PERIODS = ["112025", "122025", "012026"]


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


def upload_if_exists(endpoint: str, filepath: str, params: dict | None = None):
    """Upload a file if it exists, otherwise skip with a warning."""
    if not os.path.exists(filepath):
        print(f"  [SKIP] {filepath} not found")
        return None
    result = upload_file(endpoint, filepath, params)
    print(f"  {result}")
    return result


def main():
    if not os.path.exists(os.path.join(SAMPLE_DIR, "taxpayers.json")):
        print("Sample data not found. Run mock_gst_data.py first.")
        sys.exit(1)

    print(f"Seeding Neo4j via {API_BASE}...\n")

    # 1. Upload taxpayers (shared across all periods)
    print("Uploading taxpayers...")
    result = upload_file(
        "/api/data/upload-taxpayers",
        os.path.join(SAMPLE_DIR, "taxpayers.json"),
    )
    print(f"  {result}\n")

    # 2. Upload data for each period
    for period in PERIODS:
        print(f"=== Period {period} ===\n")

        # --- GSTR-1 ---
        print(f"Uploading GSTR-1 invoices for {period}...")
        # Try period-specific file first, fall back to combined file for 012026
        period_file = os.path.join(SAMPLE_DIR, f"gstr1_invoices_{period}.json")
        combined_file = os.path.join(SAMPLE_DIR, "gstr1_invoices.json")
        if os.path.exists(period_file):
            result = upload_file(
                "/api/data/upload",
                period_file,
                {"return_type": "GSTR1", "return_period": period},
            )
            print(f"  {result}\n")
        elif period == "012026" and os.path.exists(combined_file):
            result = upload_file(
                "/api/data/upload",
                combined_file,
                {"return_type": "GSTR1", "return_period": period},
            )
            print(f"  {result} (from combined file)\n")
        else:
            print(f"  [SKIP] No GSTR-1 file found for {period}\n")

        # --- GSTR-2B ---
        print(f"Uploading GSTR-2B invoices for {period}...")
        period_file = os.path.join(SAMPLE_DIR, f"gstr2b_invoices_{period}.json")
        combined_file = os.path.join(SAMPLE_DIR, "gstr2b_invoices.json")
        if os.path.exists(period_file):
            result = upload_file(
                "/api/data/upload",
                period_file,
                {"return_type": "GSTR2B", "return_period": period},
            )
            print(f"  {result}\n")
        elif period == "012026" and os.path.exists(combined_file):
            result = upload_file(
                "/api/data/upload",
                combined_file,
                {"return_type": "GSTR2B", "return_period": period},
            )
            print(f"  {result} (from combined file)\n")
        else:
            print(f"  [SKIP] No GSTR-2B file found for {period}\n")

        # --- GSTR-3B ---
        print(f"Uploading GSTR-3B returns for {period}...")
        period_file = os.path.join(SAMPLE_DIR, f"gstr3b_returns_{period}.json")
        combined_file = os.path.join(SAMPLE_DIR, "gstr3b_returns.json")
        if os.path.exists(period_file):
            result = upload_file(
                "/api/data/upload",
                period_file,
                {"return_type": "GSTR3B", "return_period": period},
            )
            print(f"  {result}\n")
        elif period == "012026" and os.path.exists(combined_file):
            result = upload_file(
                "/api/data/upload",
                combined_file,
                {"return_type": "GSTR3B", "return_period": period},
            )
            print(f"  {result} (from combined file)\n")
        else:
            print(f"  [SKIP] No GSTR-3B file found for {period}\n")

        # --- E-invoices ---
        print(f"Uploading e-invoices for {period}...")
        period_file = os.path.join(SAMPLE_DIR, f"einvoices_{period}.json")
        combined_file = os.path.join(SAMPLE_DIR, "einvoices.json")
        if os.path.exists(period_file):
            result = upload_file(
                "/api/data/upload",
                period_file,
                {"return_type": "EINVOICE", "return_period": period},
            )
            print(f"  {result}\n")
        elif period == "012026" and os.path.exists(combined_file):
            result = upload_file(
                "/api/data/upload",
                combined_file,
                {"return_type": "EINVOICE", "return_period": period},
            )
            print(f"  {result} (from combined file)\n")
        else:
            print(f"  [SKIP] No e-invoice file found for {period}\n")

        # --- E-way bills ---
        print(f"Uploading e-way bills for {period}...")
        period_file = os.path.join(SAMPLE_DIR, f"eway_bills_{period}.json")
        combined_file = os.path.join(SAMPLE_DIR, "eway_bills.json")
        if os.path.exists(period_file):
            result = upload_file(
                "/api/data/upload",
                period_file,
                {"return_type": "EWAY_BILL", "return_period": period},
            )
            print(f"  {result}\n")
        elif period == "012026" and os.path.exists(combined_file):
            result = upload_file(
                "/api/data/upload",
                combined_file,
                {"return_type": "EWAY_BILL", "return_period": period},
            )
            print(f"  {result} (from combined file)\n")
        else:
            print(f"  [SKIP] No e-way bill file found for {period}\n")

        # --- Purchase register ---
        print(f"Uploading purchase register for {period}...")
        period_file = os.path.join(SAMPLE_DIR, f"purchase_register_{period}.json")
        combined_file = os.path.join(SAMPLE_DIR, "purchase_register.json")
        if os.path.exists(period_file):
            result = upload_file(
                "/api/data/upload",
                period_file,
                {"return_type": "PURCHASE_REGISTER", "return_period": period},
            )
            print(f"  {result}\n")
        elif period == "012026" and os.path.exists(combined_file):
            result = upload_file(
                "/api/data/upload",
                combined_file,
                {"return_type": "PURCHASE_REGISTER", "return_period": period},
            )
            print(f"  {result} (from combined file)\n")
        else:
            print(f"  [SKIP] No purchase register file found for {period}\n")

    # 3. Trigger reconciliation for each period
    for period in PERIODS:
        print(f"Triggering reconciliation for {period}...")
        resp = httpx.post(
            f"{API_BASE}/api/reconcile",
            params={"return_period": period},
            timeout=60,
        )
        print(f"  {resp.json()}\n")

    print("Seeding complete!")


if __name__ == "__main__":
    main()
