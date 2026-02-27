# Case Study: How Our GST Reconciliation Engine Could Have Detected the Rs 70,000 Crore Restaurant Tax Scam

## The Scam

In November 2025, what began as routine Income Tax raids on three Hyderabad biryani chains — **Pista House**, **Shah Ghouse Cafe**, and **Mehfil** — unravelled into one of India's largest tax evasion rackets. The investigation, conducted under **Section 133A** of the Income Tax Act, ultimately exposed an estimated **Rs 70,000 crore** in concealed sales turnover across India's restaurant sector since FY 2019–20.

### Scale of the Fraud

| Metric | Value |
|--------|-------|
| Total billing analysed | Rs 2.43 lakh crore |
| Post-billing deletions flagged | Rs 13,317 crore |
| Estimated concealed turnover (nationwide) | Rs 70,000 crore |
| Restaurant IDs analysed | 1,77,000 |
| Data processed | ~60 terabytes |
| Financial years covered | FY 2019–20 to FY 2025–26 |
| Restaurants on the billing platform | ~1,00,000 (10% of India's market) |

### State-wise Deletion Figures

| State | Estimated Suppression |
|-------|----------------------|
| Karnataka | ~Rs 2,000 crore |
| Telangana | ~Rs 1,500 crore |
| Tamil Nadu | ~Rs 1,200 crore |
| Andhra Pradesh + Telangana combined | Rs 5,141 crore (3,734 PANs) |

---

## The Modus Operandi

The fraud exploited a **popular pan-India billing software platform** (provider based in Ahmedabad) used by over 1 lakh restaurants. Three distinct methods were identified:

### 1. Selective Deletion of Cash Invoices
Restaurants entered **all** transactions — card, UPI, and cash — into the billing system for internal control. Before filing returns, they **selectively deleted cash invoices**, which are harder to trace externally. The filed returns reflected only card/UPI revenue, drastically under-reporting actual income.

### 2. Bulk Date-Range Deletions
Some establishments wiped entire date ranges — sometimes **up to 30 days of billing data** — before filing IT returns reflecting only a fraction of actual sales for those periods.

### 3. Under-Reporting Without Deletion
Certain entities kept all billing records intact but simply **filed income tax and GST returns with lower figures** than what their own systems recorded. The gap between recorded sales and filed turnover reached **up to 27% of sales** in some cases.

### Additional Methods
- **UPI transactions routed through third-party accounts** to obscure the actual recipient
- Cash seizures of approximately **Rs 6 crore** during the initial raids

---

## How Our GST Reconciliation Engine Detects This

Our Knowledge Graph-based system models every entity (Taxpayer, Invoice, Return, Transaction) as interconnected graph nodes. Here's how each module maps to detecting the fraud patterns above:

### 1. Knowledge Graph — Structural Anomaly Detection

**What the scam did:** Deleted cash invoices before filing, creating gaps between actual billing and GSTR-1/GSTR-2B filings.

**What our graph catches:**

```
(:Taxpayer {gstin: "Restaurant A"})
    -[:SUPPLIED_TO]-> (:Invoice {source: "GSTR2B"})  ← Buyer reported it
    -[:SUPPLIED_BY]-> (:Taxpayer {gstin: "Restaurant A"})
                       BUT no matching GSTR-1 outward supply
```

When a buyer's GSTR-2B contains an invoice that the supplier's GSTR-1 doesn't, our graph traversal flags it as **`MISSING_IN_GSTR1`**. This is exactly what happens when restaurants delete outward invoices — their customers' auto-generated GSTR-2B still references those invoices, creating a **graph edge with a missing source node**.

At scale, if Restaurant A shows 500 invoices in buyers' GSTR-2B but only 350 in its own GSTR-1, the system flags a **30% suppression rate** — consistent with the 27% found in this scam.

### 2. Multi-Hop Traversal — UPI Routing Detection

**What the scam did:** Routed UPI payments through third-party accounts.

**What our graph catches:**

```
(:Taxpayer A) -[:TRADES_WITH]-> (:Taxpayer B)  // Direct trade expected
(:Taxpayer A) -[:TRADES_WITH]-> (:Taxpayer C) -[:TRADES_WITH]-> (:Taxpayer B)
                                  ^^ Shell/intermediary entity
```

Our **multi-hop traversal engine** traces invoice chains across 2-5 hops. When payment flows through intermediary entities that don't match the invoice supply chain, the system detects the routing anomaly. The same circular trade detection algorithm that catches ITC fraud detects these **payment laundering chains**.

### 3. Reconciliation Engine — Volume Anomaly Detection

**What the scam did:** Filed returns showing minimal income despite high actual sales.

**What our system catches:**

The **Vendor Risk Model** computes a composite risk score using four weighted factors:

| Factor | Weight | How It Catches This Scam |
|--------|--------|--------------------------|
| Filing compliance | 0.25 | Returns filed but with suppressed values |
| Mismatch frequency | 0.30 | High rate of value mismatches between GSTR-1 and GSTR-2B |
| Circular trading | 0.25 | Payment routing through third-party UPI accounts |
| **Volume anomaly** | **0.20** | **Filed turnover dramatically lower than transaction graph suggests** |

The **volume anomaly** factor is the key detector here. When our graph shows a taxpayer involved in hundreds of supplier-buyer relationships with high `TRADES_WITH` edge weights (volume, frequency), but their filed returns show disproportionately low turnover, the risk score spikes.

**Example:**
- Graph data shows Restaurant A's `TRADES_WITH` edges sum to Rs 50 crore in transaction volume
- GSTR-3B shows claimed output tax on only Rs 35 crore
- System flags **EXCESS_ITC** mismatch + bumps risk score to **CRITICAL (≥75)**

### 4. Explainable Audit Trail — LLM-Powered Investigation

**What investigators needed:** Evidence for Section 133A proceedings with clear audit chains.

**What our system generates:**

When a mismatch is flagged, the **AI Audit Trail Generator** produces a natural-language explanation:

> **Mismatch: VALUE_MISMATCH | Severity: CRITICAL**
>
> Supplier GSTIN 36XXXX1234X1Z5 (Restaurant A) declared outward supply of Rs 2.1 crore in GSTR-1 for period 012026, but buyer-side GSTR-2B records across 12 counterparties reference invoices totaling Rs 3.4 crore for the same period. The Rs 1.3 crore discrepancy (38% suppression) follows a pattern of selective invoice omission concentrated on cash-based transactions.
>
> **Recommendation:** Cross-reference billing software records under Section 133A. Flag for detailed scrutiny of cash invoice deletion logs.

This is exactly the kind of output IT investigators used to build their case — but generated **automatically** instead of requiring months of manual 60TB data analysis.

### 5. Circular Trade Detection — Network-Level Fraud Patterns

**What the scam involved:** A coordinated network of restaurants using the same software platform.

**What our graph catches:**

```cypher
MATCH path = (a:Taxpayer)-[:TRADES_WITH*2..5]->(a)
RETURN nodes(path), length(path)
```

Our circular trade detection algorithm identifies closed loops in the taxpayer graph. In this scam, restaurants under common ownership or coordination would show up as **dense clusters with suspicious trading patterns** — high-frequency, high-value transactions within a tight group, with disproportionately low outward reporting.

---

## Comparison: Manual Investigation vs Our System

| Aspect | IT Department's Approach | Our Knowledge Graph Engine |
|--------|--------------------------|---------------------------|
| Data volume | 60 TB processed over months | Graph DB handles millions of nodes in real-time |
| Detection method | Post-hoc forensic analysis at digital lab | **Continuous monitoring** — flags anomalies as returns are filed |
| Entity mapping | Manual PAN-GSTIN correlation from open sources | **Automatic** — GSTIN relationships built into graph schema |
| Scale | 1.77 lakh restaurant IDs analysed over 6 years | Processes entire taxpayer network in minutes |
| Audit output | Manual investigation reports | **Auto-generated** LLM audit explanations |
| Pattern detection | AI tools on raw billing data | **Graph traversal** — detects structural fraud patterns (circular trades, missing edges, volume anomalies) |
| Proactive vs reactive | Reactive (raids triggered by tips) | **Proactive** — risk scores flag entities before manual intervention |

---

## Key Takeaway

The Rs 70,000 crore restaurant tax scam was fundamentally a **graph problem**. Restaurants deleted nodes (invoices) from their own filings, but the corresponding edges (buyer-side GSTR-2B references, payment flows, trading relationships) remained in the GST network. A Knowledge Graph-based reconciliation engine detects these **structural inconsistencies** automatically — turning what took investigators months of 60TB forensic analysis into real-time mismatch alerts.

> *India's GST reconciliation is fundamentally a graph traversal problem — not flat table matching.*

---

## Sources

- [India Today — Multi-crore restaurant tax scam unearthed, Rs 70,000-crore turnover concealed](https://www.indiatoday.in/india/story/routine-it-department-raids-hyderabad-restaurants-tax-evasion-scam-2870927-2026-02-19)
- [India TV — How probe against Hyderabad's top Biryani chains unearthed Rs 70,000 crore suspected fraud](https://www.indiatvnews.com/news/india/hyderabad-top-biryani-chains-face-major-tax-evasion-probe-rs-70-000-crore-fraud-suspected-nationwide-2026-02-19-1030888)
- [Zee News — The Biryani Trail: How Hyderabad restaurant raids exposed a Rs 70,000 crore pan-India tax scam](https://zeenews.india.com/india/the-biryani-trail-how-hyderabad-restaurant-raids-exposed-a-rs-70000-crore-pan-india-tax-scam-3018755.html)
- [The Week — Rs 70,000-crore scam? How Hyderabad I-T dept used AI to flag pan-Indian tax evasion](https://www.theweek.in/news/biz-tech/2026/02/19/rs-70000-crore-scam-how-hyderabad-i-t-dept-used-ai-to-flag-pan-indian-tax-evasion-at-restaurants.html)
- [Deccan Chronicle — Hyderabad: IT Raids at Pista House, Shah Ghouse Restaurants](https://www.deccanchronicle.com/southern-states/telangana/hyderabad-it-raids-at-pista-house-shah-ghouse-restaurants-1917823)
- [ETV Bharat — I-T Dept Plans Nationwide Crackdown On Restaurants Over Billing Software Tax Evasion](https://www.etvbharat.com/en/state/i-t-dept-plans-nationwide-crackdown-on-restaurants-over-billing-software-tax-evasion-ed-joins-probe-enn26022303878)
