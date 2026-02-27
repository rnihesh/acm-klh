"""
Chat API — RAG-powered GST assistant that uses the logged-in user's
GSTIN to pull contextual data from Neo4j before querying the LLM.
"""

import re
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.core.auth import get_current_user
from app.core.llm_chain import generate_text
from app.core.chat_context import build_user_context, build_hybrid_context, get_smart_suggestions

router = APIRouter()

# In-memory conversation store (hackathon scope)
_conversations: dict[str, list[dict]] = {}

# GST-specific keywords for prompt classification
_GST_KEYWORDS = re.compile(
    r'\b(gst|gstin|gstr|itc|invoice|tax|hsn|sac|reconcil|mismatch|vendor|supplier|buyer|'
    r'filing|return|credit|debit|cgst|sgst|igst|cess|turnover|compliance|audit|risk|circular|'
    r'e-way|eway|input|output|inward|outward|period|assessment|notice|penalty|refund|'
    r'fraudulent|duplicate|excess|missing|rate|value|amount|claim)\b',
    re.IGNORECASE
)


def _classify_prompt(message: str) -> str:
    """Classify prompt complexity to determine response length."""
    words = message.split()
    word_count = len(words)
    gst_matches = len(_GST_KEYWORDS.findall(message))

    # Greetings and very short messages
    if word_count <= 5 and gst_matches == 0:
        return "brief"
    # Medium: short GST questions or moderate length
    if word_count <= 25 or (word_count <= 15 and gst_matches <= 2):
        return "concise"
    # Complex: long questions, analysis requests, multiple GST terms
    return "detailed"


def _get_length_instruction(complexity: str) -> str:
    """Return appropriate response length instruction."""
    if complexity == "brief":
        return "Reply in 1-3 sentences. Be friendly, brief, and natural. Do NOT over-explain."
    elif complexity == "concise":
        return "Reply in 50-150 words. Be concise and focused. Use bullet points for clarity."
    else:
        return "Reply in 200-400 words. Be thorough with specific data references, use headers and bullet points."


CHAT_SYSTEM_PROMPT = """You are an expert GST (Goods & Services Tax) assistant for the Indian taxation system.
You have deep knowledge of GSTR-1 (outward supplies), GSTR-2B (auto-drafted inward supplies),
GSTR-3B (summary return), Input Tax Credit (ITC), HSN codes, and GST compliance.

You are helping a specific taxpayer with their GST reconciliation data.
Below is their current data context from the system's Knowledge Graph:

{context}

IMPORTANT GUIDELINES:
- Answer specifically based on the user's data when possible
- Reference specific GSTINs, invoice numbers, and amounts from the context
- Explain technical GST concepts in simple terms
- When recommending actions, be specific and actionable
- Format responses using Markdown (headers, bullet points, bold for emphasis)
- If the data doesn't contain relevant info, explain what general GST best practice suggests
- {length_instruction}
- Use ₹ symbol for Indian Rupee amounts"""


class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str


@router.post("/message", response_model=ChatResponse)
async def send_message(
    body: ChatMessage,
    current_user: dict = Depends(get_current_user),
):
    gstin = current_user.get("gstin", "")
    conv_id = body.conversation_id or str(uuid.uuid4())

    # Initialise conversation history if new
    if conv_id not in _conversations:
        _conversations[conv_id] = []

    # Build user context from Neo4j + embeddings (hybrid RAG)
    try:
        context = await build_hybrid_context(gstin, body.message)
    except Exception:
        context = build_user_context(gstin)

    # Classify prompt complexity for dynamic response length
    complexity = _classify_prompt(body.message)
    length_instruction = _get_length_instruction(complexity)

    # Build system prompt with context and dynamic length
    system_prompt = CHAT_SYSTEM_PROMPT.format(context=context, length_instruction=length_instruction)

    # Build conversation-aware prompt
    history = _conversations[conv_id]
    history_text = ""
    if history:
        recent = history[-6:]  # last 3 exchanges
        parts = []
        for msg in recent:
            role = "User" if msg["role"] == "user" else "Assistant"
            parts.append(f"{role}: {msg['content']}")
        history_text = "\n".join(parts) + "\n\n"

    prompt = f"{history_text}User: {body.message}\n\nAssistant:"

    # Call LLM via existing fallback chain
    response = await generate_text(prompt, system_prompt)

    # Store conversation history
    _conversations[conv_id].append({"role": "user", "content": body.message})
    _conversations[conv_id].append({"role": "assistant", "content": response})

    # Cap history length
    if len(_conversations[conv_id]) > 20:
        _conversations[conv_id] = _conversations[conv_id][-12:]

    return ChatResponse(response=response, conversation_id=conv_id)


@router.get("/suggestions")
async def chat_suggestions(
    current_user: dict = Depends(get_current_user),
):
    gstin = current_user.get("gstin", "")
    suggestions = get_smart_suggestions(gstin)
    return {"suggestions": suggestions}
