# Intelligent GST Reconciliation Using Knowledge Graphs

## What This Application Does

Indian businesses file multiple GST returns every month — **GSTR-1** (what you sold), **GSTR-2B** (what the government auto-generates from your suppliers' filings), and **GSTR-3B** (your summary tax payment). The government cross-checks these. If your supplier didn't file properly, **you lose your Input Tax Credit (ITC)** — real money.

This application uses a **Neo4j Knowledge Graph** to model every taxpayer, invoice, and return as connected nodes. Instead of comparing flat spreadsheets row-by-row, it traverses graph relationships to find mismatches, detect fraud patterns like circular trading, and quantify exactly how much ITC is at risk.

An **LLM layer** (Ollama / OpenAI / Gemini) generates plain-English audit explanations for each mismatch, so even non-technical auditors can understand what happened and what to do about it.

---

## User Journey (What Each Page Does)

### 1. Upload Data (`/upload`)

**What the user does:** Drags and drops CSV/JSON files containing GST return data.

**What happens behind the scenes:**

```
User drops GSTR-1 JSON file
  → Frontend sends POST /api/data/upload?return_type=GSTR1&return_period=012026
    → Backend parses JSON/CSV into invoice records
      → For each invoice, runs Cypher queries on Neo4j:
          MERGE (inv:Invoice {invoice_id: ...})     — creates the invoice node
          MERGE (supplier:Taxpayer {gstin: ...})     — creates/finds the supplier
          MERGE (buyer:Taxpayer {gstin: ...})        — creates/finds the buyer
          MERGE (inv)-[:SUPPLIED_BY]->(supplier)     — links invoice to supplier
          MERGE (inv)-[:SUPPLIED_TO]->(buyer)        — links invoice to buyer
          MERGE (supplier)-[:TRADES_WITH]->(buyer)   — tracks trade relationships
          MERGE (r:GSTR1Return)-[:CONTAINS_OUTWARD]->(inv) — links return to invoice
```

**Supported uploads:**
| File Type | What It Contains | Graph Nodes Created |
|-----------|-----------------|-------------------|
| GSTR-1 | Outward supply invoices (what you sold) | Invoice, Taxpayer, GSTR1Return |
| GSTR-2B | Auto-drafted inward invoices (what suppliers reported) | Invoice, Taxpayer, GSTR2BReturn |
| GSTR-3B | Summary return (ITC claimed, tax paid) | GSTR3BReturn |
| Taxpayer Master | GSTIN, legal name, state, registration type | Taxpayer |

### 2. Reconciliation (`/reconcile`)

**What the user does:** Enters a return period (e.g., `012026` for January 2026) and clicks "Run Reconciliation."

**What happens behind the scenes:**

The reconciler runs **4 types of graph traversal queries:**

**a) Missing in GSTR-2B** — Invoices the supplier filed in GSTR-1 but that don't appear in the buyer's GSTR-2B:
```cypher
MATCH (g1:GSTR1Return {return_period: "012026"})-[:CONTAINS_OUTWARD]->(inv1:Invoice)
WHERE NOT EXISTS {
    MATCH (g2b:GSTR2BReturn {return_period: "012026"})-[:CONTAINS_INWARD]->(inv2:Invoice)
    WHERE inv2.invoice_number = inv1.invoice_number
      AND inv2.supplier_gstin = inv1.supplier_gstin
}
```
*Impact: Buyer cannot claim ITC on these invoices.*

**b) Missing in GSTR-1** — Invoices in GSTR-2B but the supplier never filed them. Potential fake ITC claims.

**c) Value/Rate Mismatches** — Same invoice exists in both returns but with different amounts or GST rates.

**d) Excess ITC** — Compares ITC claimed in GSTR-3B against what's actually available in GSTR-2B:
```cypher
MATCH (g3b:GSTR3BReturn {return_period: "012026"})
-- compute available ITC from GSTR-2B invoices
WHERE g3b.itc_claimed > available_itc
```

**e) Duplicate Invoices** — Same invoice number appearing more than twice for the same supplier.

**Severity is assigned by amount:** CRITICAL (≥5L), HIGH (≥1L), MEDIUM (≥10K), LOW (<10K).

**AI Audit button:** On any mismatch row, clicking "Generate AI Audit Explanation" sends the mismatch details to the LLM, which returns a structured explanation with Summary, Impact, Root Cause, and Recommended Action.

### 3. Dashboard (`/`)

**What the user sees:** 6 stat cards + 2 charts + top risky vendors.

**Data sources:**
- **Taxpayers, Invoices, Txn Value** — direct Neo4j `COUNT` / `SUM` queries
- **Mismatches, ITC at Risk** — aggregated from in-memory reconciliation results
- **High Risk Vendors** — computed by the risk model (see below)
- **Bar chart** — mismatch count by type (Missing 2B, Value, Rate, etc.)
- **Pie chart** — ITC amount at risk by mismatch type

### 4. Knowledge Graph Explorer (`/graph`)

**What the user does:** Visualizes the taxpayer-invoice network. Can search by GSTIN or trade name. Can detect circular trading.

**What happens behind the scenes:**
- Loads up to 300 nodes from Neo4j with all their relationships
- Frontend renders using `react-force-graph-2d` (D3 force simulation)
- Node colors: Taxpayer (terracotta), Invoice (green), GSTR1Return (yellow), GSTR2BReturn (purple), GSTR3BReturn (red)
- **Circular trade detection** runs:
```cypher
MATCH path = (a:Taxpayer)-[:TRADES_WITH*2..5]->(a)
RETURN [n IN nodes(path) | n.gstin] AS cycle
```
This finds taxpayers who form closed trading loops — a classic GST fraud pattern where companies generate fake invoices in a circle to inflate ITC claims.

### 5. Vendor Risk Assessment (`/risk`)

**What the user sees:** Cards for each vendor with risk score (0–100), risk level badge, stats, and risk factors.

**How risk score is computed** (composite weighted score):

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| Filing compliance | 25% | How many GSTR-1/3B returns filed vs expected |
| Mismatch rate | 30% | Mismatches as % of total invoices |
| Circular trading | 25% | Whether this GSTIN appears in any trade cycle |
| Mismatch volume | 20% | Raw count of mismatches (capped) |

**Risk levels:** CRITICAL (≥75), HIGH (≥50), MEDIUM (≥25), LOW (<25)

**AI Risk Summary button:** Sends the vendor's data to the LLM and gets a plain-English risk assessment with Key Concerns and Compliance Recommendations.

### 6. Audit Trails (`/audit`)

**What the user sees:** Previously generated AI audit explanations, each with an invoice chain visualization showing how the mismatch flows through the GST system (Seller files → System generates 2B → Buyer claims ITC).

**Also available:** PDF and HTML report generation via `/api/audit/report/pdf` and `/api/audit/report/html`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                 │
│                                                         │
│  /              → Dashboard (stats + charts)            │
│  /upload        → File upload (drag & drop)             │
│  /reconcile     → Run reconciliation + results table    │
│  /graph         → Force-directed graph visualization    │
│  /audit         → AI audit trail viewer                 │
│  /risk          → Vendor risk cards + AI summaries      │
│                                                         │
│  src/lib/api.ts → All API calls to backend              │
│  src/hooks/useTheme.ts → Light/dark mode toggle         │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP (localhost:8000)
                  │
┌─────────────────▼───────────────────────────────────────┐
│                   BACKEND (FastAPI)                      │
│                                                         │
│  API Routers:                                           │
│    /api/data/*        → ingest.py (file upload/parse)   │
│    /api/reconcile/*   → reconcile.py (run + results)    │
│    /api/audit/*       → audit.py (AI explanations)      │
│    /api/risk/*        → risk.py (vendor scoring)        │
│    /api/stats/*       → stats.py (dashboard aggregates) │
│                                                         │
│  Core:                                                  │
│    graph_db.py     → Neo4j driver, Cypher queries,      │
│                      node ingestion, graph search        │
│    reconciler.py   → 5 reconciliation algorithms        │
│    risk_model.py   → Composite risk scoring engine      │
│    llm_chain.py    → LLM fallback: OpenAI→Gemini→Ollama│
│    report_generator.py → PDF/HTML report via Jinja2     │
│                                                         │
│  Models:                                                │
│    gst.py → Pydantic models (Taxpayer, Invoice,         │
│             MismatchResult, VendorRisk, AuditTrail)     │
└─────────────────┬───────────────────────────────────────┘
                  │ Bolt protocol (localhost:7687)
                  │
┌─────────────────▼───────────────────────────────────────┐
│                     NEO4J DATABASE                       │
│                                                         │
│  Nodes:                                                 │
│    (:Taxpayer)     — gstin, legal_name, state_code      │
│    (:Invoice)      — invoice_number, amounts, GST rate  │
│    (:GSTR1Return)  — supplier's filed return            │
│    (:GSTR2BReturn) — auto-drafted buyer's return        │
│    (:GSTR3BReturn) — summary with ITC claimed/available │
│                                                         │
│  Relationships:                                         │
│    (Invoice)-[:SUPPLIED_BY]->(Taxpayer)                  │
│    (Invoice)-[:SUPPLIED_TO]->(Taxpayer)                  │
│    (Taxpayer)-[:TRADES_WITH]->(Taxpayer)                 │
│    (Taxpayer)-[:FILED]->(GSTR1Return|GSTR3BReturn)      │
│    (Taxpayer)-[:RECEIVED]->(GSTR2BReturn)                │
│    (GSTR1Return)-[:CONTAINS_OUTWARD]->(Invoice)          │
│    (GSTR2BReturn)-[:CONTAINS_INWARD]->(Invoice)          │
│                                                         │
│  Why a graph?                                           │
│    - Traversal-based reconciliation (follow edges, not  │
│      join tables)                                       │
│    - Circular trade detection via path queries           │
│    - Natural modeling of supplier-buyer-invoice network  │
└─────────────────────────────────────────────────────────┘
                  │
                  │ HTTP (configurable URL)
                  │
┌─────────────────▼───────────────────────────────────────┐
│                      LLM LAYER                          │
│                                                         │
│  Fallback chain (tries in order):                       │
│    1. OpenAI  (gpt-4o-mini)     — if API key set        │
│    2. Gemini  (gemini-2.0-flash) — if API key set       │
│    3. Ollama  (qwen2.5-coder:32b) — self-hosted         │
│                                                         │
│  Used for:                                              │
│    - Audit trail explanations (why this mismatch        │
│      happened, what's the impact, what to do)           │
│    - Vendor risk summaries (assess compliance risk      │
│      in plain English)                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow: Complete Example

Here's what happens end-to-end when a user uploads data and runs reconciliation:

```
1. User uploads GSTR-1 file (30 invoices from 10 suppliers)
   → 30 Invoice nodes + 10 Taxpayer nodes created in Neo4j
   → GSTR1Return nodes linked via CONTAINS_OUTWARD
   → TRADES_WITH edges created between supplier-buyer pairs

2. User uploads GSTR-2B file (25 invoices auto-drafted for buyers)
   → 25 Invoice nodes + GSTR2BReturn nodes
   → CONTAINS_INWARD edges

3. User uploads GSTR-3B (summary returns with ITC claimed)
   → GSTR3BReturn nodes with itc_claimed, itc_available

4. User clicks "Run Reconciliation" for period 012026
   → Backend traverses graph:
     - 5 invoices in GSTR-1 but not in GSTR-2B → MISSING_IN_GSTR2B
     - 2 invoices in GSTR-2B but not in GSTR-1 → MISSING_IN_GSTR1
     - 3 invoices with different amounts → VALUE_MISMATCH
     - 1 taxpayer claimed more ITC than available → EXCESS_ITC
   → 11 mismatches returned with severity levels

5. Dashboard updates:
   → Shows 11 mismatches, calculates total ITC at risk
   → Bar chart shows breakdown by type
   → Risk model recalculates all vendor scores

6. User clicks "AI Audit Explanation" on a mismatch
   → Backend sends mismatch details to LLM (Ollama qwen2.5-coder:32b)
   → LLM returns structured explanation
   → Stored in audit trail for future reference

7. User checks Graph Explorer
   → Sees all taxpayers connected by trade relationships
   → Runs circular trade detection
   → Finds A→B→C→A trading cycle — potential fraud

8. User downloads PDF report
   → Jinja2 template rendered with all mismatches + audit trails
   → WeasyPrint converts HTML to PDF
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14, React, TypeScript | UI with 6 pages |
| Styling | Tailwind CSS + CSS variables | Claude.ai-inspired light/dark theme |
| Charts | Recharts | Bar + Pie charts on dashboard |
| Graph Viz | react-force-graph-2d | Interactive knowledge graph |
| Backend | FastAPI (Python) | REST API, async request handling |
| Database | Neo4j | Knowledge graph for taxpayer-invoice network |
| LLM | Ollama (qwen2.5-coder:32b) | AI-powered audit explanations and risk summaries |
| Reports | Jinja2 + WeasyPrint | PDF/HTML audit report generation |
| Package Mgmt | uv (Python), npm (JS) | Dependency management |

---

## API Endpoints Summary

| Method | Endpoint | What It Does |
|--------|---------|-------------|
| POST | `/api/data/upload` | Upload GSTR-1/2B/3B files (JSON/CSV) |
| POST | `/api/data/upload-taxpayers` | Upload taxpayer master data |
| POST | `/api/reconcile` | Run reconciliation for a period |
| GET | `/api/reconcile/results` | Get mismatch results (paginated, filterable) |
| GET | `/api/reconcile/graph/nodes` | Get graph nodes for visualization |
| GET | `/api/reconcile/graph/search` | Search graph by GSTIN/name/invoice |
| GET | `/api/reconcile/graph/circular-trades` | Detect circular trading patterns |
| POST | `/api/audit/generate` | Generate AI audit explanation for a mismatch |
| GET | `/api/audit/trails` | List all generated audit trails |
| GET | `/api/audit/report/pdf` | Download PDF audit report |
| GET | `/api/audit/report/html` | View HTML audit report |
| GET | `/api/risk/vendors` | Get all vendors with risk scores |
| GET | `/api/risk/vendors/{gstin}/summary` | Get AI-powered risk summary |
| GET | `/api/stats/dashboard` | Dashboard statistics |
| GET | `/api/stats/mismatch-summary` | Mismatch breakdown by type |
| GET | `/api/stats/top-risky-vendors` | Top 10 riskiest vendors |
