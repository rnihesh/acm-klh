"""PDF report generation using Jinja2 templates and xhtml2pdf."""

import io
import logging
import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)

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
    html = _render_html(return_period, mismatches, audit_trails, risky_vendors)

    from xhtml2pdf import pisa

    buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(io.StringIO(html), dest=buffer)
    pdf_bytes = buffer.getvalue()

    if pisa_status.err:
        logger.error("xhtml2pdf reported %d error(s) during PDF generation", pisa_status.err)

    # Verify we actually got a PDF
    if pdf_bytes and pdf_bytes[:5] == b"%PDF-":
        return pdf_bytes

    logger.error("PDF generation produced invalid output, returning HTML fallback")
    raise RuntimeError("PDF generation failed")


def generate_html_report(
    return_period: str,
    mismatches: list[dict],
    audit_trails: list[dict] | None = None,
    risky_vendors: list[dict] | None = None,
) -> str:
    """Generate an HTML reconciliation report string."""
    return _render_html(return_period, mismatches, audit_trails, risky_vendors)


def _render_html(
    return_period: str,
    mismatches: list[dict],
    audit_trails: list[dict] | None = None,
    risky_vendors: list[dict] | None = None,
) -> str:
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
