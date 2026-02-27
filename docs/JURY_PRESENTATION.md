# Intelligent GST Reconciliation Using Knowledge Graphs

**Problem Statement #76** | Team: Nihesh, Mahesh

---

## 1. Problem Understanding (15 marks)

### The Problem

Every month, 14 million+ GST-registered businesses in India file returns. The government cross-matches these returns to verify tax credits. When mismatches occur, businesses lose their **Input Tax Credit (ITC)** — real money they've already paid.

**Three critical pain points:**

1. **Manual reconciliation is broken** — Businesses compare GSTR-1 (sales) against GSTR-2B (auto-drafted purchases) using Excel VLOOKUP on thousands of invoices. This misses structural patterns — a supplier who *consistently* under-reports won't be caught by line-by-line matching.

2. **Circular trading fraud is invisible** — Company A sells to B, B sells to C, C sells back to A — each claiming ITC on fake invoices. In flat spreadsheets, each transaction looks legitimate. You need to see the *network* to detect the cycle.

3. **No actionable intelligence** — When mismatches are found, accountants must manually figure out *why* it happened, *what's the impact*, and *what to do*. This is repetitive expert work that delays compliance.

### Why It Matters

- **INR 1.01 lakh crore** — ITC fraud detected by GST authorities (2017-2023)
- **40%** of small businesses report ITC claim rejections due to supplier non-compliance
- Circular trading accounts for a significant portion of GST fraud in India

---

## 2. Solution Clarity (20 marks)

### Our Approach: Knowledge Graph + LLM

Instead of flat table comparisons, we model the GST ecosystem as a **Neo4j Knowledge Graph** where every taxpayer, invoice, and return is a connected node.

**Why a graph database instead of SQL?**

| Approach | SQL (Traditional) | Knowledge Graph (Ours) |
|----------|-------------------|----------------------|
| Reconciliation | JOIN two tables on invoice_number | Traverse CONTAINS_OUTWARD → Invoice ← CONTAINS_INWARD edges |
| Circular trade detection | Requires recursive CTEs, impractical beyond 3 hops | Native path query: `(a)-[:TRADES_WITH*2..5]->(a)` — one line |
| Adding new return types | New tables, new JOIN logic | New node label + edge type, existing queries still work |
| Relationship discovery | Multiple JOINs across normalized tables | Single traversal across naturally connected data |

### Architecture Flow

```
Upload CSV/JSON → Parse & Ingest → Neo4j Knowledge Graph
                                          │
                                          ▼
                                   Graph Traversal
                                   (5 reconciliation algorithms)
                                          │
                                          ▼
                               Mismatches + Risk Scores
                                          │
                                          ▼
                                 LLM Audit Explanations
                                 (Ollama / OpenAI / Gemini)
                                          │
                                          ▼
                               Dashboard + Reports + PDF
```

### Graph Schema

```
(:Taxpayer)-[:FILED]->(:GSTR1Return)-[:CONTAINS_OUTWARD]->(:Invoice)
(:Taxpayer)-[:RECEIVED]->(:GSTR2BReturn)-[:CONTAINS_INWARD]->(:Invoice)
(:Taxpayer)-[:FILED]->(:GSTR3BReturn)
(:Invoice)-[:SUPPLIED_BY]->(:Taxpayer)
(:Invoice)-[:SUPPLIED_TO]->(:Taxpayer)
(:Taxpayer)-[:TRADES_WITH]->(:Taxpayer)
```

---

## 3. Working Demo (25 marks)

### Live Features (all functional)

**a) Data Ingestion**
- Drag-and-drop upload for GSTR-1, GSTR-2B, GSTR-3B, Purchase Register (CSV/JSON)
- Taxpayer master data upload
- Auto-creates graph nodes and relationships on upload

**b) Graph-Based Reconciliation**
- Runs 5 types of mismatch detection via Cypher graph queries:
  - Missing in GSTR-2B (supplier filed, buyer can't claim ITC)
  - Missing in GSTR-1 (potential fake ITC claim)
  - Value mismatches (different amounts in GSTR-1 vs GSTR-2B)
  - Rate mismatches (different GST rates applied)
  - Excess ITC (GSTR-3B claims more than GSTR-2B allows)
  - Duplicate invoice detection
- Results paginated, filterable by type and severity

**c) Knowledge Graph Visualization**
- Interactive force-directed graph (D3-based)
- Search by GSTIN, trade name, invoice number
- Click nodes to inspect properties
- **Circular trade detection** — finds A→B→C→A fraud patterns

**d) AI-Powered Audit Trails**
- Click any mismatch → LLM generates structured explanation
- Sections: Summary, Impact, Root Cause Analysis, Recommended Action
- Invoice chain visualization showing the flow of the transaction
- Exportable as PDF/HTML reports

**e) Vendor Risk Scoring**
- Composite risk score (0-100) based on filing compliance, mismatch rate, circular trading, volume
- AI-generated risk summaries per vendor
- Filter and search across all vendors

**f) Dashboard**
- 6 KPI cards (Taxpayers, Invoices, Txn Value, Mismatches, ITC at Risk, High Risk count)
- Mismatch distribution bar chart
- ITC at risk by type pie chart
- Top risky vendors

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python, async) |
| Database | Neo4j (Knowledge Graph) |
| LLM | Ollama (qwen2.5-coder:32b) with OpenAI/Gemini fallback |
| Visualization | react-force-graph-2d + Recharts |
| Reports | Jinja2 + WeasyPrint (PDF generation) |

---

## 4. Innovation (15 marks)

### What makes this different from existing tools

**1. Knowledge Graph for GST — not done before in this space**
- Existing tools (ClearTax, GSTN portal) use relational databases with table JOINs
- We use Neo4j's native graph traversal — reconciliation becomes a *path problem*, not a *join problem*
- This enables queries that are fundamentally hard in SQL (circular trade detection in one Cypher query vs impossible recursive CTEs)

**2. Graph-based circular trade detection**
```cypher
MATCH path = (a:Taxpayer)-[:TRADES_WITH*2..5]->(a)
RETURN [n IN nodes(path) | n.gstin] AS cycle
```
- This single query finds all fraud cycles up to 5 entities deep
- In a relational DB, this would require self-joins with unknown depth — prohibitively expensive

**3. LLM-generated audit trails with fallback chain**
- Not just flagging mismatches — generating *actionable compliance advice* per mismatch
- LLM fallback chain (OpenAI → Gemini → Ollama) ensures availability regardless of provider status
- System prompts tuned for Indian GST domain (references Section 16(4), DRC-01C notices, specific GSTIN formats)

**4. Composite risk scoring model**
- Multi-factor weighted scoring: filing compliance (25%) + mismatch rate (30%) + circular trading involvement (25%) + volume (20%)
- Not just "high/low risk" — gives a 0-100 score with specific risk factors explained

---

## 5. Impact & Scalability (15 marks)

### Real-World Impact

**For businesses:**
- Automated monthly reconciliation that currently takes hours of manual Excel work
- AI explains *why* each mismatch happened and *what to do* — no GST expertise needed
- Catch supplier non-compliance early, before ITC claims get rejected

**For tax authorities:**
- Circular trade detection at network level — catches fraud that individual return analysis misses
- Risk-based audit prioritization — focus on the riskiest vendors first
- Audit-ready PDF reports with AI explanations

### Scalability Path

| Aspect | Current (Hackathon) | Production Scale |
|--------|---------------------|-----------------|
| Data | Sample data, 30 taxpayers | Millions of GSTINs, billions of invoices |
| Storage | Single Neo4j instance | Neo4j Aura (managed cloud) with sharding |
| Reconciliation | In-memory results | Persistent storage + batch processing |
| LLM | Per-request generation | Cached explanations, batch generation |
| Real-time | Manual upload | GST portal API integration (GSTN APIs) |
| Multi-tenant | Single user | Organization-level access control |

**Why Neo4j scales for this:**
- Neo4j handles billions of nodes with index-free adjacency
- Graph traversal is O(neighbors), not O(total_data) — reconciliation speed depends on connected invoices, not total database size
- Neo4j Aura provides managed cloud with automatic scaling

### Integration possibilities
- Direct GSTN API integration for automatic return fetching
- Tally/Zoho Books plugins for purchase register sync
- WhatsApp/email alerts for new mismatches
- GST Suvidha Provider (GSP) integration

---

## 6. Pitch & Communication (10 marks)

### One-line pitch
> "We turned GST reconciliation from a spreadsheet problem into a graph traversal problem — and added AI to explain the answers."

### Demo flow (suggested 5-minute walkthrough)

1. **Show the problem** (30s) — "Every month, businesses manually VLOOKUP thousands of invoices. They miss patterns. They miss fraud."

2. **Upload data** (30s) — Drop sample files, show nodes being created in real-time

3. **Run reconciliation** (1min) — Click the button, show mismatches detected with severity levels, explain one mismatch type

4. **Graph Explorer** (1min) — Show the knowledge graph, search for a vendor, run circular trade detection, explain why this is impossible in SQL

5. **AI Audit** (1min) — Click "Generate AI Audit Explanation" on a mismatch, show the structured response. Click "AI Risk Summary" on a vendor card.

6. **Dashboard + Reports** (30s) — Show stats, charts, mention PDF export

7. **Architecture recap** (30s) — "Neo4j knowledge graph for relationship-native queries, LLM fallback chain for AI explanations, Next.js + FastAPI for a responsive full-stack experience."

### Key talking points for Q&A

- **"Why not SQL?"** — Circular trade detection requires variable-depth path traversal. In SQL, this is recursive CTEs that don't scale. In Neo4j, it's one query.
- **"How do you handle scale?"** — Neo4j uses index-free adjacency. Traversal cost is proportional to the local neighborhood, not total database size.
- **"What if the LLM is wrong?"** — The LLM generates *explanations*, not *decisions*. The mismatch detection is deterministic graph traversal. The LLM just makes results human-readable.
- **"Is this better than ClearTax?"** — ClearTax does flat matching. We model the *network*. Circular trading detection, relationship-aware risk scoring, and AI audit trails are not available in existing tools.
