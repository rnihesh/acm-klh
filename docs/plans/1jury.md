# Plan: Final Polish — RAG Chatbot, PDF Export, UI Upgrades

## Context
Hackathon GST Reconciliation app (Next.js 14 + FastAPI + Neo4j). Auth, responsive design, and graph explorer are done. Jury feedback: "large data should be shown clearly and nicely." Need to finish the remaining ~15-20%: RAG chatbot, PDF exports, vendor dropdowns, and overall UI polish.

**What already exists:**
- Backend PDF generation: `GET /api/audit/report/pdf` and `/report/html` (WeasyPrint + Jinja2) — but NO frontend button
- LLM fallback chain: `llm_chain.py` (openai → gemini → ollama) — reuse for chatbot
- Auth, responsive design, graph explorer — all done and pushed

---

## Phase 1: RAG Chatbot Backend

### 1.1 Create `backend/app/api/chat.py` (NEW)
New router mounted at `/api/chat`.

**`POST /api/chat/message`** — accepts `{ message: string, conversation_id?: string }`
- Gathers user context from Neo4j based on the logged-in user's GSTIN:
  - User's taxpayer node, their invoices (SUPPLIED_BY/SUPPLIED_TO), trading partners
  - Latest reconciliation results from `_results_store`
  - Vendor risk scores for their trading partners
  - Audit trails from `_audit_store`
- Builds a system prompt with all this context + GST domain knowledge
- Sends to `generate_text()` from `llm_chain.py` (reuse existing fallback chain)
- Returns `{ response: string, conversation_id: string }`

**`GET /api/chat/suggestions`** — returns 4-5 smart starter questions based on user's data (e.g., "What are my top mismatches?", "Which vendors are high risk?")

Key files to modify/create:
- `backend/app/api/chat.py` (NEW)
- `backend/app/main.py` — register chat router

### 1.2 Context builder function in `backend/app/core/chat_context.py` (NEW)
- `build_user_context(gstin: str) -> str` — queries Neo4j for:
  - Taxpayer info (name, trade name, state)
  - Invoice summary (count, total value, recent invoices)
  - Trading partners (who they buy from / sell to)
  - Mismatch summary (types, amounts, severity breakdown)
  - Risk scores for their vendors
  - Circular trade involvement
- Returns formatted context string (~2000 tokens max) for the LLM prompt
- Also `get_smart_suggestions(gstin: str) -> list[str]` — generates contextual starter questions

---

## Phase 2: RAG Chatbot Frontend

### 2.1 Create `frontend/src/app/chat/page.tsx` (NEW)
Full-page chat interface:
- Left: conversation area with message bubbles (user right-aligned, AI left-aligned)
- Markdown rendering for AI responses (reuse existing `MarkdownRenderer` component)
- Input bar at bottom with send button
- Smart suggestion chips at the top when conversation is empty
- Loading indicator (typing animation) while waiting for response
- Auto-scroll to latest message

### 2.2 Add to `frontend/src/lib/api.ts`
- `sendChatMessage(message: string, conversationId?: string)`
- `getChatSuggestions()`

### 2.3 Add to Sidebar
- New nav item: `{ href: "/chat", label: "AI Assistant", icon: MessageSquare }`

---

## Phase 3: PDF Export on Frontend

### 3.1 Update `frontend/src/app/reconcile/page.tsx`
Add "Export PDF" button in the header area (next to filters). On click:
- Call `GET /api/audit/report/pdf?return_period=MMYYYY`
- Download as blob → trigger browser download
- Show loading spinner on button while generating

### 3.2 Add `downloadPDF` helper to `frontend/src/lib/api.ts`
```ts
export const downloadPDF = async (returnPeriod = "012026") => {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/audit/report/pdf?return_period=${returnPeriod}`, { headers });
  if (!res.ok) throw new Error("PDF generation failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `GST_Audit_Report_${returnPeriod}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
```

### 3.3 Also add PDF button to Dashboard (`frontend/src/app/page.tsx`)
Small "Download Report" button in the header — calls same downloadPDF helper.

---

## Phase 4: Vendor Dropdown & Risk Page Upgrade

### 4.1 Update `frontend/src/app/risk/page.tsx`
- Replace text search with a **searchable dropdown/combobox** for vendor selection
- Custom combobox component: text input that filters a dropdown list of vendors (GSTIN + name)
- On select: show that vendor's full risk detail (current risk card view but expanded)
- Add risk level filter buttons (ALL / CRITICAL / HIGH / MEDIUM / LOW) — already partial, enhance
- Vendor list: show as sortable cards grid with risk score progress bar

### 4.2 Update `frontend/src/app/reconcile/page.tsx`
- Add **vendor filter dropdown** in the filter bar: select supplier/buyer GSTIN to filter mismatches
- Populate from reconciliation results (extract unique GSTINs)
- Show vendor name alongside GSTIN in the dropdown

### 4.3 Create `frontend/src/components/SearchableDropdown.tsx` (NEW)
Reusable searchable dropdown component:
- Text input with dropdown list
- Fuzzy filter on type
- Keyboard navigation (arrow keys + enter)
- Click-outside-to-close
- Used by both risk and reconcile pages

---

## Phase 5: UI Polish — Dashboard & Data Display

### 5.1 Upgrade Dashboard (`frontend/src/app/page.tsx`)
- Add **Severity Distribution** donut chart (CRITICAL/HIGH/MEDIUM/LOW with color coding)
- Add a **Recent Activity** timeline section showing last 5 reconciliation events
- Add **Quick Actions** row: "Run Reconciliation", "Export PDF", "View Graph"
- Make stat cards animated on mount (fade-in stagger)

### 5.2 Upgrade Reconciliation Table (`frontend/src/app/reconcile/page.tsx`)
- Add **column sorting** (click header to sort by amount, severity, type)
- Add **severity badges** with colored dots instead of plain text
- Add **amount formatting** with INR symbol and color (red for high amounts)
- Add **row hover effect** with subtle highlight
- Add **summary bar** above table: total mismatches, total ITC at risk, breakdown by severity
- Better **pagination** controls with page numbers (not just prev/next)

### 5.3 Upgrade Audit Page (`frontend/src/app/audit/page.tsx`)
- Add a **"Generate Report" button** at the top to bulk-export all audit trails as PDF
- Improve the expandable card visual hierarchy
- Add severity badge on each trail header

### 5.4 Upgrade Upload Page (`frontend/src/app/upload/page.tsx`)
- Add **drag-and-drop zone** with visual feedback (dashed border, hover state)
- Show **upload progress** indicator
- Show **file preview** (name, size, type) before upload
- Add recent upload history section

---

## Phase 6: Graph Explorer Final Touch

### 6.1 Update `frontend/src/app/graph/page.tsx`
- Add **legend panel** explaining node colors and sizes
- Add **edge labels** toggle (show/hide transaction values on edges)
- Add **minimap** or navigation breadcrumb
- Improve the detail sidebar when a node is selected: show linked invoices, risk score, trading volume

---

## Implementation Order

| # | Task | File(s) | Depends On |
|---|------|---------|-----------|
| 1 | Chat context builder | `backend/app/core/chat_context.py` (NEW) | — |
| 2 | Chat API endpoint | `backend/app/api/chat.py` (NEW), `main.py` | 1 |
| 3 | Chat frontend + API fn | `app/chat/page.tsx` (NEW), `api.ts`, `Sidebar.tsx` | 2 |
| 4 | PDF download helper | `api.ts` | — |
| 5 | PDF button on reconcile | `app/reconcile/page.tsx` | 4 |
| 6 | PDF button on dashboard | `app/page.tsx` | 4 |
| 7 | SearchableDropdown component | `components/SearchableDropdown.tsx` (NEW) | — |
| 8 | Vendor dropdown on risk page | `app/risk/page.tsx` | 7 |
| 9 | Vendor filter on reconcile | `app/reconcile/page.tsx` | 7 |
| 10 | Dashboard UI upgrade | `app/page.tsx` | — |
| 11 | Reconcile table upgrade | `app/reconcile/page.tsx` | — |
| 12 | Audit page upgrade | `app/audit/page.tsx` | 4 |
| 13 | Upload page upgrade | `app/upload/page.tsx` | — |
| 14 | Graph explorer final touch | `app/graph/page.tsx` | — |

**Parallelizable:** Tasks 1-2 (backend chat) run parallel with 4 (PDF helper), 7 (dropdown), 10-14 (UI upgrades).

---

## Verification
1. `cd backend && uv run uvicorn app.main:app --reload`
2. `cd frontend && npm run dev`
3. Test chatbot: go to `/chat`, send "What are my top mismatches?" — verify context-aware response
4. Test PDF: click "Export PDF" on reconcile page — browser downloads PDF file
5. Test vendor dropdown: go to `/risk`, type in search — dropdown filters vendors
6. Test reconcile filters: verify vendor dropdown + column sorting work
7. Test dashboard: verify new charts render, quick action buttons work
8. `cd frontend && npm run build` — no type errors
