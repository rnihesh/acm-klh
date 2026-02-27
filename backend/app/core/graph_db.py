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


def get_graph_data(limit: int = 200):
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (n)
            WITH n LIMIT $limit
            OPTIONAL MATCH (n)-[r]->(m)
            RETURN
                collect(DISTINCT {
                    id: elementId(n),
                    labels: labels(n),
                    properties: properties(n)
                }) AS nodes,
                collect(DISTINCT {
                    source: elementId(n),
                    target: elementId(m),
                    type: type(r),
                    properties: properties(r)
                }) AS edges
            """,
            limit=limit,
        )
        record = result.single()
        if record:
            return {
                "nodes": record["nodes"],
                "edges": [e for e in record["edges"] if e["target"] is not None],
            }
        return {"nodes": [], "edges": []}


def search_graph(query: str):
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (n)
            WHERE n.gstin CONTAINS $query
               OR n.legal_name CONTAINS $query
               OR n.invoice_number CONTAINS $query
            RETURN n, labels(n) AS labels, properties(n) AS props
            LIMIT 50
            """,
            query=query,
        )
        return [{"labels": r["labels"], "properties": r["props"]} for r in result]


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
