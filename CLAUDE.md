# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Intelligent GST Reconciliation engine using a Neo4j Knowledge Graph. Matches GSTR-1 (seller's outward supplies) against GSTR-2B (auto-generated buyer's inward supplies) to detect ITC mismatches, circular trading fraud, and vendor compliance risk. LLM-powered audit trail generation.

## Commands

### Backend (Python/FastAPI — uses `uv`, NOT pip)
```bash
cd backend
uv sync                                          # install deps
uv run uvicorn app.main:app --reload              # run dev server on :8000
uv run pytest                                     # run tests
uv run pytest tests/test_reconciler.py -k "test_name"  # single test
uv lock                                           # regenerate lockfile after pyproject.toml change
```

### Frontend (Next.js 14)
```bash
cd frontend
npm install
npm run dev       # dev server on :3000
npm run build     # production build (standalone output)
npm run lint      # eslint
```

### Infrastructure
```bash
docker compose up neo4j -d                        # Neo4j only (local dev)
docker compose up -d                              # full stack (neo4j + backend + frontend + caddy)
docker compose down -v                            # teardown + delete volumes
```

### Data Generation & Seeding
```bash
python3 data/generator/mock_gst_data.py           # generate sample JSON in data/sample/
python3 data/generator/seed_neo4j.py              # upload sample data to running backend at :8000
```

## Architecture

**3-tier stack:** Next.js frontend → FastAPI backend → Neo4j graph DB, fronted by Caddy reverse proxy for production (`gst.niheshr.com`).

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app with lifespan (creates Neo4j constraints on startup, closes driver on shutdown). Mounts 5 routers under `/api/`.
- **`config.py`** — Pydantic Settings from `.env`. Singleton via `@lru_cache`. All config flows through `get_settings()`.
- **`core/graph_db.py`** — Neo4j driver singleton. All Cypher queries live here: constraint creation, invoice ingestion (creates Invoice node + SUPPLIED_BY/SUPPLIED_TO/TRADES_WITH relationships), graph traversal, circular trade detection.
- **`core/reconciler.py`** — Reconciliation engine. Runs 3 Cypher-based checks: GSTR-1 vs GSTR-2B (missing invoices, value mismatches, rate mismatches), excess ITC (GSTR-3B claimed vs GSTR-2B available), duplicate invoices. Returns list of mismatch dicts.
- **`core/llm_chain.py`** — LLM fallback chain: tries providers in `LLM_PRIORITY` order (openai→gemini→ollama). Each provider imported lazily. Two specialized prompts: `generate_audit_explanation()` and `generate_risk_summary()`.
- **`core/risk_model.py`** — Vendor risk scoring. Composite score from 4 weighted factors: filing compliance (0.25), mismatch frequency (0.30), circular trading (0.25), volume anomaly (0.20). Thresholds: ≥75 CRITICAL, ≥50 HIGH, ≥25 MEDIUM.
- **`models/gst.py`** — Pydantic models and enums. GSTIN validated by regex pattern. 8 `MismatchType` variants, 4 `Severity`/`RiskLevel` levels.
- **`api/`** — 5 routers: `ingest` (file upload CSV/JSON), `reconcile` (trigger + results + graph endpoints), `audit` (LLM explanations), `risk` (vendor scores), `stats` (dashboard aggregates).

### Knowledge Graph Schema

**Nodes:** `Taxpayer` (keyed on gstin), `Invoice` (keyed on composite `supplierGSTIN_invoiceNumber_period`), `GSTR1Return`, `GSTR2BReturn`, `GSTR3BReturn`

**Relationships:** `SUPPLIED_BY` (Invoice→Taxpayer), `SUPPLIED_TO` (Invoice→Taxpayer), `TRADES_WITH` (Taxpayer→Taxpayer, aggregated volume/frequency), `CONTAINS_OUTWARD` (GSTR1Return→Invoice), `CONTAINS_INWARD` (GSTR2BReturn→Invoice)

### Frontend (`frontend/src/`)

Next.js App Router, dark theme, Tailwind. `src/lib/api.ts` is the single API client — all backend calls go through it. `src/lib/utils.ts` has formatting helpers (INR currency, severity/risk color mapping). Graph visualization uses `react-force-graph-2d` (dynamically imported, SSR disabled). Next.js rewrites `/api/*` to the backend via `next.config.js`.

### Data Flow

1. Upload CSV/JSON → `POST /api/data/upload` → Neo4j (creates nodes + relationships)
2. Trigger reconciliation → `POST /api/reconcile` → Cypher graph traversal → in-memory results store
3. View mismatches → `GET /api/reconcile/results` (paginated, filterable)
4. Generate audit → `POST /api/audit/generate` → LLM fallback chain → returns explanation + invoice chain + recommendation
5. Vendor risk → `GET /api/risk/vendors` → Neo4j aggregation + composite scoring

## Key Conventions

- **Python uses `uv` exclusively** — no pip, no requirements.txt, no virtualenv sourcing. Dependencies in `backend/pyproject.toml`, lockfile in `backend/uv.lock`.
- **Neo4j required** — backend will not start without a running Neo4j instance (bolt://localhost:7687 or via docker compose).
- **In-memory stores** — reconciliation results and audit trails use `_results_store`/`_audit_store` dicts (hackathon scope, not persistent across restarts).
- **LLM is optional** — if no API keys are set, audit/risk summary endpoints return a fallback string instead of crashing.
- **Return period format** — `MMYYYY` string (e.g., "012026" for January 2026). Used as a partition key throughout.
- **GSTIN format** — 15-char Indian tax ID: 2-digit state code + 10-digit PAN + entity number + Z + checksum.
- **Team ownership** — `frontend/` is Nihesh's, `backend/` is Mahesh's, `data/` is shared. Specs in `docs/plans/SPEC-*.md`.
