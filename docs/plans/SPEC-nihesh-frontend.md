# SPEC: Nihesh — Frontend + Deployment + Integration

## Role
You own the **frontend/** directory, **docker-compose.yml**, **Caddyfile**, and deployment.
DO NOT touch `backend/` or `data/` — those belong to Mahesh and Person 3.

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- react-force-graph-2d (knowledge graph visualization)
- recharts (charts and analytics)
- @tanstack/react-query (API state management)
- jspdf + html2canvas (PDF export)

## Pages to Build

### 1. Dashboard Home (`/`)
- **Summary cards**: Total taxpayers, invoices, mismatches found, high-risk vendors
- **Mismatch breakdown chart** (pie/donut): by type (missing, value, rate, period, etc.)
- **Recent reconciliation runs** table
- **Risk distribution** bar chart (low/medium/high/critical)

### 2. Data Upload (`/upload`)
- Drag-and-drop CSV/JSON upload for GSTR-1, GSTR-2B, GSTR-3B, Purchase Register
- File validation and preview
- Trigger reconciliation via POST `/api/reconcile`
- Show progress/status

### 3. Reconciliation Results (`/reconciliation`)
- Filterable/sortable table of all mismatches
- Columns: Invoice #, Supplier GSTIN, Buyer GSTIN, Mismatch Type, Severity, Amount Diff
- Click row → detail view with full invoice comparison
- Filters: mismatch type, severity, date range, GSTIN
- Export to CSV

### 4. Knowledge Graph Explorer (`/graph-explorer`)
- Interactive force-directed graph using react-force-graph-2d
- Nodes: Taxpayers (blue), Invoices (green), Returns (orange)
- Edges: relationships with labels
- Click node → side panel with details
- Search by GSTIN or Invoice #
- Highlight circular trading paths (red edges)
- Zoom, pan, drag

### 5. Audit Trails (`/audit-trails`)
- List of generated audit trails
- Each trail: natural language explanation from LLM
- Invoice chain visualization (step by step)
- "Generate Audit" button → calls POST `/api/audit/generate`
- PDF download button

### 6. Vendor Risk (`/vendor-risk`)
- Vendor risk scoreboard (table sorted by risk score)
- Columns: GSTIN, Name, Risk Score, Filing Rate, Mismatch Count, Circular Trade Flag
- Click vendor → detailed risk breakdown
- Risk trend chart over time
- Color-coded: green (low), yellow (medium), red (high), purple (critical)

## API Endpoints You'll Consume
All from FastAPI backend at `/api/`:

```
GET  /api/health
POST /api/data/upload                    # Upload CSV/JSON files
POST /api/reconcile                      # Trigger reconciliation
GET  /api/reconcile/results              # Get mismatch results
GET  /api/reconcile/results/{id}         # Single mismatch detail
GET  /api/graph/nodes                    # Get graph nodes for viz
GET  /api/graph/search?q={gstin}         # Search graph
GET  /api/graph/circular-trades          # Get circular trading paths
POST /api/audit/generate                 # Generate audit trail for mismatch
GET  /api/audit/trails                   # List audit trails
GET  /api/audit/trails/{id}              # Single audit trail
GET  /api/risk/vendors                   # Vendor risk scores
GET  /api/risk/vendors/{gstin}           # Single vendor risk detail
GET  /api/stats/dashboard                # Dashboard summary stats
```

## Component Library (shadcn/ui)
Install these: button, card, table, badge, dialog, input, select, tabs, toast, dropdown-menu, separator, skeleton

## Folder Structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with sidebar nav
│   │   ├── page.tsx                # Dashboard
│   │   ├── upload/page.tsx
│   │   ├── reconciliation/page.tsx
│   │   ├── graph-explorer/page.tsx
│   │   ├── audit-trails/page.tsx
│   │   └── vendor-risk/page.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── nav-links.tsx
│   │   ├── dashboard/
│   │   │   ├── summary-cards.tsx
│   │   │   ├── mismatch-chart.tsx
│   │   │   └── risk-distribution.tsx
│   │   ├── graph/
│   │   │   ├── force-graph.tsx
│   │   │   ├── node-detail-panel.tsx
│   │   │   └── graph-controls.tsx
│   │   ├── reconciliation/
│   │   │   ├── mismatch-table.tsx
│   │   │   └── mismatch-detail.tsx
│   │   ├── audit/
│   │   │   ├── audit-card.tsx
│   │   │   └── invoice-chain.tsx
│   │   └── risk/
│   │       ├── vendor-table.tsx
│   │       └── risk-breakdown.tsx
│   ├── lib/
│   │   ├── api.ts                  # Axios/fetch wrapper
│   │   ├── types.ts                # TypeScript types matching backend models
│   │   └── utils.ts
│   └── styles/
│       └── globals.css
├── public/
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── Dockerfile
```

## Priority Order
1. Dashboard page with mock data (hours 0-4)
2. Graph explorer with react-force-graph (hours 4-8)
3. Reconciliation results table (hours 8-12)
4. Integrate with real backend API (hours 12-16)
5. Audit trails page + PDF export (hours 16-20)
6. Vendor risk page (hours 20-22)
7. Polish, animations, deployment (hours 22-24)

## Deployment Tasks
- Set up Docker Compose with Neo4j + Backend + Frontend + Caddy
- Configure Caddy for `gst.niheshr.com` with auto-SSL
- Push docker-compose to Azure VM
- Test end-to-end

## Design Principles
- Dark theme (professional, fintech vibe)
- Responsive but desktop-first (judges will use laptops)
- Loading skeletons for all API calls
- Toast notifications for actions
- Consistent color coding for risk levels
