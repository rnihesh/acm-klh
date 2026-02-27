"""
Context builder for RAG chatbot — gathers user-specific data from Neo4j
and formats it as context for the LLM prompt. Optionally enriches with
nomic-embed vector similarity search for hybrid RAG.
"""

from app.core.graph_db import get_driver, find_circular_trades
from app.api.reconcile import _results_store
from app.api.audit import _audit_store
from app.core.risk_model import calculate_all_vendor_risks
from app.core.embeddings import index_documents, search_similar, is_available as embed_available


def build_user_context(gstin: str) -> str:
    """
    Query Neo4j for a taxpayer's full context and return a formatted
    string (~2000 tokens max) for injection into the LLM system prompt.
    """
    driver = get_driver()
    sections: list[str] = []

    with driver.session() as session:
        # 1. Taxpayer info
        tp = session.run(
            """
            MATCH (t:Taxpayer {gstin: $gstin})
            RETURN t.legal_name AS legal_name, t.trade_name AS trade_name,
                   t.state_code AS state_code, t.registration_type AS reg_type,
                   t.status AS status
            """,
            gstin=gstin,
        ).single()

        if tp:
            sections.append(
                f"## Taxpayer Profile\n"
                f"- GSTIN: {gstin}\n"
                f"- Legal Name: {tp['legal_name'] or 'N/A'}\n"
                f"- Trade Name: {tp['trade_name'] or 'N/A'}\n"
                f"- State Code: {tp['state_code'] or 'N/A'}\n"
                f"- Registration: {tp['reg_type'] or 'N/A'} | Status: {tp['status'] or 'N/A'}"
            )

        # 2. Invoice summary
        inv = session.run(
            """
            MATCH (inv:Invoice)
            WHERE inv.supplier_gstin = $gstin OR inv.buyer_gstin = $gstin
            WITH inv,
                 CASE WHEN inv.supplier_gstin = $gstin THEN 'outward' ELSE 'inward' END AS direction
            RETURN direction,
                   count(inv) AS cnt,
                   round(sum(inv.total_value), 2) AS total_value,
                   round(sum(inv.taxable_value), 2) AS taxable_value
            ORDER BY direction
            """,
            gstin=gstin,
        )
        inv_lines = []
        for r in inv:
            inv_lines.append(
                f"  - {r['direction'].title()}: {r['cnt']} invoices, "
                f"total ₹{r['total_value']:,.2f} (taxable ₹{r['taxable_value']:,.2f})"
            )
        if inv_lines:
            sections.append("## Invoice Summary\n" + "\n".join(inv_lines))

        # 3. Top trading partners
        partners = session.run(
            """
            MATCH (t:Taxpayer {gstin: $gstin})-[tw:TRADES_WITH]-(partner:Taxpayer)
            RETURN partner.gstin AS gstin, partner.legal_name AS name,
                   tw.volume AS volume, tw.frequency AS freq
            ORDER BY tw.volume DESC LIMIT 8
            """,
            gstin=gstin,
        )
        partner_lines = []
        for r in partners:
            partner_lines.append(
                f"  - {r['name'] or r['gstin']} ({r['gstin']}) — "
                f"₹{r['volume']:,.2f} across {r['freq']} transactions"
            )
        if partner_lines:
            sections.append("## Top Trading Partners\n" + "\n".join(partner_lines))

        # 4. Filing status
        filings = session.run(
            """
            MATCH (t:Taxpayer {gstin: $gstin})-[:FILED]->(r)
            RETURN labels(r)[0] AS return_type, r.return_period AS period
            ORDER BY r.return_period DESC
            """,
            gstin=gstin,
        )
        filing_lines = []
        for r in filings:
            filing_lines.append(f"  - {r['return_type']} for period {r['period']}")
        if filing_lines:
            sections.append("## Returns Filed\n" + "\n".join(filing_lines[:10]))

    # 5. Reconciliation mismatches (from in-memory store)
    all_mismatches = []
    for cached in _results_store.values():
        for m in cached.get("results", []):
            if m.get("supplier_gstin") == gstin or m.get("buyer_gstin") == gstin:
                all_mismatches.append(m)

    if all_mismatches:
        type_counts: dict[str, int] = {}
        sev_counts: dict[str, int] = {}
        total_diff = 0.0
        for m in all_mismatches:
            mt = m.get("mismatch_type", "UNKNOWN")
            type_counts[mt] = type_counts.get(mt, 0) + 1
            sev = m.get("severity", "UNKNOWN")
            sev_counts[sev] = sev_counts.get(sev, 0) + 1
            total_diff += m.get("amount_difference", 0)

        mismatch_section = (
            f"## Reconciliation Mismatches ({len(all_mismatches)} total, ₹{total_diff:,.2f} at risk)\n"
            f"  - By type: {', '.join(f'{k}: {v}' for k, v in type_counts.items())}\n"
            f"  - By severity: {', '.join(f'{k}: {v}' for k, v in sev_counts.items())}"
        )

        # Include top 5 mismatches as detail
        detail_lines = []
        for m in all_mismatches[:5]:
            detail_lines.append(
                f"  - [{m.get('severity')}] {m.get('mismatch_type')}: "
                f"Invoice {m.get('invoice_number')}, ₹{m.get('amount_difference', 0):,.2f} — "
                f"{m.get('description', '')[:80]}"
            )
        if detail_lines:
            mismatch_section += "\n  Top mismatches:\n" + "\n".join(detail_lines)
        sections.append(mismatch_section)

    # 6. Vendor risk scores for trading partners
    try:
        all_risks = calculate_all_vendor_risks()
        user_risk = next((v for v in all_risks if v["gstin"] == gstin), None)
        if user_risk:
            sections.append(
                f"## Your Risk Profile\n"
                f"  - Risk Score: {user_risk['risk_score']}/100 ({user_risk['risk_level']})\n"
                f"  - Filing Rate: {user_risk['filing_rate']}%\n"
                f"  - Mismatch Count: {user_risk['mismatch_count']}/{user_risk['total_invoices']} invoices\n"
                f"  - Circular Trade: {'YES ⚠️' if user_risk['circular_trade_flag'] else 'No'}\n"
                f"  - Risk Factors: {', '.join(user_risk['risk_factors']) if user_risk['risk_factors'] else 'None'}"
            )

        partner_risks = [v for v in all_risks if v["gstin"] != gstin and v["risk_score"] > 20][:5]
        if partner_risks:
            risk_lines = [
                f"  - {v['legal_name']} ({v['gstin']}) — Score: {v['risk_score']}, Level: {v['risk_level']}"
                for v in partner_risks
            ]
            sections.append("## Risky Vendors in Network\n" + "\n".join(risk_lines))
    except Exception:
        pass

    # 7. Circular trade involvement
    try:
        cycles = find_circular_trades()
        user_cycles = [c for c in cycles if gstin in c["cycle"]]
        if user_cycles:
            cycle_lines = []
            for c in user_cycles[:3]:
                chain = " → ".join(c["cycle"])
                cycle_lines.append(f"  - {chain} (length: {c['cycle_length']})")
            sections.append("## ⚠️ Circular Trade Alerts\n" + "\n".join(cycle_lines))
    except Exception:
        pass

    # 8. Audit trails
    user_audits = [a for a in _audit_store if gstin in str(a)]
    if user_audits:
        sections.append(
            f"## Audit Trails Generated: {len(user_audits)}\n"
            f"  Latest: {user_audits[-1].get('generated_at', 'N/A')}"
        )

    return "\n\n".join(sections) if sections else "No data found for this GSTIN."


def get_smart_suggestions(gstin: str) -> list[str]:
    """Generate contextual starter questions based on the user's data."""
    driver = get_driver()
    suggestions: list[str] = []

    with driver.session() as session:
        # Check if they have invoices
        inv_count = session.run(
            "MATCH (inv:Invoice) WHERE inv.supplier_gstin = $gstin OR inv.buyer_gstin = $gstin "
            "RETURN count(inv) AS c",
            gstin=gstin,
        ).single()["c"]

        if inv_count > 0:
            suggestions.append("Summarize my invoice activity for this period")
            suggestions.append("Which of my trading partners have the highest transaction volume?")

    # Check mismatches
    user_mismatches = []
    for cached in _results_store.values():
        for m in cached.get("results", []):
            if m.get("supplier_gstin") == gstin or m.get("buyer_gstin") == gstin:
                user_mismatches.append(m)

    if user_mismatches:
        suggestions.append("What are my top reconciliation mismatches and their impact?")
        suggestions.append("How much ITC is at risk and what should I do about it?")
    else:
        suggestions.append("What does GSTR-1 vs GSTR-2B reconciliation mean?")

    # Check circular trades
    try:
        cycles = find_circular_trades()
        if any(gstin in c["cycle"] for c in cycles):
            suggestions.append("Explain the circular trading pattern I'm involved in")
    except Exception:
        pass

    # Always include general questions
    if len(suggestions) < 4:
        suggestions.append("What are the key GST compliance risks I should be aware of?")
    if len(suggestions) < 5:
        suggestions.append("How can I improve my GST filing compliance?")

    return suggestions[:5]


async def build_hybrid_context(gstin: str, query: str) -> str:
    """
    Build context using both graph RAG (Neo4j) and vector similarity
    search (nomic-embed-text). Falls back to pure graph RAG if embeddings
    are unavailable.
    """
    # Always get graph context
    graph_context = build_user_context(gstin)

    # Try to index current data for vector search
    try:
        docs_to_index: list[dict] = []

        # Index mismatches
        for cached in _results_store.values():
            for m in cached.get("results", []):
                if m.get("supplier_gstin") == gstin or m.get("buyer_gstin") == gstin:
                    text = (
                        f"Mismatch: {m.get('mismatch_type')} | Severity: {m.get('severity')} | "
                        f"Invoice: {m.get('invoice_number')} | Supplier: {m.get('supplier_gstin')} | "
                        f"Buyer: {m.get('buyer_gstin')} | Difference: ₹{m.get('amount_difference', 0):,.2f} | "
                        f"Description: {m.get('description', '')}"
                    )
                    docs_to_index.append({"text": text, "metadata": {"type": "mismatch", "id": m.get("id")}})

        # Index audit trails
        for audit in _audit_store:
            if gstin in str(audit):
                text = f"Audit: {audit.get('explanation', '')[:500]}"
                docs_to_index.append({"text": text, "metadata": {"type": "audit"}})

        if docs_to_index:
            await index_documents(docs_to_index)
    except Exception:
        pass

    # Search for relevant context via embeddings
    embedding_context = ""
    try:
        if embed_available():
            results = await search_similar(query, top_k=3)
            if results:
                relevant_texts = [f"  - {r['text']}" for r in results if r['score'] > 0.3]
                if relevant_texts:
                    embedding_context = (
                        "\n\n## Semantically Relevant Data (via vector search)\n"
                        + "\n".join(relevant_texts)
                    )
    except Exception:
        pass

    return graph_context + embedding_context
