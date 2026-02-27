import uuid
from app.core.graph_db import get_driver
from app.models.gst import MismatchResult, MismatchType, Severity


def reconcile_all(return_period: str) -> list[dict]:
    mismatches = []
    mismatches.extend(reconcile_gstr1_vs_gstr2b(return_period))
    mismatches.extend(reconcile_gstr2b_vs_gstr1(return_period))
    mismatches.extend(find_excess_itc(return_period))
    mismatches.extend(find_duplicate_invoices(return_period))
    return mismatches


def reconcile_gstr1_vs_gstr2b(return_period: str) -> list[dict]:
    driver = get_driver()
    mismatches = []

    with driver.session() as session:
        # Find invoices in GSTR-1 but missing from GSTR-2B
        result = session.run(
            """
            MATCH (g1:GSTR1Return {return_period: $period})-[:CONTAINS_OUTWARD]->(inv1:Invoice)
            WHERE NOT EXISTS {
                MATCH (g2b:GSTR2BReturn {return_period: $period})-[:CONTAINS_INWARD]->(inv2:Invoice)
                WHERE inv2.invoice_number = inv1.invoice_number
                  AND inv2.supplier_gstin = inv1.supplier_gstin
                  AND inv2.buyer_gstin = inv1.buyer_gstin
            }
            RETURN inv1
            """,
            period=return_period,
        )
        for record in result:
            inv = dict(record["inv1"])
            mismatches.append({
                "id": str(uuid.uuid4()),
                "mismatch_type": MismatchType.MISSING_IN_GSTR2B.value,
                "severity": _severity_for_amount(inv.get("total_value", 0)),
                "supplier_gstin": inv.get("supplier_gstin", ""),
                "buyer_gstin": inv.get("buyer_gstin", ""),
                "invoice_number": inv.get("invoice_number", ""),
                "return_period": return_period,
                "field_name": None,
                "expected_value": str(inv.get("total_value", 0)),
                "actual_value": "NOT FOUND",
                "amount_difference": inv.get("total_value", 0),
                "description": f"Invoice {inv.get('invoice_number')} filed in supplier's GSTR-1 but not reflected in buyer's GSTR-2B. Buyer cannot claim ITC of INR {inv.get('total_value', 0)}.",
            })

        # Find value mismatches between GSTR-1 and GSTR-2B
        result = session.run(
            """
            MATCH (g1:GSTR1Return {return_period: $period})-[:CONTAINS_OUTWARD]->(inv1:Invoice)
            MATCH (g2b:GSTR2BReturn {return_period: $period})-[:CONTAINS_INWARD]->(inv2:Invoice)
            WHERE inv1.invoice_number = inv2.invoice_number
              AND inv1.supplier_gstin = inv2.supplier_gstin
              AND inv1.buyer_gstin = inv2.buyer_gstin
              AND (inv1.taxable_value <> inv2.taxable_value
                OR inv1.cgst <> inv2.cgst
                OR inv1.sgst <> inv2.sgst
                OR inv1.igst <> inv2.igst)
            RETURN inv1, inv2
            """,
            period=return_period,
        )
        for record in result:
            inv1 = dict(record["inv1"])
            inv2 = dict(record["inv2"])

            # Check which field mismatches
            for field in ["taxable_value", "cgst", "sgst", "igst"]:
                val1 = inv1.get(field, 0)
                val2 = inv2.get(field, 0)
                if val1 != val2:
                    diff = abs(val1 - val2)
                    mismatches.append({
                        "id": str(uuid.uuid4()),
                        "mismatch_type": MismatchType.VALUE_MISMATCH.value,
                        "severity": _severity_for_amount(diff),
                        "supplier_gstin": inv1.get("supplier_gstin", ""),
                        "buyer_gstin": inv1.get("buyer_gstin", ""),
                        "invoice_number": inv1.get("invoice_number", ""),
                        "return_period": return_period,
                        "field_name": field,
                        "expected_value": str(val1),
                        "actual_value": str(val2),
                        "amount_difference": diff,
                        "description": f"Value mismatch in {field}: GSTR-1 shows INR {val1} but GSTR-2B shows INR {val2} for invoice {inv1.get('invoice_number')}.",
                    })

        # Find rate mismatches
        result = session.run(
            """
            MATCH (g1:GSTR1Return {return_period: $period})-[:CONTAINS_OUTWARD]->(inv1:Invoice)
            MATCH (g2b:GSTR2BReturn {return_period: $period})-[:CONTAINS_INWARD]->(inv2:Invoice)
            WHERE inv1.invoice_number = inv2.invoice_number
              AND inv1.supplier_gstin = inv2.supplier_gstin
              AND inv1.gst_rate <> inv2.gst_rate
            RETURN inv1, inv2
            """,
            period=return_period,
        )
        for record in result:
            inv1 = dict(record["inv1"])
            inv2 = dict(record["inv2"])
            mismatches.append({
                "id": str(uuid.uuid4()),
                "mismatch_type": MismatchType.RATE_MISMATCH.value,
                "severity": Severity.HIGH.value,
                "supplier_gstin": inv1.get("supplier_gstin", ""),
                "buyer_gstin": inv1.get("buyer_gstin", ""),
                "invoice_number": inv1.get("invoice_number", ""),
                "return_period": return_period,
                "field_name": "gst_rate",
                "expected_value": str(inv1.get("gst_rate")),
                "actual_value": str(inv2.get("gst_rate")),
                "amount_difference": abs(inv1.get("total_value", 0) - inv2.get("total_value", 0)),
                "description": f"GST rate mismatch: GSTR-1 shows {inv1.get('gst_rate')}% but GSTR-2B shows {inv2.get('gst_rate')}% for invoice {inv1.get('invoice_number')}.",
            })

    return mismatches


def reconcile_gstr2b_vs_gstr1(return_period: str) -> list[dict]:
    """Find invoices in GSTR-2B that are missing from GSTR-1 (potential fake ITC claims)."""
    driver = get_driver()
    mismatches = []

    with driver.session() as session:
        result = session.run(
            """
            MATCH (g2b:GSTR2BReturn {return_period: $period})-[:CONTAINS_INWARD]->(inv2:Invoice)
            WHERE NOT EXISTS {
                MATCH (g1:GSTR1Return {return_period: $period})-[:CONTAINS_OUTWARD]->(inv1:Invoice)
                WHERE inv1.invoice_number = inv2.invoice_number
                  AND inv1.supplier_gstin = inv2.supplier_gstin
                  AND inv1.buyer_gstin = inv2.buyer_gstin
            }
            RETURN inv2
            """,
            period=return_period,
        )
        for record in result:
            inv = dict(record["inv2"])
            mismatches.append({
                "id": str(uuid.uuid4()),
                "mismatch_type": MismatchType.MISSING_IN_GSTR1.value,
                "severity": _severity_for_amount(inv.get("total_value", 0)),
                "supplier_gstin": inv.get("supplier_gstin", ""),
                "buyer_gstin": inv.get("buyer_gstin", ""),
                "invoice_number": inv.get("invoice_number", ""),
                "return_period": return_period,
                "field_name": None,
                "expected_value": "PRESENT IN GSTR-1",
                "actual_value": "NOT FOUND",
                "amount_difference": inv.get("total_value", 0),
                "description": f"Invoice {inv.get('invoice_number')} appears in buyer's GSTR-2B but supplier has not filed it in GSTR-1. Possible fake ITC claim of INR {inv.get('total_value', 0)}.",
            })

    return mismatches


def find_excess_itc(return_period: str) -> list[dict]:
    driver = get_driver()
    mismatches = []

    with driver.session() as session:
        result = session.run(
            """
            MATCH (g3b:GSTR3BReturn {return_period: $period})
            OPTIONAL MATCH (g2b:GSTR2BReturn {gstin: g3b.gstin, return_period: $period})-[:CONTAINS_INWARD]->(inv:Invoice)
            WITH g3b, COALESCE(SUM(inv.cgst + inv.sgst + inv.igst), 0) AS computed_itc
            WITH g3b, computed_itc,
                 CASE WHEN computed_itc > 0 THEN computed_itc ELSE g3b.itc_available END AS available_itc
            WHERE g3b.itc_claimed > available_itc
            RETURN g3b.gstin AS gstin, g3b.itc_claimed AS claimed, available_itc
            """,
            period=return_period,
        )
        for record in result:
            diff = record["claimed"] - record["available_itc"]
            mismatches.append({
                "id": str(uuid.uuid4()),
                "mismatch_type": MismatchType.EXCESS_ITC.value,
                "severity": _severity_for_amount(diff),
                "supplier_gstin": "",
                "buyer_gstin": record["gstin"],
                "invoice_number": "AGGREGATE",
                "return_period": return_period,
                "field_name": "itc_claimed",
                "expected_value": str(record["available_itc"]),
                "actual_value": str(record["claimed"]),
                "amount_difference": diff,
                "description": f"Excess ITC claimed: GSTR-3B claims INR {record['claimed']} but GSTR-2B only supports INR {record['available_itc']}. Excess: INR {diff}.",
            })

    return mismatches


def find_duplicate_invoices(return_period: str) -> list[dict]:
    driver = get_driver()
    mismatches = []

    with driver.session() as session:
        result = session.run(
            """
            MATCH (inv:Invoice {return_period: $period})
            WITH inv.invoice_number AS inv_num, inv.supplier_gstin AS supplier, COUNT(*) AS cnt
            WHERE cnt > 2
            RETURN inv_num, supplier, cnt
            """,
            period=return_period,
        )
        for record in result:
            mismatches.append({
                "id": str(uuid.uuid4()),
                "mismatch_type": MismatchType.DUPLICATE_INVOICE.value,
                "severity": Severity.HIGH.value,
                "supplier_gstin": record["supplier"],
                "buyer_gstin": "",
                "invoice_number": record["inv_num"],
                "return_period": return_period,
                "field_name": "invoice_number",
                "expected_value": "1-2 occurrences",
                "actual_value": str(record["cnt"]),
                "amount_difference": 0,
                "description": f"Invoice {record['inv_num']} from {record['supplier']} appears {record['cnt']} times — possible duplicate filing.",
            })

    return mismatches


def _severity_for_amount(amount: float) -> str:
    if amount >= 500000:
        return Severity.CRITICAL.value
    elif amount >= 100000:
        return Severity.HIGH.value
    elif amount >= 10000:
        return Severity.MEDIUM.value
    return Severity.LOW.value


def reconcile_purchase_register(gstin: str, purchase_records: list[dict], return_period: str) -> list[dict]:
    """
    Match purchase register entries against GSTR-2B.
    - In books but not in GSTR-2B → can't claim ITC
    - In GSTR-2B but not in books → missing from accounting
    """
    driver = get_driver()
    mismatches = []

    with driver.session() as session:
        # Get all GSTR-2B invoices for this buyer
        result = session.run(
            """
            MATCH (g2b:GSTR2BReturn {gstin: $gstin, return_period: $period})-[:CONTAINS_INWARD]->(inv:Invoice)
            RETURN inv.invoice_number AS invoice_number,
                   inv.supplier_gstin AS supplier_gstin,
                   inv.taxable_value AS taxable_value,
                   inv.total_value AS total_value,
                   inv.gst_rate AS gst_rate,
                   inv.cgst AS cgst,
                   inv.sgst AS sgst,
                   inv.igst AS igst
            """,
            gstin=gstin,
            period=return_period,
        )
        gstr2b_invoices = {
            f"{r['supplier_gstin']}_{r['invoice_number']}": dict(r)
            for r in result
        }

    # Build purchase register lookup
    pr_invoices = {
        f"{rec.get('supplier_gstin', '')}_{rec.get('invoice_number', '')}": rec
        for rec in purchase_records
    }

    # In purchase register but not in GSTR-2B
    for key, rec in pr_invoices.items():
        if key not in gstr2b_invoices:
            mismatches.append({
                "id": str(uuid.uuid4()),
                "mismatch_type": MismatchType.MISSING_IN_GSTR2B.value,
                "severity": _severity_for_amount(rec.get("total_value", 0)),
                "supplier_gstin": rec.get("supplier_gstin", ""),
                "buyer_gstin": gstin,
                "invoice_number": rec.get("invoice_number", ""),
                "return_period": return_period,
                "field_name": None,
                "expected_value": "PRESENT IN GSTR-2B",
                "actual_value": "NOT FOUND",
                "amount_difference": rec.get("total_value", 0),
                "description": f"Invoice {rec.get('invoice_number')} from purchase register not found in GSTR-2B. ITC of INR {rec.get('total_value', 0)} cannot be claimed.",
            })

    # In GSTR-2B but not in purchase register
    for key, inv in gstr2b_invoices.items():
        if key not in pr_invoices:
            mismatches.append({
                "id": str(uuid.uuid4()),
                "mismatch_type": MismatchType.MISSING_IN_GSTR1.value,
                "severity": Severity.MEDIUM.value,
                "supplier_gstin": inv.get("supplier_gstin", ""),
                "buyer_gstin": gstin,
                "invoice_number": inv.get("invoice_number", ""),
                "return_period": return_period,
                "field_name": None,
                "expected_value": "PRESENT IN PURCHASE REGISTER",
                "actual_value": "NOT FOUND",
                "amount_difference": inv.get("total_value", 0),
                "description": f"Invoice {inv.get('invoice_number')} found in GSTR-2B but missing from purchase register. Update books to claim ITC.",
            })
        else:
            # Both exist — compare values
            pr_rec = pr_invoices[key]
            for field in ["taxable_value", "cgst", "sgst", "igst"]:
                val_2b = inv.get(field, 0) or 0
                val_pr = float(pr_rec.get(field, 0) or 0)
                if abs(val_2b - val_pr) > 0.01:
                    diff = abs(val_2b - val_pr)
                    mismatches.append({
                        "id": str(uuid.uuid4()),
                        "mismatch_type": MismatchType.VALUE_MISMATCH.value,
                        "severity": _severity_for_amount(diff),
                        "supplier_gstin": inv.get("supplier_gstin", ""),
                        "buyer_gstin": gstin,
                        "invoice_number": inv.get("invoice_number", ""),
                        "return_period": return_period,
                        "field_name": field,
                        "expected_value": str(val_2b),
                        "actual_value": str(val_pr),
                        "amount_difference": diff,
                        "description": f"Purchase register vs GSTR-2B mismatch in {field}: Books show INR {val_pr} but GSTR-2B shows INR {val_2b}.",
                    })

    return mismatches
