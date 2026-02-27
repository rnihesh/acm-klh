from fastapi import APIRouter
from app.core.graph_db import get_driver

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
        mismatches = session.run(
            "MATCH (i:Invoice) WHERE i.mismatch_type IS NOT NULL RETURN count(i) AS c"
        ).single()["c"]
        gstr1_count = session.run(
            "MATCH (r:GSTR1Return) RETURN count(r) AS c"
        ).single()["c"]
        gstr2b_count = session.run(
            "MATCH (r:GSTR2BReturn) RETURN count(r) AS c"
        ).single()["c"]

    return {
        "total_taxpayers": taxpayers,
        "total_invoices": invoices,
        "total_transaction_value": round(total_value, 2),
        "total_mismatches": mismatches,
        "gstr1_returns_filed": gstr1_count,
        "gstr2b_returns_generated": gstr2b_count,
    }


@router.get("/mismatch-summary")
async def get_mismatch_summary():
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (i:Invoice) WHERE i.mismatch_type IS NOT NULL
            RETURN i.mismatch_type AS type, count(i) AS count,
                   sum(i.total_value) AS total_value
            ORDER BY count DESC
            """
        )
        breakdown = [
            {
                "mismatch_type": r["type"],
                "count": r["count"],
                "total_value": round(r["total_value"], 2),
            }
            for r in result
        ]
    return {"breakdown": breakdown}


@router.get("/top-risky-vendors")
async def get_top_risky_vendors():
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (t:Taxpayer)-[:SUPPLIED_BY|SUPPLIED_TO]-(i:Invoice)
            WITH t, count(i) AS invoice_count,
                 sum(CASE WHEN i.mismatch_type IS NOT NULL THEN 1 ELSE 0 END) AS mismatch_count
            WHERE mismatch_count > 0
            RETURN t.gstin AS gstin, t.trade_name AS name,
                   invoice_count, mismatch_count,
                   round(toFloat(mismatch_count) / invoice_count * 100, 1) AS mismatch_rate
            ORDER BY mismatch_rate DESC
            LIMIT 10
            """
        )
        vendors = [dict(r) for r in result]
    return {"top_risky_vendors": vendors}
