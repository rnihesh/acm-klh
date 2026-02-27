from fastapi import APIRouter
from app.core.risk_model import calculate_all_vendor_risks, calculate_single_vendor_risk
from app.core.llm_chain import generate_risk_summary

router = APIRouter()


@router.get("/vendors")
async def get_vendor_risks():
    return calculate_all_vendor_risks()


@router.get("/vendors/{gstin}")
async def get_vendor_risk_detail(gstin: str):
    vendor = calculate_single_vendor_risk(gstin)
    if not vendor:
        return {"error": "Vendor not found"}
    return vendor


@router.get("/vendors/{gstin}/summary")
async def get_vendor_risk_ai_summary(gstin: str):
    vendor = calculate_single_vendor_risk(gstin)
    if not vendor:
        return {"error": "Vendor not found"}
    summary = await generate_risk_summary(vendor)
    return {"vendor": vendor, "ai_summary": summary}
