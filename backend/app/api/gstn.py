"""GSTN/GSP Mock API — simulates fetching data from government portal."""

import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "sample")


class GSTNFetchRequest(BaseModel):
    gstin: str
    return_period: str = "012026"


@router.post("/fetch-gstr1")
async def fetch_gstr1(req: GSTNFetchRequest):
    return _load_sample_data("gstr1_invoices.json", req.gstin, "GSTR1", req.return_period)


@router.post("/fetch-gstr2b")
async def fetch_gstr2b(req: GSTNFetchRequest):
    return _load_sample_data("gstr2b_invoices.json", req.gstin, "GSTR2B", req.return_period)


@router.post("/fetch-gstr3b")
async def fetch_gstr3b(req: GSTNFetchRequest):
    return _load_sample_data("gstr3b_returns.json", req.gstin, "GSTR3B", req.return_period)


@router.get("/status")
async def gstn_status():
    return {
        "status": "simulated",
        "message": "GSTN/GSP connection is simulated for demo purposes",
        "api_version": "v1.0",
        "supported_returns": ["GSTR1", "GSTR2B", "GSTR3B"],
    }


def _load_sample_data(filename: str, gstin: str, return_type: str, period: str):
    filepath = os.path.join(SAMPLE_DIR, filename)
    if not os.path.exists(filepath):
        return {"status": "success", "source": "GSTN (simulated)", "return_type": return_type, "records": [], "message": "No sample data available"}

    with open(filepath) as f:
        data = json.load(f)

    if return_type == "GSTR3B":
        filtered = [r for r in data if r.get("gstin") == gstin]
    else:
        key = "supplier_gstin" if return_type == "GSTR1" else "buyer_gstin"
        filtered = [r for r in data if r.get(key) == gstin]

    return {
        "status": "success",
        "source": "GSTN (simulated)",
        "return_type": return_type,
        "gstin": gstin,
        "return_period": period,
        "record_count": len(filtered),
        "records": filtered[:100],
    }
