"""
Generate realistic mock GST data for the reconciliation engine.
Creates taxpayers, invoices (GSTR-1, GSTR-2B), and injects mismatches.

Usage:
    uv run python data/generator/mock_gst_data.py
"""

import json
import random
import string
import os
from datetime import datetime, timedelta

# Indian state codes for GSTIN
STATE_CODES = [
    "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
    "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
    "32", "33", "34", "35", "36", "37",
]

TRADE_NAMES = [
    "Sharma Electronics Pvt Ltd", "Patel Textiles", "Kumar Steel Industries",
    "Gupta Pharma Solutions", "Singh Auto Parts", "Reddy IT Services",
    "Mehta Chemical Works", "Jain Plastics", "Agarwal Food Products",
    "Mishra Construction Co", "Verma Logistics", "Yadav Agriculture",
    "Nair Software Labs", "Iyer Consulting", "Banerjee Exports",
    "Chatterjee Imports", "Deshpande Motors", "Kulkarni Fabrics",
    "Pillai Hardware", "Menon Financial Services", "Bose Engineering",
    "Ghosh Retail Chain", "Mukherjee Commodities", "Saha Trading Co",
    "Mondal Electronics Hub", "Biswas Paper Mills", "Halder Ceramics",
    "Chakraborty Chemicals", "Das Auto Dealers", "Roy Metal Works",
]

HSN_CODES = [
    "8471", "5208", "7210", "3004", "8708", "8523", "3901",
    "1006", "2523", "8544", "6109", "7308", "3808", "9018", "4011",
]

GST_RATES = [5.0, 12.0, 18.0, 28.0]

MISMATCH_TYPES = [
    "MISSING_IN_GSTR2B", "MISSING_IN_GSTR1", "VALUE_MISMATCH",
    "RATE_MISMATCH", "DUPLICATE_INVOICE", "EXCESS_ITC",
]


def generate_pan():
    """Generate a random PAN-like string."""
    return (
        random.choice(string.ascii_uppercase)
        + random.choice(string.ascii_uppercase)
        + random.choice(string.ascii_uppercase)
        + random.choice("PCHFATBLJ")
        + random.choice(string.ascii_uppercase)
        + "".join(random.choices(string.digits, k=4))
        + random.choice(string.ascii_uppercase)
    )


def generate_gstin(state_code=None):
    """Generate a valid-format GSTIN."""
    state = state_code or random.choice(STATE_CODES)
    pan = generate_pan()
    entity_num = random.choice(string.digits)
    return f"{state}{pan}{entity_num}Z{random.choice(string.ascii_uppercase + string.digits)}"


def generate_taxpayers(count=30):
    """Generate mock taxpayer records."""
    taxpayers = []
    used_gstins = set()

    for i in range(count):
        gstin = generate_gstin()
        while gstin in used_gstins:
            gstin = generate_gstin()
        used_gstins.add(gstin)

        taxpayers.append({
            "gstin": gstin,
            "legal_name": TRADE_NAMES[i % len(TRADE_NAMES)],
            "trade_name": TRADE_NAMES[i % len(TRADE_NAMES)],
            "state_code": gstin[:2],
            "registration_type": random.choice(["Regular", "Regular", "Regular", "Composition"]),
            "status": random.choice(["Active", "Active", "Active", "Active", "Suspended"]),
        })

    return taxpayers


def generate_invoice_number(prefix="INV"):
    """Generate a random invoice number."""
    return f"{prefix}/{random.randint(2025, 2026)}/{random.randint(1000, 9999)}"


def generate_invoices(taxpayers, count=200, return_period="012026"):
    """Generate GSTR-1 and GSTR-2B invoice records with intentional mismatches."""
    gstr1_records = []
    gstr2b_records = []

    gstins = [t["gstin"] for t in taxpayers]

    for _ in range(count):
        supplier = random.choice(gstins)
        buyer = random.choice([g for g in gstins if g != supplier])

        invoice_number = generate_invoice_number()
        invoice_date = datetime(2026, 1, random.randint(1, 28)).strftime("%Y-%m-%d")
        hsn_code = random.choice(HSN_CODES)
        gst_rate = random.choice(GST_RATES)
        taxable_value = round(random.uniform(5000, 500000), 2)

        is_interstate = supplier[:2] != buyer[:2]
        if is_interstate:
            igst = round(taxable_value * gst_rate / 100, 2)
            cgst = 0.0
            sgst = 0.0
        else:
            cgst = round(taxable_value * gst_rate / 200, 2)
            sgst = cgst
            igst = 0.0

        total_value = round(taxable_value + cgst + sgst + igst, 2)

        base_record = {
            "supplier_gstin": supplier,
            "buyer_gstin": buyer,
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "hsn_code": hsn_code,
            "gst_rate": gst_rate,
            "taxable_value": taxable_value,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total_value": total_value,
            "place_of_supply": buyer[:2],
            "reverse_charge": False,
            "invoice_type": "B2B",
        }

        # Decide if this invoice will have a mismatch
        mismatch_roll = random.random()

        if mismatch_roll < 0.15:
            # MISSING_IN_GSTR2B — only in GSTR-1
            gstr1_records.append(base_record)

        elif mismatch_roll < 0.22:
            # MISSING_IN_GSTR1 — only in GSTR-2B
            gstr2b_records.append(base_record)

        elif mismatch_roll < 0.32:
            # VALUE_MISMATCH
            gstr1_records.append(base_record)
            modified = {**base_record}
            diff = round(random.uniform(500, 50000), 2)
            modified["taxable_value"] = round(base_record["taxable_value"] + diff, 2)
            modified["total_value"] = round(base_record["total_value"] + diff, 2)
            gstr2b_records.append(modified)

        elif mismatch_roll < 0.38:
            # RATE_MISMATCH
            gstr1_records.append(base_record)
            modified = {**base_record}
            other_rates = [r for r in GST_RATES if r != gst_rate]
            modified["gst_rate"] = random.choice(other_rates)
            gstr2b_records.append(modified)

        elif mismatch_roll < 0.42:
            # DUPLICATE_INVOICE — same invoice twice in GSTR-1
            gstr1_records.append(base_record)
            gstr1_records.append(base_record)
            gstr2b_records.append(base_record)

        else:
            # Perfect match
            gstr1_records.append(base_record)
            gstr2b_records.append(base_record)

    return gstr1_records, gstr2b_records


def generate_gstr3b(taxpayers, gstr2b_records, return_period="012026"):
    """Generate GSTR-3B summary data with some excess ITC claims."""
    gstr3b_records = []

    # Sum up ITC available per buyer from GSTR-2B
    buyer_itc = {}
    for rec in gstr2b_records:
        buyer = rec["buyer_gstin"]
        itc = rec["cgst"] + rec["sgst"] + rec["igst"]
        buyer_itc[buyer] = buyer_itc.get(buyer, 0) + itc

    for taxpayer in taxpayers:
        gstin = taxpayer["gstin"]
        available_itc = buyer_itc.get(gstin, 0)

        # Some taxpayers claim excess ITC
        if random.random() < 0.15 and available_itc > 0:
            claimed_itc = round(available_itc * random.uniform(1.1, 1.5), 2)
        else:
            claimed_itc = round(available_itc, 2)

        gstr3b_records.append({
            "gstin": gstin,
            "return_period": return_period,
            "total_itc_claimed": claimed_itc,
            "itc_available_as_per_gstr2b": round(available_itc, 2),
            "output_tax_liability": round(random.uniform(10000, 200000), 2),
            "tax_paid": round(random.uniform(5000, 150000), 2),
        })

    return gstr3b_records


def generate_circular_trades(taxpayers, count=3):
    """Generate circular trading patterns (A -> B -> C -> A)."""
    circular_invoices_gstr1 = []
    circular_invoices_gstr2b = []
    gstins = [t["gstin"] for t in taxpayers]

    for _ in range(count):
        chain_length = random.randint(3, 5)
        chain = random.sample(gstins, min(chain_length, len(gstins)))

        for i in range(len(chain)):
            supplier = chain[i]
            buyer = chain[(i + 1) % len(chain)]

            record = {
                "supplier_gstin": supplier,
                "buyer_gstin": buyer,
                "invoice_number": generate_invoice_number("CIRC"),
                "invoice_date": "2026-01-15",
                "hsn_code": random.choice(HSN_CODES),
                "gst_rate": 18.0,
                "taxable_value": round(random.uniform(100000, 500000), 2),
                "cgst": 0.0,
                "sgst": 0.0,
                "igst": round(random.uniform(18000, 90000), 2),
                "total_value": round(random.uniform(118000, 590000), 2),
                "place_of_supply": buyer[:2],
                "reverse_charge": False,
                "invoice_type": "B2B",
            }

            circular_invoices_gstr1.append(record)
            circular_invoices_gstr2b.append(record)

    return circular_invoices_gstr1, circular_invoices_gstr2b


def main():
    output_dir = os.path.join(os.path.dirname(__file__), "..", "sample")
    os.makedirs(output_dir, exist_ok=True)

    print("Generating mock GST data...")

    # Generate taxpayers
    taxpayers = generate_taxpayers(30)

    # Generate invoices with mismatches
    gstr1, gstr2b = generate_invoices(taxpayers, 200)

    # Generate circular trades
    circ_gstr1, circ_gstr2b = generate_circular_trades(taxpayers, 3)
    gstr1.extend(circ_gstr1)
    gstr2b.extend(circ_gstr2b)

    # Generate GSTR-3B
    gstr3b = generate_gstr3b(taxpayers, gstr2b)

    # Write output files
    files = {
        "taxpayers.json": taxpayers,
        "gstr1_invoices.json": gstr1,
        "gstr2b_invoices.json": gstr2b,
        "gstr3b_returns.json": gstr3b,
    }

    for filename, data in files.items():
        filepath = os.path.join(output_dir, filename)
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  Written {filepath} ({len(data)} records)")

    print(f"\nDone! Generated:")
    print(f"  {len(taxpayers)} taxpayers")
    print(f"  {len(gstr1)} GSTR-1 invoices")
    print(f"  {len(gstr2b)} GSTR-2B invoices")
    print(f"  {len(gstr3b)} GSTR-3B returns")
    print(f"  {len(circ_gstr1)} circular trade invoices injected")


if __name__ == "__main__":
    main()
