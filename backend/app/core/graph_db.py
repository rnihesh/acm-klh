from neo4j import GraphDatabase, AsyncGraphDatabase
from app.config import get_settings

_driver = None


def get_driver():
    global _driver
    if _driver is None:
        settings = get_settings()
        _driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
    return _driver


def close_driver():
    global _driver
    if _driver:
        _driver.close()
        _driver = None


def create_constraints():
    driver = get_driver()
    with driver.session() as session:
        constraints = [
            "CREATE CONSTRAINT taxpayer_gstin IF NOT EXISTS FOR (t:Taxpayer) REQUIRE t.gstin IS UNIQUE",
            "CREATE CONSTRAINT invoice_id IF NOT EXISTS FOR (i:Invoice) REQUIRE i.invoice_id IS UNIQUE",
            "CREATE INDEX taxpayer_name IF NOT EXISTS FOR (t:Taxpayer) ON (t.legal_name)",
            "CREATE INDEX invoice_number IF NOT EXISTS FOR (i:Invoice) ON (i.invoice_number)",
            "CREATE INDEX invoice_period IF NOT EXISTS FOR (i:Invoice) ON (i.return_period)",
        ]
        for cypher in constraints:
            session.run(cypher)


def ingest_taxpayer(tx, data: dict):
    tx.run(
        """
        MERGE (t:Taxpayer {gstin: $gstin})
        SET t.legal_name = $legal_name,
            t.trade_name = $trade_name,
            t.state_code = $state_code,
            t.registration_type = $registration_type,
            t.status = $status
        """,
        **data,
    )


def ingest_invoice_with_relations(tx, invoice: dict, return_type: str, return_period: str):
    invoice_id = f"{invoice['supplier_gstin']}_{invoice['invoice_number']}_{return_period}"

    tx.run(
        """
        MERGE (inv:Invoice {invoice_id: $invoice_id})
        SET inv.invoice_number = $invoice_number,
            inv.invoice_date = $invoice_date,
            inv.invoice_type = $invoice_type,
            inv.supplier_gstin = $supplier_gstin,
            inv.buyer_gstin = $buyer_gstin,
            inv.taxable_value = $taxable_value,
            inv.cgst = $cgst,
            inv.sgst = $sgst,
            inv.igst = $igst,
            inv.total_value = $total_value,
            inv.gst_rate = $gst_rate,
            inv.hsn_code = $hsn_code,
            inv.place_of_supply = $place_of_supply,
            inv.reverse_charge = $reverse_charge,
            inv.return_period = $return_period,
            inv.source = $return_type

        MERGE (supplier:Taxpayer {gstin: $supplier_gstin})
        MERGE (buyer:Taxpayer {gstin: $buyer_gstin})
        MERGE (inv)-[:SUPPLIED_BY]->(supplier)
        MERGE (inv)-[:SUPPLIED_TO]->(buyer)
        MERGE (supplier)-[tw:TRADES_WITH]->(buyer)
        ON CREATE SET tw.volume = $total_value, tw.frequency = 1
        ON MATCH SET tw.volume = tw.volume + $total_value, tw.frequency = tw.frequency + 1
        """,
        invoice_id=invoice_id,
        return_type=return_type,
        return_period=return_period,
        **invoice,
    )

    if return_type == "GSTR1":
        tx.run(
            """
            MERGE (r:GSTR1Return {gstin: $gstin, return_period: $period})
            WITH r
            MATCH (inv:Invoice {invoice_id: $invoice_id})
            MERGE (r)-[:CONTAINS_OUTWARD]->(inv)
            """,
            gstin=invoice["supplier_gstin"],
            period=return_period,
            invoice_id=invoice_id,
        )
    elif return_type == "GSTR2B":
        tx.run(
            """
            MERGE (r:GSTR2BReturn {gstin: $gstin, return_period: $period})
            WITH r
            MATCH (inv:Invoice {invoice_id: $invoice_id})
            MERGE (r)-[:CONTAINS_INWARD]->(inv)
            """,
            gstin=invoice["buyer_gstin"],
            period=return_period,
            invoice_id=invoice_id,
        )


def ingest_gstr3b(tx, data: dict, return_period: str):
    tx.run(
        """
        MERGE (r:GSTR3BReturn {gstin: $gstin, return_period: $return_period})
        SET r.itc_claimed = $itc_claimed,
            r.itc_available = $itc_available,
            r.output_tax = $output_tax,
            r.tax_paid = $tax_paid

        MERGE (t:Taxpayer {gstin: $gstin})
        MERGE (t)-[:FILED]->(r)
        """,
        gstin=data["gstin"],
        return_period=return_period,
        itc_claimed=data.get("total_itc_claimed", data.get("itc_claimed", 0)),
        itc_available=data.get("itc_available_as_per_gstr2b", data.get("itc_available", 0)),
        output_tax=data.get("output_tax_liability", data.get("output_tax", 0)),
        tax_paid=data.get("tax_paid", 0),
    )


def ingest_gstr1_return(tx, gstin: str, return_period: str, filing_date: str = None):
    tx.run(
        """
        MERGE (r:GSTR1Return {gstin: $gstin, return_period: $return_period})
        SET r.filing_date = $filing_date
        MERGE (t:Taxpayer {gstin: $gstin})
        MERGE (t)-[:FILED]->(r)
        """,
        gstin=gstin,
        return_period=return_period,
        filing_date=filing_date,
    )


def ingest_gstr2b_return(tx, gstin: str, return_period: str, generation_date: str = None):
    tx.run(
        """
        MERGE (r:GSTR2BReturn {gstin: $gstin, return_period: $return_period})
        SET r.generation_date = $generation_date
        MERGE (t:Taxpayer {gstin: $gstin})
        MERGE (t)-[:RECEIVED]->(r)
        """,
        gstin=gstin,
        return_period=return_period,
        generation_date=generation_date,
    )


def _node_label(labels: list[str], props: dict) -> str:
    """Pick the best display label for a node."""
    if "Taxpayer" in labels:
        return props.get("trade_name") or props.get("legal_name") or props.get("gstin", "")
    if "Invoice" in labels:
        return props.get("invoice_number", props.get("invoice_id", ""))
    if "GSTR1Return" in labels:
        return f"GSTR1 {props.get('gstin', '')[:8]}..{props.get('return_period', '')}"
    if "GSTR2BReturn" in labels:
        return f"GSTR2B {props.get('gstin', '')[:8]}..{props.get('return_period', '')}"
    if "GSTR3BReturn" in labels:
        return f"GSTR3B {props.get('gstin', '')[:8]}..{props.get('return_period', '')}"
    return str(props.get("id", ""))


def _transform_node(raw: dict) -> dict:
    """Transform a raw Neo4j node dict into flat frontend-friendly format."""
    labels = raw.get("labels", [])
    props = raw.get("properties", {})
    node_type = labels[0] if labels else "Unknown"
    return {
        "id": raw["id"],
        "type": node_type,
        "label": _node_label(labels, props),
        **props,
    }


def get_graph_data(limit: int = 200):
    driver = get_driver()
    with driver.session() as session:
        # Collect nodes
        node_result = session.run(
            """
            MATCH (n)
            WITH n LIMIT $limit
            RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS properties
            """,
            limit=limit,
        )
        node_ids = set()
        nodes = []
        for r in node_result:
            raw = {"id": r["id"], "labels": r["labels"], "properties": r["properties"]}
            node_ids.add(r["id"])
            nodes.append(_transform_node(raw))

        # Collect edges between those nodes
        edge_result = session.run(
            """
            MATCH (n)-[r]->(m)
            WHERE elementId(n) IN $ids AND elementId(m) IN $ids
            RETURN elementId(n) AS source, elementId(m) AS target,
                   type(r) AS type, properties(r) AS properties
            """,
            ids=list(node_ids),
        )
        links = []
        for r in edge_result:
            link = {
                "source": r["source"],
                "target": r["target"],
                "type": r["type"],
            }
            # Include relationship properties (e.g. volume, frequency for TRADES_WITH)
            if r["properties"]:
                link.update(r["properties"])
            links.append(link)

        # Also add target nodes that might be outside the original limit
        missing_ids = set()
        for link in links:
            if link["target"] not in node_ids:
                missing_ids.add(link["target"])

        if missing_ids:
            extra = session.run(
                """
                UNWIND $ids AS nid
                MATCH (n) WHERE elementId(n) = nid
                RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS properties
                """,
                ids=list(missing_ids),
            )
            for r in extra:
                raw = {"id": r["id"], "labels": r["labels"], "properties": r["properties"]}
                nodes.append(_transform_node(raw))
                node_ids.add(r["id"])

        return {"nodes": nodes, "links": links}


def search_graph(query: str):
    driver = get_driver()
    with driver.session() as session:
        # Find matching nodes
        node_result = session.run(
            """
            MATCH (n)
            WHERE n.gstin CONTAINS $q
               OR n.legal_name CONTAINS $q
               OR n.invoice_number CONTAINS $q
               OR n.trade_name CONTAINS $q
            RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS properties
            LIMIT 50
            """,
            q=query,
        )
        node_ids = set()
        nodes = []
        for r in node_result:
            raw = {"id": r["id"], "labels": r["labels"], "properties": r["properties"]}
            node_ids.add(r["id"])
            nodes.append(_transform_node(raw))

        if not node_ids:
            return {"nodes": [], "links": []}

        # Find relationships between matched nodes + their neighbors
        edge_result = session.run(
            """
            MATCH (n)-[r]->(m)
            WHERE elementId(n) IN $ids OR elementId(m) IN $ids
            RETURN elementId(n) AS source, elementId(m) AS target,
                   type(r) AS type,
                   elementId(n) AS src_id, elementId(m) AS tgt_id,
                   labels(n) AS src_labels, properties(n) AS src_props,
                   labels(m) AS tgt_labels, properties(m) AS tgt_props
            LIMIT 200
            """,
            ids=list(node_ids),
        )
        links = []
        for r in edge_result:
            links.append({"source": r["source"], "target": r["target"], "type": r["type"]})
            # Add neighbor nodes if not already present
            for prefix in ["src", "tgt"]:
                nid = r[f"{prefix}_id"]
                if nid not in node_ids:
                    raw = {"id": nid, "labels": r[f"{prefix}_labels"], "properties": r[f"{prefix}_props"]}
                    nodes.append(_transform_node(raw))
                    node_ids.add(nid)

        return {"nodes": nodes, "links": links}


def find_circular_trades():
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH path = (a:Taxpayer)-[:TRADES_WITH*2..5]->(a)
            RETURN [n IN nodes(path) | n.gstin] AS cycle,
                   [n IN nodes(path) | n.legal_name] AS names,
                   length(path) AS cycle_length
            ORDER BY cycle_length
            LIMIT 20
            """
        )
        return [
            {
                "cycle": r["cycle"],
                "names": r["names"],
                "cycle_length": r["cycle_length"],
            }
            for r in result
        ]


def get_taxpayer_network(gstin: str):
    """Get the subgraph centered on a specific taxpayer.
    Returns the taxpayer, their connected invoices, and connected trading partners.
    """
    driver = get_driver()
    with driver.session() as session:
        node_ids = set()
        nodes = []
        links = []

        # Get the central taxpayer + all directly connected nodes (depth 1-2)
        result = session.run(
            """
            MATCH (center:Taxpayer {gstin: $gstin})
            OPTIONAL MATCH (center)<-[r1]-(connected)
            OPTIONAL MATCH (center)-[r2]->(connected2)
            WITH center,
                 collect(DISTINCT {node: connected, rel: r1, dir: 'in'}) AS inbound,
                 collect(DISTINCT {node: connected2, rel: r2, dir: 'out'}) AS outbound
            RETURN center, inbound, outbound
            """,
            gstin=gstin,
        )

        for r in result:
            center = r["center"]
            center_id = center.element_id
            center_raw = {"id": center_id, "labels": list(center.labels), "properties": dict(center)}
            if center_id not in node_ids:
                node_ids.add(center_id)
                node_data = _transform_node(center_raw)
                node_data["isCenter"] = True
                nodes.append(node_data)

            for item in r["inbound"]:
                n = item["node"]
                rel = item["rel"]
                if n is None or rel is None:
                    continue
                nid = n.element_id
                if nid not in node_ids:
                    node_ids.add(nid)
                    raw = {"id": nid, "labels": list(n.labels), "properties": dict(n)}
                    nodes.append(_transform_node(raw))
                links.append({"source": nid, "target": center_id, "type": rel.type})

            for item in r["outbound"]:
                n = item["node"]
                rel = item["rel"]
                if n is None or rel is None:
                    continue
                nid = n.element_id
                if nid not in node_ids:
                    node_ids.add(nid)
                    raw = {"id": nid, "labels": list(n.labels), "properties": dict(n)}
                    nodes.append(_transform_node(raw))
                links.append({"source": center_id, "target": nid, "type": rel.type})

        # Get edges between the connected nodes (not just to center)
        if len(node_ids) > 1:
            edge_result = session.run(
                """
                MATCH (n)-[r]->(m)
                WHERE elementId(n) IN $ids AND elementId(m) IN $ids
                RETURN elementId(n) AS source, elementId(m) AS target, type(r) AS type
                """,
                ids=list(node_ids),
            )
            seen_edges = set((l["source"], l["target"], l["type"]) for l in links)
            for er in edge_result:
                key = (er["source"], er["target"], er["type"])
                if key not in seen_edges:
                    links.append({"source": er["source"], "target": er["target"], "type": er["type"]})
                    seen_edges.add(key)

        return {"nodes": nodes, "links": links}
