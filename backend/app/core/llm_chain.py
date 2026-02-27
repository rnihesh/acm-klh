import os
from app.config import get_settings


async def generate_text(prompt: str, system_prompt: str = "") -> str:
    settings = get_settings()
    providers = settings.llm_priority.split(",")

    for provider in providers:
        provider = provider.strip()
        try:
            if provider == "openai" and settings.openai_api_key:
                return await _call_openai(prompt, system_prompt, settings.openai_api_key)
            elif provider == "gemini" and settings.gemini_api_key:
                return await _call_gemini(prompt, system_prompt, settings.gemini_api_key)
            elif provider == "ollama":
                return await _call_ollama(prompt, system_prompt, settings.ollama_url)
        except Exception as e:
            print(f"LLM provider {provider} failed: {e}")
            continue

    return "Unable to generate explanation — no LLM provider available."


async def _call_openai(prompt: str, system_prompt: str, api_key: str) -> str:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.3,
        max_tokens=1000,
    )
    return response.choices[0].message.content


async def _call_gemini(prompt: str, system_prompt: str, api_key: str) -> str:
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    response = model.generate_content(full_prompt)
    return response.text


async def _call_ollama(prompt: str, system_prompt: str, ollama_url: str) -> str:
    import httpx

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{ollama_url}/api/chat",
            json={"model": "llama3.1", "messages": messages, "stream": False},
        )
        response.raise_for_status()
        return response.json()["message"]["content"]


AUDIT_SYSTEM_PROMPT = """You are an expert GST audit assistant for the Indian tax system.
You explain GST reconciliation mismatches in clear, professional business language.
Always reference specific GSTIN numbers, invoice numbers, and amounts.
Explain why the mismatch matters for ITC (Input Tax Credit) claims.
Recommend specific corrective actions.
Format your response with sections: Summary, Impact, Root Cause Analysis, Recommended Action."""


async def generate_audit_explanation(mismatch: dict) -> str:
    prompt = f"""Analyze this GST reconciliation mismatch and provide an audit explanation:

Mismatch Type: {mismatch.get('mismatch_type')}
Severity: {mismatch.get('severity')}
Supplier GSTIN: {mismatch.get('supplier_gstin')}
Buyer GSTIN: {mismatch.get('buyer_gstin')}
Invoice Number: {mismatch.get('invoice_number')}
Return Period: {mismatch.get('return_period')}
Field: {mismatch.get('field_name', 'N/A')}
Expected Value: {mismatch.get('expected_value', 'N/A')}
Actual Value: {mismatch.get('actual_value', 'N/A')}
Amount Difference: INR {mismatch.get('amount_difference', 0)}

Provide a clear audit trail explanation."""

    return await generate_text(prompt, AUDIT_SYSTEM_PROMPT)


RISK_SYSTEM_PROMPT = """You are a GST compliance risk analyst.
Analyze vendor risk factors and provide a concise risk assessment.
Reference specific data points and explain what each risk indicator means.
Format: Risk Summary, Key Concerns, Compliance Recommendation."""


async def generate_risk_summary(vendor: dict) -> str:
    prompt = f"""Assess the compliance risk for this GST vendor:

GSTIN: {vendor.get('gstin')}
Legal Name: {vendor.get('legal_name')}
Risk Score: {vendor.get('risk_score')}/100
Filing Rate: {vendor.get('filing_rate')}%
Mismatch Count: {vendor.get('mismatch_count')} out of {vendor.get('total_invoices')} invoices
Circular Trading Flag: {vendor.get('circular_trade_flag')}
Risk Factors: {', '.join(vendor.get('risk_factors', []))}

Provide a risk assessment."""

    return await generate_text(prompt, RISK_SYSTEM_PROMPT)
