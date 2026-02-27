import uuid
from datetime import datetime
from fastapi import APIRouter
from app.core.llm_chain import generate_audit_explanation

router = APIRouter()

_audit_store: list[dict] = []


@router.post("/generate")
async def generate_audit_trail(mismatch: dict):
    explanation = await generate_audit_explanation(mismatch)

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
    return {"error": "Not found"}


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
