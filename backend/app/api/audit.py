import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, HTMLResponse
from app.core.llm_chain import generate_audit_explanation
from app.core.report_generator import generate_reconciliation_report, generate_html_report

router = APIRouter()

_audit_store: list[dict] = []


@router.post("/generate")
async def generate_audit_trail(mismatch: dict):
    if not mismatch.get("mismatch_type"):
        raise HTTPException(status_code=400, detail="mismatch_type is required")

    try:
        explanation = await generate_audit_explanation(mismatch)
    except Exception as e:
        explanation = f"Unable to generate AI explanation: {str(e)}"

    trail = {
        "id": str(uuid.uuid4()),
        "mismatch_id": mismatch.get("id", ""),
        "explanation": explanation,
        "invoice_chain": [
            {
                "step": 1,
                "action": "Seller files GSTR-1",
                "gstin": mismatch.get("supplier_gstin"),
                "invoice": mismatch.get("invoice_number"),
            },
            {
                "step": 2,
                "action": "System generates buyer's GSTR-2B",
                "gstin": mismatch.get("buyer_gstin"),
                "status": "Mismatch detected" if mismatch.get("mismatch_type") else "Matched",
            },
            {
                "step": 3,
                "action": "Buyer claims ITC in GSTR-3B",
                "gstin": mismatch.get("buyer_gstin"),
                "impact": f"INR {mismatch.get('amount_difference', 0)} at risk",
            },
        ],
        "recommendation": _get_recommendation(mismatch.get("mismatch_type", "")),
        "generated_at": datetime.now().isoformat(),
    }

    _audit_store.append(trail)
    return trail


@router.get("/trails")
async def list_audit_trails():
    return _audit_store


@router.get("/trails/{trail_id}")
async def get_audit_trail(trail_id: str):
    for trail in _audit_store:
        if trail["id"] == trail_id:
            return trail
    raise HTTPException(status_code=404, detail=f"Audit trail {trail_id} not found")


@router.get("/report/pdf")
async def download_pdf_report(return_period: str = "012026"):
    """Generate and download a PDF audit report for the given return period."""
    from app.api.reconcile import _results_store
    from app.core.risk_model import calculate_all_vendor_risks

    mismatches = _results_store.get(return_period, [])
    if not mismatches:
        raise HTTPException(
            status_code=404,
            detail=f"No reconciliation results for period {return_period}. Run reconciliation first.",
        )

    try:
        vendors = calculate_all_vendor_risks()
    except Exception:
        vendors = []

    pdf_bytes = generate_reconciliation_report(
        return_period=return_period,
        mismatches=mismatches,
        audit_trails=_audit_store,
        risky_vendors=vendors,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=GST_Audit_Report_{return_period}.pdf"},
    )


@router.get("/report/html")
async def view_html_report(return_period: str = "012026"):
    """Generate and view an HTML audit report for the given return period."""
    from app.api.reconcile import _results_store
    from app.core.risk_model import calculate_all_vendor_risks

    mismatches = _results_store.get(return_period, [])
    if not mismatches:
        raise HTTPException(
            status_code=404,
            detail=f"No reconciliation results for period {return_period}. Run reconciliation first.",
        )

    try:
        vendors = calculate_all_vendor_risks()
    except Exception:
        vendors = []

    html = generate_html_report(
        return_period=return_period,
        mismatches=mismatches,
        audit_trails=_audit_store,
        risky_vendors=vendors,
    )

    return HTMLResponse(content=html)


def _get_recommendation(mismatch_type: str) -> str:
    recommendations = {
        "MISSING_IN_GSTR2B": "Contact supplier to file/amend their GSTR-1. Do not claim ITC until invoice reflects in GSTR-2B.",
        "MISSING_IN_GSTR1": "Verify purchase register entry. If genuine, request supplier to include in next GSTR-1 filing.",
        "VALUE_MISMATCH": "Compare original invoice with filed returns. Issue credit/debit note to correct the difference.",
        "RATE_MISMATCH": "Verify HSN code and applicable GST rate. Amend the return with correct rate.",
        "PERIOD_MISMATCH": "Check invoice date vs return period. Claim ITC in the correct period as per Section 16(4).",
        "DUPLICATE_INVOICE": "Investigate duplicate entries. Cancel one and file amendment if already submitted.",
        "EXCESS_ITC": "Reduce ITC claim to match GSTR-2B available amount. Respond to DRC-01C if issued.",
        "GSTIN_ERROR": "Verify GSTIN with supplier. File amendment to correct the GSTIN in the return.",
    }
    return recommendations.get(mismatch_type, "Review the mismatch details and take corrective action.")
