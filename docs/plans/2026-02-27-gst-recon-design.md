# GST Reconciliation Knowledge Graph — Design Document

## Problem Statement #76
Build a Knowledge Graph-based GST reconciliation engine that models GST data as graph entities, enables multi-hop traversal to validate invoice-to-tax-payment chains, classifies mismatches by financial risk, and generates explainable audit trails.

## Architecture

### Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui + react-force-graph
- **Backend**: FastAPI (Python 3.11+)
- **Graph DB**: Neo4j 5.x (Docker)
- **LLM**: OpenAI (primary) → Gemini → Ollama (fallback chain)
- **ML**: scikit-learn + NetworkX (graph analytics)
- **Deployment**: Docker Compose → Azure VM (8CPU/16GB) → gst.niheshr.com (Caddy SSL)

### System Diagram
```
Caddy (SSL) → /api/* → FastAPI :8000 → Neo4j :7687
             → /*     → Next.js :3000
```

## Knowledge Graph Schema

### Nodes
| Node Label | Properties |
|-----------|-----------|
| Taxpayer | gstin, legal_name, trade_name, state_code, registration_type, status |
| Invoice | invoice_number, invoice_date, invoice_type, taxable_value, cgst, sgst, igst, total_value, place_of_supply, reverse_charge |
| GSTR1Return | gstin, return_period, filing_date, status |
| GSTR2BReturn | gstin, return_period, generation_date |
| GSTR3BReturn | gstin, return_period, filing_date, itc_claimed, output_tax, net_tax |
| HSNCode | code, description, gst_rate |

### Relationships
| Relationship | From → To | Properties |
|-------------|----------|-----------|
| FILED | Taxpayer → GSTR1Return/GSTR3BReturn | filing_date |
| RECEIVED | Taxpayer → GSTR2BReturn | |
| CONTAINS_OUTWARD | GSTR1Return → Invoice | |
| CONTAINS_INWARD | GSTR2BReturn → Invoice | |
| SUPPLIED_BY | Invoice → Taxpayer (seller) | |
| SUPPLIED_TO | Invoice → Taxpayer (buyer) | |
| CLAIMS_ITC_FOR | GSTR3BReturn → Invoice | claimed_amount |
| HAS_HSN | Invoice → HSNCode | |
| MATCHED_WITH | Invoice → Invoice | match_score, mismatch_type |
| TRADES_WITH | Taxpayer → Taxpayer | volume, frequency, risk_score |

## Mismatch Classification
1. **MISSING_IN_GSTR1** — Invoice in purchase register but seller didn't file in GSTR-1
2. **MISSING_IN_GSTR2B** — Invoice in GSTR-1 but not reflected in buyer's GSTR-2B
3. **VALUE_MISMATCH** — Taxable value or tax amounts differ between returns
4. **RATE_MISMATCH** — GST rate applied differs
5. **PERIOD_MISMATCH** — Invoice reported in different tax periods
6. **GSTIN_ERROR** — GSTIN formatting or mapping issues
7. **DUPLICATE_INVOICE** — Same invoice number appears multiple times
8. **EXCESS_ITC** — ITC claimed in GSTR-3B exceeds GSTR-2B available

## Risk Scoring Model
- Filing compliance score (0-100)
- Mismatch frequency score
- Circular trading indicator (graph cycle detection)
- Invoice volume anomaly score
- Weighted composite vendor risk score

## Deliverables
1. Knowledge Graph schema + data model (Neo4j)
2. Reconciliation engine with mismatch classification
3. Interactive ITC risk + vendor compliance dashboard
4. Explainable audit trail generator (LLM-powered)
5. Predictive vendor compliance risk model

## Team
- **Nihesh** (Person 1): Frontend (Next.js), deployment, integration
- **Mahesh** (Person 2): Backend (FastAPI), Neo4j, reconciliation engine, LLM, ML
- **Person 3** (joins hour 10): Mock data generator, Neo4j seeding, testing, docs
