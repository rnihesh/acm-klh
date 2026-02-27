import json
import csv
import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.graph_db import (
    get_driver,
    ingest_invoice_with_relations,
    ingest_taxpayer,
    ingest_gstr3b,
    ingest_gstr1_return,
    ingest_gstr2b_return,
    ingest_einvoice,
    ingest_eway_bill,
)

router = APIRouter()


def _parse_upload(file_content: bytes, filename: str) -> list[dict]:
    text = file_content.decode("utf-8")
    if filename.endswith(".json"):
        data = json.loads(text)
    elif filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(text))
        data = list(reader)
    else:
        raise HTTPException(status_code=400, detail="Only JSON and CSV files supported")
    if not isinstance(data, list):
        data = [data]
    return data


@router.post("/upload")
async def upload_data(
    file: UploadFile = File(...),
    return_type: str = "GSTR1",
    return_period: str = "012026",
):
    if return_type not in ("GSTR1", "GSTR2B", "GSTR3B", "PURCHASE_REGISTER", "EINVOICE", "EWAY_BILL"):
        raise HTTPException(status_code=400, detail=f"Invalid return_type: {return_type}")

    content = await file.read()
    data = _parse_upload(content, file.filename)
    driver = get_driver()
    ingested = 0

    # GSTR-3B has a different schema (summary returns, not invoices)
    if return_type == "GSTR3B":
        with driver.session() as session:
            for record in data:
                # Convert string numbers to float
                for field in ["total_itc_claimed", "itc_available_as_per_gstr2b",
                              "output_tax_liability", "tax_paid", "itc_claimed",
                              "itc_available", "output_tax", "net_tax"]:
                    if field in record and isinstance(record[field], str):
                        record[field] = float(record[field])
                session.execute_write(ingest_gstr3b, record, return_period)
                ingested += 1
        return {
            "status": "success",
            "return_type": return_type,
            "return_period": return_period,
            "records_ingested": ingested,
        }

    if return_type == "EINVOICE":
        with driver.session() as session:
            for record in data:
                session.execute_write(ingest_einvoice, record)
                ingested += 1
        return {
            "status": "success",
            "return_type": return_type,
            "return_period": return_period,
            "records_ingested": ingested,
        }

    if return_type == "EWAY_BILL":
        with driver.session() as session:
            for record in data:
                session.execute_write(ingest_eway_bill, record)
                ingested += 1
        return {
            "status": "success",
            "return_type": return_type,
            "return_period": return_period,
            "records_ingested": ingested,
        }

    # Invoice-based returns (GSTR-1, GSTR-2B, PURCHASE_REGISTER)
    with driver.session() as session:
        seen_returns: set[str] = set()
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

            # Create return nodes with FILED/RECEIVED relationships
            if return_type == "GSTR1":
                key = f"GSTR1_{record['supplier_gstin']}"
                if key not in seen_returns:
                    session.execute_write(
                        ingest_gstr1_return, record["supplier_gstin"], return_period
                    )
                    seen_returns.add(key)
            elif return_type == "GSTR2B":
                key = f"GSTR2B_{record['buyer_gstin']}"
                if key not in seen_returns:
                    session.execute_write(
                        ingest_gstr2b_return, record["buyer_gstin"], return_period
                    )
                    seen_returns.add(key)

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
