"""
Chat API — RAG-powered GST assistant that uses the logged-in user's
GSTIN to pull contextual data from Neo4j before querying the LLM.
"""

import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.core.auth import get_current_user
from app.core.llm_chain import generate_text
from app.core.chat_context import build_user_context, get_smart_suggestions

router = APIRouter()

# In-memory conversation store (hackathon scope)
_conversations: dict[str, list[dict]] = {}


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
- Keep responses concise but thorough (200-400 words)
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

    # Build user context from Neo4j + in-memory stores
    context = build_user_context(gstin)

    # Build system prompt with context
    system_prompt = CHAT_SYSTEM_PROMPT.format(context=context)

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
