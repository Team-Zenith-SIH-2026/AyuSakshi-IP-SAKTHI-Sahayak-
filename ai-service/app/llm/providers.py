"""
Shared LLM provider chain.

One place that knows how to reach Groq, OpenAI and Ollama, so the RAG
orchestrator and the translation service do not each carry their own copy.

Every call reports which provider actually answered. Nothing here falls back
silently: if no provider responds, the caller is told so and decides what to do.
"""

import asyncio
import logging
import re
from typing import Optional, Tuple

import httpx

from app.config import settings

log = logging.getLogger("ayusakshi.llm")


async def _call_groq(system_prompt: str, user_prompt: str, timeout: float = 45.0) -> Optional[str]:
    """
    Groq chat completion with retry on 429.

    The free tier caps tokens per minute and a batch run trips it easily. Groq
    reports how long to wait, usually under three seconds, so a short backoff
    turns a spurious failure into a normal response rather than a silent
    fallthrough to a lesser provider.
    """
    if not settings.GROQ_API_KEY:
        return None

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(4):
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers, json=payload,
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"]

            if resp.status_code == 429:
                wait = 2.0 * (attempt + 1)
                retry_after = resp.headers.get("retry-after")
                if retry_after:
                    try:
                        wait = min(float(retry_after) + 0.5, 20.0)
                    except ValueError:
                        pass
                else:
                    m = re.search(r'try again in ([0-9.]+)(ms|s)', resp.text)
                    if m:
                        secs = float(m.group(1)) / (1000.0 if m.group(2) == "ms" else 1.0)
                        wait = min(secs + 0.5, 20.0)
                log.warning("[LLM groq] rate limited, retrying in %.2fs (attempt %d/4)", wait, attempt + 1)
                await asyncio.sleep(wait)
                continue

            log.error("[LLM groq] HTTP %s: %s", resp.status_code, resp.text[:300])
            return None

    log.error("[LLM groq] exhausted retries against rate limit")
    return None


async def _call_openai(system_prompt: str, user_prompt: str, timeout: float = 45.0) -> Optional[str]:
    key = settings.OPENAI_API_KEY
    if not key or key.startswith("mock") or key.startswith("your_"):
        return None
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": settings.OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.2,
            },
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
        log.error("[LLM openai] HTTP %s: %s", resp.status_code, resp.text[:300])
        return None


async def _call_ollama(system_prompt: str, user_prompt: str, timeout: float = 120.0) -> Optional[str]:
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat",
            json={
                "model": settings.OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
                "options": {"temperature": 0.2},
            },
        )
        if resp.status_code == 200:
            return resp.json().get("message", {}).get("content")
        log.error("[LLM ollama] HTTP %s: %s", resp.status_code, resp.text[:300])
        return None


_CALLERS = {"groq": _call_groq, "openai": _call_openai, "ollama": _call_ollama}


async def call_llm(system_prompt: str, user_prompt: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Try the configured provider first, then the others.

    Returns (text, provider_name), or (None, None) when no provider responded.
    """
    order = [settings.LLM_PROVIDER] + [p for p in ("groq", "openai", "ollama") if p != settings.LLM_PROVIDER]

    for provider in order:
        caller = _CALLERS.get(provider)
        if not caller:
            continue
        try:
            text = await caller(system_prompt, user_prompt)
            if text and text.strip():
                log.info("[LLM OK] provider=%s (%d chars)", provider, len(text))
                return text, provider
            log.warning("[LLM SKIP] provider=%s unavailable or returned nothing", provider)
        except Exception as e:
            log.warning("[LLM FAIL] provider=%s error=%s", provider, e)

    log.error("[LLM] No provider responded.")
    return None, None
