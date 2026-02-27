from fastapi import APIRouter, Query, HTTPException, Body
from app.core.reconciler import reconcile_all, reconcile_purchase_register
from app.core.graph_db import get_graph_data, search_graph, find_circular_trades, get_taxpayer_network
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# In-memory store for reconciliation results (for hackathon; use DB in production)
_results_store: dict[str, list[dict]] = {}


class ReconcileRequest(BaseModel):
    return_period: str = "012026"


@router.post("")
async def trigger_reconciliation(body: Optional[ReconcileRequest] = None, return_period: str = Query(None)):
    return_period = return_period or (body.return_period if body else "012026")
    try:
        mismatches = reconcile_all(return_period)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reconciliation failed: {str(e)}")
    _results_store[return_period] = mismatches
    return {
        "status": "completed",
        "return_period": return_period,
        "total_mismatches": len(mismatches),
        "breakdown": _breakdown(mismatches),
    }


@router.get("/results")
async def get_results(
    return_period: str = "012026",
    mismatch_type: str | None = None,
    severity: str | None = None,
    supplier_gstin: str | None = None,
    buyer_gstin: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    results = _results_store.get(return_period, [])

    if mismatch_type:
        results = [r for r in results if r["mismatch_type"] == mismatch_type]
    if severity:
        results = [r for r in results if r["severity"] == severity]
    if supplier_gstin:
        results = [r for r in results if r["supplier_gstin"] == supplier_gstin]
    if buyer_gstin:
        results = [r for r in results if r["buyer_gstin"] == buyer_gstin]

    total = len(results)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": results[start:end],
    }


@router.get("/results/{mismatch_id}")
async def get_single_result(mismatch_id: str):
    for period_results in _results_store.values():
        for r in period_results:
            if r["id"] == mismatch_id:
                return r
    raise HTTPException(status_code=404, detail=f"Mismatch {mismatch_id} not found")


@router.get("/graph/nodes")
async def get_graph_nodes(limit: int = Query(200, ge=1, le=1000)):
    try:
        return get_graph_data(limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch graph data: {str(e)}")


@router.get("/graph/search")
async def search_graph_nodes(q: str):
    if not q or len(q) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
    try:
        return search_graph(q)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/graph/circular-trades")
async def get_circular_trades():
    try:
        return find_circular_trades()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Circular trade detection failed: {str(e)}")


@router.get("/graph/taxpayer-network")
async def get_taxpayer_network_endpoint(gstin: str):
    """Get the subgraph centered on a specific taxpayer — for hub layout visualization."""
    if not gstin or len(gstin) < 2:
        raise HTTPException(status_code=400, detail="GSTIN is required")
    try:
        return get_taxpayer_network(gstin)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Taxpayer network fetch failed: {str(e)}")


@router.post("/purchase-register")
async def reconcile_pr(
    gstin: str,
    return_period: str = "012026",
    purchase_records: list[dict] = [],
):
    """Reconcile purchase register entries against GSTR-2B for a specific taxpayer."""
    if not gstin:
        raise HTTPException(status_code=400, detail="gstin is required")
    if not purchase_records:
        raise HTTPException(status_code=400, detail="purchase_records list is required")
    try:
        mismatches = reconcile_purchase_register(gstin, purchase_records, return_period)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Purchase register reconciliation failed: {str(e)}")

    # Store results under a special key
    store_key = f"PR_{gstin}_{return_period}"
    _results_store[store_key] = mismatches
    return {
        "status": "completed",
        "gstin": gstin,
        "return_period": return_period,
        "total_mismatches": len(mismatches),
        "results": mismatches,
    }


def _breakdown(mismatches: list[dict]) -> dict:
    breakdown = {}
    for m in mismatches:
        t = m["mismatch_type"]
        breakdown[t] = breakdown.get(t, 0) + 1
    return breakdown
