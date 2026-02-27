# SPEC: Mahesh — Backend + Neo4j + Reconciliation Engine + AI/ML

## Role
You own the **backend/** directory entirely.
DO NOT touch `frontend/` or `data/` — those belong to Nihesh and Person 3.

## Tech Stack
- Python 3.11+
- FastAPI + Uvicorn
- neo4j (Python driver)
- openai + google-generativeai + ollama (LLM fallback chain)
- scikit-learn + networkx (ML + graph analytics)
- pandas (data processing)
- python-multipart (file uploads)
- jinja2 + weasyprint (PDF reports)
- pydantic (data validation)

## Architecture Overview
```
FastAPI (main.py)
├── api/           ← Route handlers (thin, call core logic)
│   ├── ingest.py
│   ├── reconcile.py
│   ├── audit.py
│   ├── risk.py
│   └── stats.py
├── core/          ← Business logic (heavy lifting)
│   ├── graph_db.py        # Neo4j connection + Cypher queries
│   ├── reconciler.py      # Graph traversal reconciliation
│   ├── risk_model.py      # Vendor risk scoring + prediction
│   └── llm_chain.py       # LLM with fallback chain
├── models/        ← Pydantic schemas
│   ├── gst.py             # Invoice, Taxpayer, Return schemas
│   └── responses.py       # API response schemas
└── config.py      ← Settings from environment
```

## Step-by-Step Build Order

### Phase 1: Foundation (Hours 0-4)
1. **config.py** — Load from env: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, OPENAI_API_KEY, GEMINI_API_KEY, OLLAMA_URL
2. **models/gst.py** — Pydantic models:
   - `Taxpayer(gstin, legal_name, trade_name, state_code, registration_type, status)`
   - `Invoice(invoice_number, invoice_date, invoice_type, supplier_gstin, buyer_gstin, taxable_value, cgst, sgst, igst, total_value, gst_rate, hsn_code, place_of_supply, reverse_charge)`
   - `GSTR1Return(gstin, return_period, filing_date, status, invoices: list[Invoice])`
   - `GSTR2BReturn(gstin, return_period, generation_date, invoices: list[Invoice])`
   - `GSTR3BReturn(gstin, return_period, filing_date, itc_claimed, output_tax, net_tax)`
   - `MismatchResult(id, mismatch_type, severity, invoice_seller, invoice_buyer, field_diff, amount_difference, description)`
   - `VendorRisk(gstin, name, risk_score, filing_rate, mismatch_count, circular_trade_flag, risk_factors)`
   - `AuditTrail(id, mismatch_id, explanation, invoice_chain, generated_at)`
3. **core/graph_db.py** — Neo4j driver wrapper:
   - `get_driver()` — singleton connection
   - `create_constraints()` — unique constraints on GSTIN, invoice_number
   - `ingest_taxpayer(data)` → CREATE/MERGE Taxpayer node
   - `ingest_invoice(data)` → CREATE Invoice + relationships
   - `ingest_gstr1(data)` → CREATE GSTR1Return + CONTAINS_OUTWARD edges
   - `ingest_gstr2b(data)` → CREATE GSTR2BReturn + CONTAINS_INWARD edges
   - `ingest_gstr3b(data)` → CREATE GSTR3BReturn + CLAIMS_ITC_FOR edges
   - `get_graph_nodes(limit)` → Return nodes + edges for frontend viz
   - `search_graph(query)` → Full-text search on GSTIN/invoice
   - `find_circular_trades()` → Cypher cycle detection
4. **main.py** — FastAPI app with CORS, lifespan (Neo4j init), router includes

### Phase 2: Reconciliation Engine (Hours 4-10)
5. **core/reconciler.py** — The heart of the system:
   ```python
   def reconcile_gstr1_vs_gstr2b(return_period: str) -> list[MismatchResult]:
       """
       For each invoice in GSTR-1 (seller filed):
       - Check if matching invoice exists in buyer's GSTR-2B
       - Match on: invoice_number + supplier_gstin + buyer_gstin
       - Compare: taxable_value, cgst, sgst, igst, gst_rate
       - Classify mismatch type
       """

   def reconcile_gstr2b_vs_gstr3b(gstin: str, return_period: str) -> list[MismatchResult]:
       """
       Compare ITC available in GSTR-2B vs ITC claimed in GSTR-3B
       - EXCESS_ITC if claimed > available
       - UNDER_CLAIMED if claimed < available (not a risk, but noted)
       """

   def reconcile_purchase_register(gstin: str, data) -> list[MismatchResult]:
       """
       Match purchase register entries against GSTR-2B
       - Find invoices in books but not in GSTR-2B (can't claim ITC)
       - Find invoices in GSTR-2B but not in books (missing from accounting)
       """

   def classify_mismatch(invoice_a, invoice_b) -> MismatchResult:
       """Compare two invoice records field by field, return mismatch type + severity"""

   def calculate_severity(mismatch_type, amount_diff) -> str:
       """LOW / MEDIUM / HIGH / CRITICAL based on type and amount"""
   ```

6. **api/reconcile.py** — Endpoints:
   - `POST /api/reconcile` — Trigger full reconciliation for a period
   - `GET /api/reconcile/results` — List all mismatches (paginated, filterable)
   - `GET /api/reconcile/results/{id}` — Single mismatch with full context

7. **api/ingest.py** — Data upload:
   - `POST /api/data/upload` — Accept CSV/JSON files, parse, ingest into Neo4j
   - Support GSTR-1, GSTR-2B, GSTR-3B, Purchase Register formats
   - Validate data before ingestion

### Phase 3: AI + ML (Hours 10-18)
8. **core/llm_chain.py** — LLM with fallback:
   ```python
   PROVIDERS = [
       ("openai", "gpt-4o-mini"),      # Primary — fast + cheap
       ("gemini", "gemini-2.0-flash"),  # Fallback 1
       ("ollama", "llama3.1"),          # Fallback 2 — local
   ]

   async def generate_audit_explanation(mismatch: MismatchResult, invoice_chain: list) -> str:
       """Generate natural language explanation of a mismatch"""
       prompt = f"""You are a GST audit assistant. Explain this mismatch:
       Type: {mismatch.mismatch_type}
       Severity: {mismatch.severity}
       Supplier: {mismatch.invoice_seller}
       Buyer: {mismatch.invoice_buyer}
       Amount Difference: ₹{mismatch.amount_difference}
       Invoice Chain: {invoice_chain}

       Explain in simple business language what went wrong,
       why it matters for ITC claims, and what action to take."""

   async def generate_risk_summary(vendor: VendorRisk) -> str:
       """Generate natural language risk assessment for a vendor"""
   ```

9. **core/risk_model.py** — Vendor risk scoring:
   ```python
   def calculate_vendor_risk(gstin: str) -> VendorRisk:
       """
       Composite risk score from:
       1. Filing compliance (% of periods filed on time) — weight 0.25
       2. Mismatch frequency (mismatches / total invoices) — weight 0.30
       3. Circular trading indicator (is in any cycle?) — weight 0.25
       4. Invoice volume anomaly (z-score of monthly volume) — weight 0.20
       """

   def detect_circular_trades() -> list[list[str]]:
       """Use Cypher to find cycles: MATCH path = (a)-[:TRADES_WITH*2..5]->(a) RETURN path"""

   def train_risk_predictor(historical_data):
       """Simple RandomForest on features: filing_rate, mismatch_rate, avg_invoice_value, trade_partner_count"""
   ```

10. **api/audit.py** — Audit trail endpoints:
    - `POST /api/audit/generate` — Generate audit trail for a mismatch
    - `GET /api/audit/trails` — List all generated trails
    - `GET /api/audit/trails/{id}` — Single trail with explanation

11. **api/risk.py** — Risk endpoints:
    - `GET /api/risk/vendors` — All vendors with risk scores
    - `GET /api/risk/vendors/{gstin}` — Detailed risk breakdown

12. **api/stats.py** — Dashboard stats:
    - `GET /api/stats/dashboard` — Summary counts and breakdowns

### Phase 4: Polish (Hours 18-24)
- Error handling on all endpoints
- Pagination on list endpoints
- Input validation
- API documentation (FastAPI auto-generates Swagger)
- PDF report generation for audit trails
- Performance optimization on Cypher queries

## Neo4j Cypher Queries You'll Need

### Create Constraints
```cypher
CREATE CONSTRAINT taxpayer_gstin IF NOT EXISTS FOR (t:Taxpayer) REQUIRE t.gstin IS UNIQUE;
CREATE CONSTRAINT invoice_id IF NOT EXISTS FOR (i:Invoice) REQUIRE i.invoice_id IS UNIQUE;
```

### Reconciliation Query (GSTR-1 vs GSTR-2B)
```cypher
MATCH (seller:Taxpayer)-[:FILED]->(g1:GSTR1Return {return_period: $period})-[:CONTAINS_OUTWARD]->(inv1:Invoice)
OPTIONAL MATCH (buyer:Taxpayer)-[:RECEIVED]->(g2b:GSTR2BReturn {return_period: $period})-[:CONTAINS_INWARD]->(inv2:Invoice)
WHERE inv1.invoice_number = inv2.invoice_number AND inv1.supplier_gstin = inv2.supplier_gstin
RETURN inv1, inv2, seller, buyer,
  CASE
    WHEN inv2 IS NULL THEN 'MISSING_IN_GSTR2B'
    WHEN inv1.taxable_value <> inv2.taxable_value THEN 'VALUE_MISMATCH'
    WHEN inv1.gst_rate <> inv2.gst_rate THEN 'RATE_MISMATCH'
    ELSE 'MATCHED'
  END AS status
```

### Circular Trade Detection
```cypher
MATCH path = (a:Taxpayer)-[:TRADES_WITH*2..5]->(a)
WHERE ALL(r IN relationships(path) WHERE r.volume > 100000)
RETURN path, length(path) as cycle_length
ORDER BY cycle_length
```

### Vendor Risk Data
```cypher
MATCH (t:Taxpayer)
OPTIONAL MATCH (t)-[:FILED]->(g1:GSTR1Return)
OPTIONAL MATCH (t)-[:FILED]->(g3:GSTR3BReturn)
OPTIONAL MATCH (t)-[tw:TRADES_WITH]-()
RETURN t.gstin, t.legal_name,
  count(DISTINCT g1) as gstr1_filed,
  count(DISTINCT g3) as gstr3b_filed,
  sum(tw.volume) as trade_volume
```

## Environment Variables Needed
```
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=gstrecon2026
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
OLLAMA_URL=http://localhost:11434
LLM_PRIORITY=openai,gemini,ollama
```

## Dependencies (requirements.txt)
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
neo4j==5.26.0
openai==1.58.0
google-generativeai==0.8.0
ollama==0.4.0
scikit-learn==1.6.0
networkx==3.4.0
pandas==2.2.0
python-multipart==0.0.18
pydantic==2.10.0
pydantic-settings==2.7.0
python-dotenv==1.0.1
httpx==0.28.0
jinja2==3.1.5
```

## Key Principles
- Every endpoint returns proper error responses with status codes
- Use async/await for LLM calls
- Use Neo4j transactions properly (read vs write)
- Pydantic models for ALL request/response validation
- Keep API routes thin — business logic goes in core/
