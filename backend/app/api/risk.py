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
