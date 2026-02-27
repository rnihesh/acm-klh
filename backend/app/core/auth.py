from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings
from app.core.graph_db import get_driver

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def create_user_constraint():
    driver = get_driver()
    with driver.session() as session:
        session.run(
            "CREATE CONSTRAINT user_username IF NOT EXISTS "
            "FOR (u:User) REQUIRE u.username IS UNIQUE"
        )


def create_user(username: str, password: str, gstin: str, company_name: str) -> dict:
    driver = get_driver()
    hashed = pwd_context.hash(password)
    with driver.session() as session:
        existing = session.run(
            "MATCH (u:User {username: $username}) RETURN u",
            username=username,
        ).single()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists",
            )
        result = session.run(
            """
            CREATE (u:User {
                username: $username,
                hashed_password: $hashed_password,
                gstin: $gstin,
                company_name: $company_name,
                created_at: $created_at
            })
            RETURN u.username AS username, u.gstin AS gstin, u.company_name AS company_name
            """,
            username=username,
            hashed_password=hashed,
            gstin=gstin,
            company_name=company_name,
            created_at=datetime.now(timezone.utc).isoformat(),
        ).single()
        return dict(result)


def authenticate_user(username: str, password: str) -> dict | None:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            "MATCH (u:User {username: $username}) "
            "RETURN u.username AS username, u.hashed_password AS hashed_password, "
            "u.gstin AS gstin, u.company_name AS company_name",
            username=username,
        ).single()
        if not result:
            return None
        if not pwd_context.verify(password, result["hashed_password"]):
            return None
        return {
            "username": result["username"],
            "gstin": result["gstin"],
            "company_name": result["company_name"],
        }


def seed_default_users():
    """Create default users and demo graph data if no users exist."""
    driver = get_driver()
    with driver.session() as session:
        count = session.run("MATCH (u:User) RETURN count(u) AS c").single()["c"]
        if count > 0:
            return

        now = datetime.now(timezone.utc).isoformat()

        # --- User: admin (full data via seed_neo4j.py) ---
        session.run(
            """
            CREATE (u:User {
                username: 'admin',
                hashed_password: $hp,
                gstin: '29ABCDE1234F1Z5',
                company_name: 'GST Recon Admin',
                created_at: $ts
            })
            """,
            hp=pwd_context.hash("admin123"),
            ts=now,
        )
        print("Default user seeded: admin / admin123")

        # --- User: admin2 (demo user with curated graph) ---
        session.run(
            """
            CREATE (u:User {
                username: 'admin2',
                hashed_password: $hp,
                gstin: '27AADCS0472N1Z1',
                company_name: 'SteelCraft Industries',
                created_at: $ts
            })
            """,
            hp=pwd_context.hash("admin123"),
            ts=now,
        )
        print("Demo user seeded: admin2 / admin123")

        # --- Seed small demo graph data ---
        _seed_demo_graph(session)


def _seed_demo_graph(session):
    """Seed a small, visually appealing graph for demo purposes."""

    # 8 taxpayers with recognisable names
    taxpayers = [
        ("27AADCS0472N1Z1", "SteelCraft Industries",   "SteelCraft",   "27", "Regular", "Active"),
        ("29BBFPL8734K2Z9", "BrightPharma Ltd",        "BrightPharma", "29", "Regular", "Active"),
        ("07CCHFT5621M1ZQ", "Capital Hardware & Tools", "Capital H&T",  "07", "Regular", "Active"),
        ("33DDGRS9182J1Z3", "DuraTex Fabrics",          "DuraTex",      "33", "Regular", "Active"),
        ("24EEKPM4571A1Z7", "ElectroParts Mfg",         "ElectroParts", "24", "Regular", "Active"),
        ("06FFHNQ3265B2ZX", "FreshField Agro",          "FreshField",   "06", "Regular", "Active"),
        ("36GGLRD7894C1Z2", "GlobalTech Services",      "GlobalTech",   "36", "Regular", "Active"),
        ("19HHMSW1438D1Z6", "HeavyLift Logistics",      "HeavyLift",    "19", "Regular", "Active"),
    ]

    for gstin, legal, trade, state, reg, status in taxpayers:
        session.run(
            """
            MERGE (t:Taxpayer {gstin: $gstin})
            SET t.legal_name = $legal, t.trade_name = $trade,
                t.state_code = $state, t.registration_type = $reg, t.status = $status
            """,
            gstin=gstin, legal=legal, trade=trade, state=state, reg=reg, status=status,
        )

    # Invoices — a mix of matching, mismatched, and a circular chain
    period = "012026"
    invoices = [
        # supplier, buyer, inv_no, date, taxable, gst_rate, hsn — normal matches
        ("27AADCS0472N1Z1", "29BBFPL8734K2Z9", "INV/2026/1001", "2026-01-05", 125000, 18.0, "7210"),
        ("27AADCS0472N1Z1", "07CCHFT5621M1ZQ", "INV/2026/1002", "2026-01-08", 85000,  18.0, "7308"),
        ("29BBFPL8734K2Z9", "33DDGRS9182J1Z3", "INV/2026/1003", "2026-01-10", 62000,  12.0, "3004"),
        ("07CCHFT5621M1ZQ", "24EEKPM4571A1Z7", "INV/2026/1004", "2026-01-12", 47500,  18.0, "8471"),
        ("33DDGRS9182J1Z3", "06FFHNQ3265B2ZX", "INV/2026/1005", "2026-01-14", 93000,  5.0,  "5208"),
        ("06FFHNQ3265B2ZX", "19HHMSW1438D1Z6", "INV/2026/1006", "2026-01-16", 38000,  12.0, "1006"),
        ("36GGLRD7894C1Z2", "27AADCS0472N1Z1", "INV/2026/1007", "2026-01-18", 210000, 18.0, "8523"),
        ("24EEKPM4571A1Z7", "36GGLRD7894C1Z2", "INV/2026/1008", "2026-01-20", 76000,  28.0, "8708"),
        ("19HHMSW1438D1Z6", "29BBFPL8734K2Z9", "INV/2026/1009", "2026-01-22", 54000,  18.0, "8544"),
        # Extra connections for density
        ("27AADCS0472N1Z1", "36GGLRD7894C1Z2", "INV/2026/1010", "2026-01-24", 165000, 18.0, "7210"),
        ("29BBFPL8734K2Z9", "24EEKPM4571A1Z7", "INV/2026/1011", "2026-01-25", 41000,  12.0, "3004"),
        ("06FFHNQ3265B2ZX", "07CCHFT5621M1ZQ", "INV/2026/1012", "2026-01-26", 29500,  5.0,  "1006"),
    ]

    for sup, buy, inv_no, inv_date, taxable, rate, hsn in invoices:
        is_inter = sup[:2] != buy[:2]
        igst = round(taxable * rate / 100, 2) if is_inter else 0.0
        cgst = 0.0 if is_inter else round(taxable * rate / 200, 2)
        sgst = cgst
        total = round(taxable + cgst + sgst + igst, 2)
        inv_id = f"{sup}_{inv_no}_{period}"

        # Create invoice + relationships (both GSTR1 and GSTR2B — perfect match)
        for source in ("GSTR1", "GSTR2B"):
            session.run(
                """
                MERGE (inv:Invoice {invoice_id: $inv_id})
                SET inv.invoice_number = $inv_no, inv.invoice_date = $inv_date,
                    inv.invoice_type = 'B2B', inv.supplier_gstin = $sup,
                    inv.buyer_gstin = $buy, inv.taxable_value = $taxable,
                    inv.cgst = $cgst, inv.sgst = $sgst, inv.igst = $igst,
                    inv.total_value = $total, inv.gst_rate = $rate,
                    inv.hsn_code = $hsn, inv.place_of_supply = $pos,
                    inv.reverse_charge = false, inv.return_period = $period,
                    inv.source = $source
                MERGE (supplier:Taxpayer {gstin: $sup})
                MERGE (buyer:Taxpayer {gstin: $buy})
                MERGE (inv)-[:SUPPLIED_BY]->(supplier)
                MERGE (inv)-[:SUPPLIED_TO]->(buyer)
                MERGE (supplier)-[tw:TRADES_WITH]->(buyer)
                  ON CREATE SET tw.volume = $total, tw.frequency = 1
                  ON MATCH SET tw.volume = tw.volume + $total, tw.frequency = tw.frequency + 1
                """,
                inv_id=inv_id, inv_no=inv_no, inv_date=inv_date,
                sup=sup, buy=buy, taxable=taxable,
                cgst=cgst, sgst=sgst, igst=igst, total=total,
                rate=rate, hsn=hsn, pos=buy[:2], period=period, source=source,
            )

        # GSTR1Return + GSTR2BReturn nodes
        session.run(
            """
            MERGE (r1:GSTR1Return {gstin: $sup, return_period: $period})
            MERGE (r2:GSTR2BReturn {gstin: $buy, return_period: $period})
            WITH r1, r2
            MATCH (inv:Invoice {invoice_id: $inv_id})
            MERGE (r1)-[:CONTAINS_OUTWARD]->(inv)
            MERGE (r2)-[:CONTAINS_INWARD]->(inv)
            """,
            sup=sup, buy=buy, period=period, inv_id=inv_id,
        )

    # --- Circular trade: SteelCraft -> BrightPharma -> ElectroParts -> SteelCraft ---
    circ_chain = [
        ("27AADCS0472N1Z1", "29BBFPL8734K2Z9", "CIRC/2026/5001", 180000),
        ("29BBFPL8734K2Z9", "24EEKPM4571A1Z7", "CIRC/2026/5002", 175000),
        ("24EEKPM4571A1Z7", "27AADCS0472N1Z1", "CIRC/2026/5003", 172000),
    ]
    for sup, buy, inv_no, taxable in circ_chain:
        igst = round(taxable * 0.18, 2)
        total = round(taxable + igst, 2)
        inv_id = f"{sup}_{inv_no}_{period}"
        for source in ("GSTR1", "GSTR2B"):
            session.run(
                """
                MERGE (inv:Invoice {invoice_id: $inv_id})
                SET inv.invoice_number = $inv_no, inv.invoice_date = '2026-01-15',
                    inv.invoice_type = 'B2B', inv.supplier_gstin = $sup,
                    inv.buyer_gstin = $buy, inv.taxable_value = $taxable,
                    inv.cgst = 0.0, inv.sgst = 0.0, inv.igst = $igst,
                    inv.total_value = $total, inv.gst_rate = 18.0,
                    inv.hsn_code = '7210', inv.place_of_supply = $pos,
                    inv.reverse_charge = false, inv.return_period = $period,
                    inv.source = $source
                MERGE (supplier:Taxpayer {gstin: $sup})
                MERGE (buyer:Taxpayer {gstin: $buy})
                MERGE (inv)-[:SUPPLIED_BY]->(supplier)
                MERGE (inv)-[:SUPPLIED_TO]->(buyer)
                MERGE (supplier)-[tw:TRADES_WITH]->(buyer)
                  ON CREATE SET tw.volume = $total, tw.frequency = 1
                  ON MATCH SET tw.volume = tw.volume + $total, tw.frequency = tw.frequency + 1
                """,
                inv_id=inv_id, inv_no=inv_no, sup=sup, buy=buy,
                taxable=taxable, igst=igst, total=total, pos=buy[:2], period=period, source=source,
            )
        session.run(
            """
            MERGE (r1:GSTR1Return {gstin: $sup, return_period: $period})
            MERGE (r2:GSTR2BReturn {gstin: $buy, return_period: $period})
            WITH r1, r2
            MATCH (inv:Invoice {invoice_id: $inv_id})
            MERGE (r1)-[:CONTAINS_OUTWARD]->(inv)
            MERGE (r2)-[:CONTAINS_INWARD]->(inv)
            """,
            sup=sup, buy=buy, period=period, inv_id=inv_id,
        )

    # GSTR-3B summaries (one per taxpayer)
    for gstin, legal, *_ in taxpayers:
        session.run(
            """
            MERGE (r:GSTR3BReturn {gstin: $gstin, return_period: $period})
            SET r.itc_claimed = $claimed, r.itc_available = $avail,
                r.output_tax = $output, r.tax_paid = $paid
            MERGE (t:Taxpayer {gstin: $gstin})
            MERGE (t)-[:FILED]->(r)
            """,
            gstin=gstin, period=period,
            claimed=round(42000 + hash(gstin) % 20000, 2),
            avail=round(40000 + hash(gstin) % 18000, 2),
            output=round(60000 + hash(gstin) % 30000, 2),
            paid=round(50000 + hash(gstin) % 25000, 2),
        )

    print("Demo graph seeded: 8 taxpayers, 15 invoices, 1 circular trade chain")


def create_access_token(data: dict) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    settings = get_settings()
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            "MATCH (u:User {username: $username}) "
            "RETURN u.username AS username, u.gstin AS gstin, u.company_name AS company_name",
            username=username,
        ).single()
        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        return dict(result)
