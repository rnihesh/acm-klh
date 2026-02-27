from fastapi import APIRouter
from app.core.graph_db import get_driver
from app.api.reconcile import _results_store
from app.core.risk_model import calculate_all_vendor_risks

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_stats():
    driver = get_driver()
    with driver.session() as session:
        taxpayers = session.run("MATCH (t:Taxpayer) RETURN count(t) AS c").single()["c"]
        invoices = session.run("MATCH (i:Invoice) RETURN count(i) AS c").single()["c"]
        total_value = session.run(
            "MATCH (i:Invoice) RETURN coalesce(sum(i.total_value), 0) AS v"
        ).single()["v"]
        gstr1_count = session.run(
            "MATCH (r:GSTR1Return) RETURN count(r) AS c"
        ).single()["c"]
        gstr2b_count = session.run(
            "MATCH (r:GSTR2BReturn) RETURN count(r) AS c"
        ).single()["c"]
        gstr3b_count = session.run(
            "MATCH (r:GSTR3BReturn) RETURN count(r) AS c"
        ).single()["c"]

    # Aggregate mismatches from in-memory reconciliation results
    all_mismatches = []
    for period_results in _results_store.values():
        all_mismatches.extend(period_results)

    total_mismatches = len(all_mismatches)

    # ITC at risk: sum of amount_difference for all mismatches
    total_itc_at_risk = sum(m.get("amount_difference", 0) for m in all_mismatches)

    # Mismatch type breakdown
    mismatch_breakdown = {}
    severity_breakdown = {}
    for m in all_mismatches:
        mt = m.get("mismatch_type", "UNKNOWN")
        mismatch_breakdown[mt] = mismatch_breakdown.get(mt, 0) + 1
        sev = m.get("severity", "UNKNOWN")
        severity_breakdown[sev] = severity_breakdown.get(sev, 0) + 1

    # High risk vendor count
    try:
        vendors = calculate_all_vendor_risks()
        high_risk_vendors = sum(1 for v in vendors if v["risk_level"] in ("HIGH", "CRITICAL"))
    except Exception:
        high_risk_vendors = 0

    return {
        "total_taxpayers": taxpayers,
        "total_invoices": invoices,
        "total_transaction_value": round(total_value, 2),
        "total_mismatches": total_mismatches,
        "total_itc_at_risk": round(total_itc_at_risk, 2),
        "high_risk_vendors": high_risk_vendors,
        "gstr1_returns_filed": gstr1_count,
        "gstr2b_returns_generated": gstr2b_count,
        "gstr3b_returns_filed": gstr3b_count,
        "mismatch_breakdown": mismatch_breakdown,
        "severity_breakdown": severity_breakdown,
    }


@router.get("/mismatch-summary")
async def get_mismatch_summary():
    """Mismatch summary from reconciliation results."""
    all_mismatches = []
    for period_results in _results_store.values():
        all_mismatches.extend(period_results)

    breakdown = {}
    for m in all_mismatches:
        mt = m.get("mismatch_type", "UNKNOWN")
        if mt not in breakdown:
            breakdown[mt] = {"mismatch_type": mt, "count": 0, "total_amount": 0.0}
        breakdown[mt]["count"] += 1
        breakdown[mt]["total_amount"] += m.get("amount_difference", 0)

    result = sorted(breakdown.values(), key=lambda x: x["count"], reverse=True)
    for item in result:
        item["total_amount"] = round(item["total_amount"], 2)

    return {"breakdown": result}


@router.get("/top-risky-vendors")
async def get_top_risky_vendors():
    try:
        vendors = calculate_all_vendor_risks()
        top = [v for v in vendors if v["risk_score"] > 0][:10]
    except Exception:
        top = []
    return {"top_risky_vendors": top}
