from app.core.graph_db import get_driver, find_circular_trades
from app.models.gst import VendorRisk, RiskLevel


def calculate_all_vendor_risks() -> list[dict]:
    driver = get_driver()
    circular_gstins = _get_circular_trade_gstins()

    vendors = []
    with driver.session() as session:
        result = session.run(
            """
            MATCH (t:Taxpayer)
            OPTIONAL MATCH (t)-[:FILED]->(g1:GSTR1Return)
            OPTIONAL MATCH (t)-[:FILED]->(g3:GSTR3BReturn)
            OPTIONAL MATCH (t)-[:TRADES_WITH]->(partner:Taxpayer)
            OPTIONAL MATCH (inv:Invoice)-[:SUPPLIED_BY]->(t)
            WITH t,
                 COUNT(DISTINCT g1) AS gstr1_count,
                 COUNT(DISTINCT g3) AS gstr3b_count,
                 COUNT(DISTINCT partner) AS trade_partners,
                 COUNT(DISTINCT inv) AS invoice_count
            RETURN t.gstin AS gstin,
                   t.legal_name AS legal_name,
                   gstr1_count,
                   gstr3b_count,
                   trade_partners,
                   invoice_count
            """
        )
        for record in result:
            gstin = record["gstin"]
            gstr1_count = record["gstr1_count"]
            gstr3b_count = record["gstr3b_count"]
            invoice_count = record["invoice_count"]

            # Filing rate: expected 12 months per year (approximate)
            expected_filings = 12
            filing_rate = min(100, ((gstr1_count + gstr3b_count) / max(1, expected_filings * 2)) * 100)

            # Mismatch count for this vendor
            mismatch_count = _get_vendor_mismatch_count(session, gstin)

            # Circular trade check
            in_circular = gstin in circular_gstins

            # Risk factors
            risk_factors = []
            if filing_rate < 50:
                risk_factors.append("Low filing compliance")
            if mismatch_count > 5:
                risk_factors.append("High mismatch frequency")
            if in_circular:
                risk_factors.append("Involved in circular trading pattern")
            if invoice_count > 0 and mismatch_count / max(1, invoice_count) > 0.3:
                risk_factors.append("Mismatch rate exceeds 30%")

            # Composite risk score (0-100, higher = riskier)
            filing_score = max(0, (100 - filing_rate)) * 0.25
            mismatch_score = min(100, (mismatch_count / max(1, invoice_count)) * 100) * 0.30
            circular_score = 100 * 0.25 if in_circular else 0
            volume_score = min(100, mismatch_count * 5) * 0.20

            risk_score = round(filing_score + mismatch_score + circular_score + volume_score, 1)

            # Risk level
            if risk_score >= 75:
                risk_level = RiskLevel.CRITICAL.value
            elif risk_score >= 50:
                risk_level = RiskLevel.HIGH.value
            elif risk_score >= 25:
                risk_level = RiskLevel.MEDIUM.value
            else:
                risk_level = RiskLevel.LOW.value

            vendors.append({
                "gstin": gstin,
                "legal_name": legal_name if (legal_name := record["legal_name"]) else "Unknown",
                "risk_score": risk_score,
                "risk_level": risk_level,
                "filing_rate": round(filing_rate, 1),
                "mismatch_count": mismatch_count,
                "total_invoices": invoice_count,
                "circular_trade_flag": in_circular,
                "risk_factors": risk_factors,
            })

    return sorted(vendors, key=lambda v: v["risk_score"], reverse=True)


def calculate_single_vendor_risk(gstin: str) -> dict | None:
    all_vendors = calculate_all_vendor_risks()
    for v in all_vendors:
        if v["gstin"] == gstin:
            return v
    return None


def _get_circular_trade_gstins() -> set:
    cycles = find_circular_trades()
    gstins = set()
    for cycle in cycles:
        gstins.update(cycle["cycle"])
    return gstins


def _get_vendor_mismatch_count(session, gstin: str) -> int:
    result = session.run(
        """
        MATCH (inv:Invoice)
        WHERE inv.supplier_gstin = $gstin OR inv.buyer_gstin = $gstin
        WITH inv
        MATCH (g1:GSTR1Return)-[:CONTAINS_OUTWARD]->(inv)
        WHERE NOT EXISTS {
            MATCH (g2b:GSTR2BReturn)-[:CONTAINS_INWARD]->(inv2:Invoice)
            WHERE inv2.invoice_number = inv.invoice_number
              AND inv2.supplier_gstin = inv.supplier_gstin
        }
        RETURN COUNT(inv) AS mismatch_count
        """,
        gstin=gstin,
    )
    record = result.single()
    return record["mismatch_count"] if record else 0
