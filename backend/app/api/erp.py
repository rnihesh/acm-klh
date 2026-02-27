"""ERP Connector endpoints — parse Tally/Zoho/SAP exports into standard invoice format."""

import csv
import io
import json
from xml.etree import ElementTree
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.graph_db import get_driver, ingest_invoice_with_relations

router = APIRouter()


@router.post("/import/tally")
async def import_tally(file: UploadFile = File(...), return_period: str = "012026"):
    content = await file.read()
    text = content.decode("utf-8")

    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError:
        raise HTTPException(status_code=400, detail="Invalid XML format. Expected Tally voucher XML.")

    invoices = []
    for voucher in root.iter("VOUCHER"):
        invoice = _parse_tally_voucher(voucher)
        if invoice:
            invoices.append(invoice)

    if not invoices:
        raise HTTPException(status_code=400, detail="No valid vouchers found in XML")

    ingested = _ingest_invoices(invoices, return_period)
    return {"status": "success", "source": "Tally", "records_ingested": ingested, "return_period": return_period}


@router.post("/import/zoho")
async def import_zoho(file: UploadFile = File(...), return_period: str = "012026"):
    content = await file.read()
    text = content.decode("utf-8")

    try:
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid CSV format. Expected Zoho Books export.")

    invoices = []
    for row in rows:
        invoice = _parse_zoho_row(row)
        if invoice:
            invoices.append(invoice)

    if not invoices:
        raise HTTPException(status_code=400, detail="No valid invoices found in CSV")

    ingested = _ingest_invoices(invoices, return_period)
    return {"status": "success", "source": "Zoho Books", "records_ingested": ingested, "return_period": return_period}


@router.post("/import/sap")
async def import_sap(file: UploadFile = File(...), return_period: str = "012026"):
    content = await file.read()
    text = content.decode("utf-8")

    # Try CSV first, then XML (SAP IDoc)
    invoices = []
    try:
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        for row in rows:
            invoice = _parse_sap_row(row)
            if invoice:
                invoices.append(invoice)
    except Exception:
        try:
            root = ElementTree.fromstring(text)
            for idoc in root.iter("IDOC"):
                invoice = _parse_sap_idoc(idoc)
                if invoice:
                    invoices.append(invoice)
        except ElementTree.ParseError:
            raise HTTPException(status_code=400, detail="Invalid format. Expected SAP CSV or IDoc XML.")

    if not invoices:
        raise HTTPException(status_code=400, detail="No valid invoices found")

    ingested = _ingest_invoices(invoices, return_period)
    return {"status": "success", "source": "SAP", "records_ingested": ingested, "return_period": return_period}


def _ingest_invoices(invoices: list[dict], return_period: str) -> int:
    driver = get_driver()
    ingested = 0
    with driver.session() as session:
        for inv in invoices:
            for field in ["taxable_value", "cgst", "sgst", "igst", "total_value", "gst_rate"]:
                if field in inv and isinstance(inv[field], str):
                    inv[field] = float(inv[field])
            inv.setdefault("reverse_charge", False)
            inv.setdefault("invoice_type", "B2B")
            session.execute_write(ingest_invoice_with_relations, inv, "GSTR1", return_period)
            ingested += 1
    return ingested


def _parse_tally_voucher(voucher) -> dict | None:
    try:
        return {
            "supplier_gstin": voucher.findtext("PARTYLEDGERNAME", ""),
            "buyer_gstin": voucher.findtext("BASICBUYERNAME", ""),
            "invoice_number": voucher.findtext("VOUCHERNUMBER", ""),
            "invoice_date": voucher.findtext("DATE", ""),
            "taxable_value": float(voucher.findtext("AMOUNT", "0")),
            "cgst": float(voucher.findtext("CGST", "0")),
            "sgst": float(voucher.findtext("SGST", "0")),
            "igst": float(voucher.findtext("IGST", "0")),
            "total_value": float(voucher.findtext("AMOUNT", "0")),
            "gst_rate": float(voucher.findtext("GSTRATE", "18")),
            "hsn_code": voucher.findtext("HSNCODE", ""),
            "place_of_supply": voucher.findtext("PLACEOFSUPPLY", ""),
        }
    except (ValueError, TypeError):
        return None


def _parse_zoho_row(row: dict) -> dict | None:
    try:
        return {
            "supplier_gstin": row.get("Supplier GSTIN", row.get("supplier_gstin", "")),
            "buyer_gstin": row.get("Buyer GSTIN", row.get("buyer_gstin", "")),
            "invoice_number": row.get("Invoice Number", row.get("invoice_number", "")),
            "invoice_date": row.get("Invoice Date", row.get("invoice_date", "")),
            "taxable_value": float(row.get("Taxable Value", row.get("taxable_value", 0))),
            "cgst": float(row.get("CGST", row.get("cgst", 0))),
            "sgst": float(row.get("SGST", row.get("sgst", 0))),
            "igst": float(row.get("IGST", row.get("igst", 0))),
            "total_value": float(row.get("Total", row.get("total_value", 0))),
            "gst_rate": float(row.get("GST Rate", row.get("gst_rate", 18))),
            "hsn_code": row.get("HSN/SAC", row.get("hsn_code", "")),
            "place_of_supply": row.get("Place of Supply", row.get("place_of_supply", "")),
        }
    except (ValueError, TypeError):
        return None


def _parse_sap_row(row: dict) -> dict | None:
    try:
        return {
            "supplier_gstin": row.get("VENDOR_GSTIN", row.get("supplier_gstin", "")),
            "buyer_gstin": row.get("COMPANY_GSTIN", row.get("buyer_gstin", "")),
            "invoice_number": row.get("DOC_NUMBER", row.get("invoice_number", "")),
            "invoice_date": row.get("DOC_DATE", row.get("invoice_date", "")),
            "taxable_value": float(row.get("NET_AMOUNT", row.get("taxable_value", 0))),
            "cgst": float(row.get("CGST_AMOUNT", row.get("cgst", 0))),
            "sgst": float(row.get("SGST_AMOUNT", row.get("sgst", 0))),
            "igst": float(row.get("IGST_AMOUNT", row.get("igst", 0))),
            "total_value": float(row.get("GROSS_AMOUNT", row.get("total_value", 0))),
            "gst_rate": float(row.get("TAX_RATE", row.get("gst_rate", 18))),
            "hsn_code": row.get("HSN_CODE", row.get("hsn_code", "")),
            "place_of_supply": row.get("SUPPLY_STATE", row.get("place_of_supply", "")),
        }
    except (ValueError, TypeError):
        return None


def _parse_sap_idoc(idoc) -> dict | None:
    try:
        seg = idoc.find(".//E1EDP01")
        if seg is None:
            return None
        return {
            "supplier_gstin": seg.findtext("VENDOR_GSTIN", ""),
            "buyer_gstin": seg.findtext("COMPANY_GSTIN", ""),
            "invoice_number": seg.findtext("BELNR", ""),
            "invoice_date": seg.findtext("BLDAT", ""),
            "taxable_value": float(seg.findtext("NETWR", "0")),
            "cgst": float(seg.findtext("CGST", "0")),
            "sgst": float(seg.findtext("SGST", "0")),
            "igst": float(seg.findtext("IGST", "0")),
            "total_value": float(seg.findtext("WRBTR", "0")),
            "gst_rate": float(seg.findtext("MWSKZ", "18")),
            "hsn_code": seg.findtext("MATNR", ""),
            "place_of_supply": seg.findtext("WERKS", ""),
        }
    except (ValueError, TypeError):
        return None
