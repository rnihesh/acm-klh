from fastapi import APIRouter, HTTPException
from app.core.risk_model import calculate_all_vendor_risks, calculate_single_vendor_risk
from app.core.llm_chain import generate_risk_summary

router = APIRouter()


@router.get("/vendors")
async def get_vendor_risks():
    try:
        return calculate_all_vendor_risks()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk calculation failed: {str(e)}")


@router.get("/vendors/{gstin}")
async def get_vendor_risk_detail(gstin: str):
    try:
        vendor = calculate_single_vendor_risk(gstin)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk calculation failed: {str(e)}")
    if not vendor:
        raise HTTPException(status_code=404, detail=f"Vendor {gstin} not found")
    return vendor


@router.get("/vendors/{gstin}/summary")
async def get_vendor_risk_ai_summary(gstin: str):
    try:
        vendor = calculate_single_vendor_risk(gstin)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk calculation failed: {str(e)}")
    if not vendor:
        raise HTTPException(status_code=404, detail=f"Vendor {gstin} not found")
    try:
        summary = await generate_risk_summary(vendor)
    except Exception as e:
        summary = f"Unable to generate AI summary: {str(e)}"
    return {"vendor": vendor, "ai_summary": summary}


@router.get("/vendors/{gstin}/scorecard")
async def get_vendor_scorecard(gstin: str):
    from app.core.graph_db import get_driver
    from app.api.reconcile import _results_store

    vendor = calculate_single_vendor_risk(gstin)
    if not vendor:
        raise HTTPException(status_code=404, detail=f"Vendor {gstin} not found")

    driver = get_driver()
    with driver.session() as session:
        # Filing history
        filing_history = []
        for return_label, return_type in [("GSTR1", "GSTR1Return"), ("GSTR2B", "GSTR2BReturn"), ("GSTR3B", "GSTR3BReturn")]:
            result = session.run(
                f"MATCH (r:{return_type}) WHERE r.gstin = $gstin RETURN r.return_period AS period",
                gstin=gstin,
            )
            for r in result:
                filing_history.append({"period": r["period"], "return_type": return_label, "status": "Filed"})

        # Trade partners
        partner_result = session.run(
            """
            MATCH (t:Taxpayer {gstin: $gstin})-[tw:TRADES_WITH]->(p:Taxpayer)
            RETURN p.gstin AS gstin, p.legal_name AS name,
                   tw.volume AS volume, tw.frequency AS frequency
            ORDER BY tw.volume DESC LIMIT 20
            """,
            gstin=gstin,
        )
        trade_partners = [
            {"gstin": r["gstin"], "name": r["name"], "volume": r["volume"], "frequency": r["frequency"]}
            for r in partner_result
        ]

        # ITC breakdown
        itc_result = session.run(
            """
            MATCH (r:GSTR3BReturn {gstin: $gstin})
            RETURN r.return_period AS period,
                   r.itc_claimed AS claimed,
                   r.itc_available AS eligible
            ORDER BY r.return_period
            """,
            gstin=gstin,
        )
        itc_breakdown = [
            {"period": r["period"], "claimed": r["claimed"] or 0, "eligible": r["eligible"] or 0}
            for r in itc_result
        ]

    # Mismatch timeline from in-memory store
    mismatch_timeline = []
    for period, results in _results_store.items():
        count = sum(1 for m in results if m.get("supplier_gstin") == gstin or m.get("buyer_gstin") == gstin)
        if count > 0:
            mismatch_timeline.append({"period": period, "count": count})

    # Risk factor breakdown
    risk_breakdown = {
        "filing_compliance": {"weight": 0.25, "score": max(0, (100 - vendor["filing_rate"])) * 0.25},
        "mismatch_frequency": {"weight": 0.30, "score": min(100, (vendor["mismatch_count"] / max(1, vendor["total_invoices"])) * 100) * 0.30},
        "circular_trading": {"weight": 0.25, "score": 25.0 if vendor["circular_trade_flag"] else 0.0},
        "volume_anomaly": {"weight": 0.20, "score": min(100, vendor["mismatch_count"] * 5) * 0.20},
    }

    return {
        "vendor": vendor,
        "filing_history": sorted(filing_history, key=lambda x: x["period"]),
        "trade_partners": trade_partners,
        "itc_breakdown": itc_breakdown,
        "mismatch_timeline": sorted(mismatch_timeline, key=lambda x: x["period"]),
        "risk_breakdown": risk_breakdown,
    }
