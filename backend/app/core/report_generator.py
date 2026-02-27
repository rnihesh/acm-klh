"""PDF report generation using Jinja2 templates and WeasyPrint."""

import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


def _get_env() -> Environment:
    return Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=True)


def generate_reconciliation_report(
    return_period: str,
    mismatches: list[dict],
    audit_trails: list[dict] | None = None,
    risky_vendors: list[dict] | None = None,
) -> bytes:
    """Generate a PDF reconciliation report. Returns PDF bytes."""
    env = _get_env()
    template = env.get_template("audit_report.html")

    # Compute summary stats
    total_itc_at_risk = sum(m.get("amount_difference", 0) for m in mismatches)
    critical_count = sum(1 for m in mismatches if m.get("severity") == "CRITICAL")
    high_risk_vendors = len([v for v in (risky_vendors or []) if v.get("risk_level") in ("HIGH", "CRITICAL")])

    # Breakdown by type
    breakdown_map: dict[str, dict] = {}
    for m in mismatches:
        mt = m.get("mismatch_type", "UNKNOWN")
        if mt not in breakdown_map:
            breakdown_map[mt] = {"type": mt, "count": 0, "amount": 0.0}
        breakdown_map[mt]["count"] += 1
        breakdown_map[mt]["amount"] += m.get("amount_difference", 0)
    breakdown = sorted(breakdown_map.values(), key=lambda x: x["count"], reverse=True)

    html = template.render(
        return_period=return_period,
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        total_mismatches=len(mismatches),
        total_itc_at_risk=f"{total_itc_at_risk:,.2f}",
        critical_count=critical_count,
        high_risk_vendors=high_risk_vendors,
        breakdown=breakdown,
        mismatches=mismatches,
        audit_trails=audit_trails or [],
        risky_vendors=[v for v in (risky_vendors or []) if v.get("risk_level") in ("HIGH", "CRITICAL")],
    )

    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
        return pdf_bytes
    except ImportError:
        # WeasyPrint not installed — return HTML as fallback
        return html.encode("utf-8")


def generate_html_report(
    return_period: str,
    mismatches: list[dict],
    audit_trails: list[dict] | None = None,
    risky_vendors: list[dict] | None = None,
) -> str:
    """Generate an HTML reconciliation report string."""
    env = _get_env()
    template = env.get_template("audit_report.html")

    total_itc_at_risk = sum(m.get("amount_difference", 0) for m in mismatches)
    critical_count = sum(1 for m in mismatches if m.get("severity") == "CRITICAL")
    high_risk_vendors_count = len([v for v in (risky_vendors or []) if v.get("risk_level") in ("HIGH", "CRITICAL")])

    breakdown_map: dict[str, dict] = {}
    for m in mismatches:
        mt = m.get("mismatch_type", "UNKNOWN")
        if mt not in breakdown_map:
            breakdown_map[mt] = {"type": mt, "count": 0, "amount": 0.0}
        breakdown_map[mt]["count"] += 1
        breakdown_map[mt]["amount"] += m.get("amount_difference", 0)
    breakdown = sorted(breakdown_map.values(), key=lambda x: x["count"], reverse=True)

    return template.render(
        return_period=return_period,
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        total_mismatches=len(mismatches),
        total_itc_at_risk=f"{total_itc_at_risk:,.2f}",
        critical_count=critical_count,
        high_risk_vendors=high_risk_vendors_count,
        breakdown=breakdown,
        mismatches=mismatches,
        audit_trails=audit_trails or [],
        risky_vendors=[v for v in (risky_vendors or []) if v.get("risk_level") in ("HIGH", "CRITICAL")],
    )
