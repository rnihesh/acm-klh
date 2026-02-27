from fastapi import APIRouter, Query
from app.core.reconciler import reconcile_all
from app.core.graph_db import get_graph_data, search_graph, find_circular_trades

router = APIRouter()

# In-memory store for reconciliation results (for hackathon; use DB in production)
_results_store: dict[str, list[dict]] = {}


@router.post("")
async def trigger_reconciliation(return_period: str = "012026"):
    mismatches = reconcile_all(return_period)
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
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    results = _results_store.get(return_period, [])

    if mismatch_type:
        results = [r for r in results if r["mismatch_type"] == mismatch_type]
    if severity:
        results = [r for r in results if r["severity"] == severity]

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
    return {"error": "Not found"}


@router.get("/graph/nodes")
async def get_graph_nodes(limit: int = Query(200, ge=1, le=1000)):
    return get_graph_data(limit)


@router.get("/graph/search")
async def search_graph_nodes(q: str):
    return search_graph(q)


@router.get("/graph/circular-trades")
async def get_circular_trades():
    return find_circular_trades()


def _breakdown(mismatches: list[dict]) -> dict:
    breakdown = {}
    for m in mismatches:
        t = m["mismatch_type"]
        breakdown[t] = breakdown.get(t, 0) + 1
    return breakdown
