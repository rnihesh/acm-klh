import json
import csv
import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.graph_db import get_driver, ingest_invoice_with_relations, ingest_taxpayer

router = APIRouter()


@router.post("/upload")
async def upload_data(
    file: UploadFile = File(...),
    return_type: str = "GSTR1",
    return_period: str = "012026",
):
    if return_type not in ("GSTR1", "GSTR2B", "GSTR3B", "PURCHASE_REGISTER"):
        raise HTTPException(status_code=400, detail=f"Invalid return_type: {return_type}")

    content = await file.read()
    text = content.decode("utf-8")

    if file.filename.endswith(".json"):
        data = json.loads(text)
    elif file.filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(text))
        data = list(reader)
    else:
        raise HTTPException(status_code=400, detail="Only JSON and CSV files supported")

    if not isinstance(data, list):
        data = [data]

    driver = get_driver()
    ingested = 0

    with driver.session() as session:
        for record in data:
            # Convert string numbers to float
            for field in ["taxable_value", "cgst", "sgst", "igst", "total_value", "gst_rate"]:
                if field in record and isinstance(record[field], str):
                    record[field] = float(record[field])

            # Set defaults
            record.setdefault("reverse_charge", False)
            record.setdefault("invoice_type", "B2B")

            session.execute_write(
                ingest_invoice_with_relations,
                record,
                return_type,
                return_period,
            )
            ingested += 1

    return {
        "status": "success",
        "return_type": return_type,
        "return_period": return_period,
        "records_ingested": ingested,
    }


@router.post("/upload-taxpayers")
async def upload_taxpayers(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8")

    if file.filename.endswith(".json"):
        data = json.loads(text)
    elif file.filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(text))
        data = list(reader)
    else:
        raise HTTPException(status_code=400, detail="Only JSON and CSV files supported")

    if not isinstance(data, list):
        data = [data]

    driver = get_driver()
    ingested = 0

    with driver.session() as session:
        for record in data:
            record.setdefault("trade_name", record.get("legal_name", ""))
            record.setdefault("registration_type", "Regular")
            record.setdefault("status", "Active")
            session.execute_write(ingest_taxpayer, record)
            ingested += 1

    return {"status": "success", "taxpayers_ingested": ingested}
