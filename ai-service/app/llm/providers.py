"""
Shared LLM provider chain.

One place that knows how to reach Groq, Ollama and OpenAI, so the RAG
orchestrator and the translation service do not each carry their own copy.

Order of preference:
  1. Groq, GROQ_MODEL, every configured key in turn.
  2. Groq, each model in GROQ_MODEL_FALLBACKS, again every key in turn. Groq
     counts free-tier quota per organization and per model, not per key, so
     changing model is what escapes an exhausted daily budget; a further key
     only helps when it belongs to a different account.
  3. A local model through Ollama (DeepSeek by default). The system still
     answers with the internet or every hosted model gone, and nothing leaves
     the machine. It is slow on a laptop CPU, roughly three minutes cold.
  4. OpenAI, only when a real key is configured.

Every call reports which provider actually answered. Nothing here falls back
silently: if no provider responds, the caller is told so and decides what to do.
"""

import asyncio
import logging
import re
from typing import List, Optional, Tuple

import httpx

from app.config import settings

log = logging.getLogger("ayusakshi.llm")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Reasoning models write their working inside <think> tags ahead of the answer,
# the local DeepSeek distill and Qwen on Groq alike. See _strip_reasoning below.
_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)

Result = Tuple[Optional[str], Optional[str]]


def _strip_reasoning(text: Optional[str]) -> str:
    """
    The answer with any reasoning block removed.

    Both the local DeepSeek distill and Qwen on Groq write their reasoning in
    <think> tags ahead of the answer. Left in, it reads to the user as the
    response, and the citation verifier would treat every provision the model
    merely considered as one it cited.
    """
    text = _THINK_BLOCK.sub("", text or "")
    if "</think>" in text:  # the response began inside a reasoning block
        text = text.split("</think>", 1)[1]
    if "<think>" in text:   # a block that never closed is not an answer
        text = text.split("<think>", 1)[0]
    return text.strip()


def _usable(key: Optional[str]) -> bool:
    key = (key or "").strip()
    return bool(key) and not key.startswith(("your_", "mock"))


def _groq_keys() -> List[Tuple[str, str]]:
    """(label, key) for each configured Groq key, primary first, duplicates dropped."""
    keys, seen = [], set()
    candidates = (
        ("primary", settings.GROQ_API_KEY),
        ("secondary", settings.GROQ_API_KEY_2),
        ("third", settings.GROQ_API_KEY_3),
        ("fourth", settings.GROQ_API_KEY_4),
    )
    for label, key in candidates:
        key = (key or "").strip()
        if _usable(key) and key not in seen:
            keys.append((label, key))
            seen.add(key)
    return keys


def _groq_models() -> List[str]:
    """The configured model first, then each fallback, duplicates dropped."""
    models, seen = [], set()
    for model in [settings.GROQ_MODEL] + settings.GROQ_MODEL_FALLBACKS.split(","):
        model = model.strip()
        if model and model not in seen:
            models.append(model)
            seen.add(model)
    return models


def _retry_wait(resp: httpx.Response, attempt: int) -> float:
    """How long Groq asks us to wait after a 429, in seconds."""
    retry_after = resp.headers.get("retry-after")
    if retry_after:
        try:
            return float(retry_after) + 0.5
        except ValueError:
            pass
    m = re.search(r"try again in ([0-9.]+)(ms|s)", resp.text)
    if m:
        return float(m.group(1)) / (1000.0 if m.group(2) == "ms" else 1.0) + 0.5
    return 2.0 * (attempt + 1)


async def _call_groq(
    system_prompt: str,
    user_prompt: str,
    timeout: float = 45.0,
    max_tokens: Optional[int] = None,
    budget_seconds: Optional[float] = None,
    reasoning_effort: Optional[str] = None,
) -> Result:
    """
    Groq chat completion across the configured models and keys, under one budget.

    Quota is counted per organization and per model, so the attempts run model
    by model, every key offered the current model before the next model starts.
    An exhausted daily budget is escaped by the change of model; a key from a
    different account is what a rejected or throttled key is escaped by.

    A rate limit moves straight to the next attempt instead of sleeping. Only
    the final attempt backs off and retries, and only while the shared budget
    can absorb the wait, so a rate-limited request reaches the local model fast.

    max_tokens, budget_seconds and reasoning_effort override the defaults for
    short calls such as deciding how to handle a chat message.
    """
    keys = _groq_keys()
    models = _groq_models()
    if not keys or not models:
        return None, None

    budget = budget_seconds or settings.LLM_TOTAL_BUDGET_SECONDS
    loop = asyncio.get_event_loop()
    deadline = loop.time() + budget
    attempts = [(model, label, key) for model in models for label, key in keys]
    dead_keys = set()    # rejected outright: no model will accept them
    dead_models = set()  # unknown or withdrawn: no key will serve them

    async with httpx.AsyncClient() as client:
        for idx, (model, label, key) in enumerate(attempts):
            if key in dead_keys or model in dead_models:
                continue
            has_next = any(m not in dead_models and k not in dead_keys
                           for m, _, k in attempts[idx + 1:])
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": settings.LLM_TEMPERATURE,
                "max_tokens": max_tokens or settings.LLM_MAX_TOKENS,
            }
            # Only the gpt-oss models take this; another model would reject it.
            if reasoning_effort and model.startswith("openai/gpt-oss"):
                payload["reasoning_effort"] = reasoning_effort
            for attempt in range(4):
                remaining = deadline - loop.time()
                if remaining <= 1:
                    log.error("[LLM groq] %.0fs budget spent; moving on.", budget)
                    return None, None
                try:
                    resp = await client.post(GROQ_URL, headers=headers, json=payload,
                                             timeout=min(timeout, remaining))
                except httpx.HTTPError as e:
                    log.warning("[LLM groq:%s:%s] request failed: %r", label, model, e)
                    break  # network trouble: try the next attempt

                if resp.status_code == 200:
                    answer = _strip_reasoning(resp.json()["choices"][0]["message"]["content"])
                    if answer:
                        return answer, f"groq:{label}:{model}"
                    # Nothing but reasoning, or the reply spent its whole token
                    # allowance thinking. Either way there is no answer here.
                    log.warning("[LLM groq:%s:%s] empty answer; trying the next model or key.",
                                label, model)
                    break

                if resp.status_code == 429:
                    wait = _retry_wait(resp, attempt)
                    if has_next:
                        log.warning("[LLM groq:%s:%s] rate limited (asked to wait %.1fs); "
                                    "trying the next model or key.", label, model, wait)
                        break
                    if wait > deadline - loop.time():
                        log.error("[LLM groq:%s:%s] rate limited and the budget cannot absorb a %.1fs wait.",
                                  label, model, wait)
                        return None, None
                    log.warning("[LLM groq:%s:%s] rate limited, retrying in %.2fs (attempt %d/4).",
                                label, model, wait, attempt + 1)
                    await asyncio.sleep(wait)
                    continue

                if resp.status_code in (401, 403):
                    # The key itself is refused, so no other model will take it.
                    log.error("[LLM groq:%s] key rejected (HTTP %s); skipping it for this request.",
                              label, resp.status_code)
                    dead_keys.add(key)
                    break

                if resp.status_code in (400, 404) and "model" in resp.text.lower():
                    # Withdrawn or misspelt model: no key will serve it either.
                    log.error("[LLM groq:%s] model unavailable (HTTP %s): %s",
                              model, resp.status_code, resp.text[:200])
                    dead_models.add(model)
                    break

                log.error("[LLM groq:%s:%s] HTTP %s: %s", label, model, resp.status_code, resp.text[:200])
                break

    log.error("[LLM groq] no model or key could answer.")
    return None, None


async def _call_ollama(system_prompt: str, user_prompt: str) -> Result:
    """
    Local model through Ollama. Slow on a laptop CPU, so it has its own longer
    timeout and a shorter maximum answer than the hosted models.
    """
    body = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        # Skip the reasoning pass where the model supports it: on CPU every
        # hidden reasoning token is time the user spends waiting.
        "think": False,
        # Loading the model costs about 20s. Keep it resident between questions.
        "keep_alive": "30m",
        "options": {
            "temperature": settings.LLM_TEMPERATURE,
            "num_predict": settings.OLLAMA_MAX_TOKENS,
            # Without this Ollama sizes the context from free memory; this 7B
            # model took 9.3 GB of a 16 GB laptop. The lean prompt fits in 4096.
            "num_ctx": settings.OLLAMA_NUM_CTX,
        },
    }
    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
        resp = await client.post(url, json=body)
        if resp.status_code == 400 and "think" in resp.text.lower():
            # Older Ollama, or a model without the thinking switch: ask without it.
            body.pop("think")
            resp = await client.post(url, json=body)
        if resp.status_code != 200:
            log.error("[LLM ollama] HTTP %s: %s", resp.status_code, resp.text[:300])
            return None, None
        text = resp.json().get("message", {}).get("content") or ""

    text = _strip_reasoning(text)
    return (text, f"ollama:{settings.OLLAMA_MODEL}") if text else (None, None)


async def _call_openai(system_prompt: str, user_prompt: str, timeout: float = 45.0) -> Result:
    if not _usable(settings.OPENAI_API_KEY):
        return None, None
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": settings.OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": settings.LLM_TEMPERATURE,
                "max_tokens": settings.LLM_MAX_TOKENS,
            },
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"], "openai"
        log.error("[LLM openai] HTTP %s: %s", resp.status_code, resp.text[:300])
        return None, None


_CALLERS = {"groq": _call_groq, "ollama": _call_ollama, "openai": _call_openai}
_FALLBACK_ORDER = ("groq", "ollama", "openai")


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    local_user_prompt: Optional[str] = None,
    local_system_prompt: Optional[str] = None,
    providers: Optional[Tuple[str, ...]] = None,
    max_tokens: Optional[int] = None,
    budget_seconds: Optional[float] = None,
    reasoning_effort: Optional[str] = None,
) -> Result:
    """
    Try the configured provider first, then the rest in fallback order.

    Returns (text, provider_name), or (None, None) when no provider responded.
    provider_name says exactly what answered, e.g. "groq:primary:openai/gpt-oss-20b"
    or "ollama:deepseek-nothink:latest".

    local_user_prompt, when given, is what the local model receives instead of
    user_prompt: a leaner version it can read within its timeout.
    local_system_prompt likewise replaces system_prompt for the local model.

    providers limits which providers are tried. A call that has to be quick
    passes ("groq",): the local model takes minutes on a laptop CPU.
    max_tokens, budget_seconds and reasoning_effort apply to Groq only.
    """
    order = [settings.LLM_PROVIDER] + [p for p in _FALLBACK_ORDER if p != settings.LLM_PROVIDER]
    if providers:
        order = [p for p in order if p in providers]

    for provider in order:
        caller = _CALLERS.get(provider)
        if not caller:
            continue
        try:
            local = provider == "ollama"
            sys_p = local_system_prompt if (local and local_system_prompt) else system_prompt
            usr_p = local_user_prompt if (local and local_user_prompt) else user_prompt
            if provider == "groq":
                text, name = await caller(
                    sys_p, usr_p, max_tokens=max_tokens,
                    budget_seconds=budget_seconds, reasoning_effort=reasoning_effort,
                )
            else:
                text, name = await caller(sys_p, usr_p)
        except Exception as e:
            log.warning("[LLM FAIL] provider=%s error=%r", provider, e)
            continue
        if text and text.strip():
            log.info("[LLM OK] provider=%s (%d chars)", name, len(text))
            return text, name
        log.warning("[LLM SKIP] provider=%s unavailable or returned nothing", provider)

    log.error("[LLM] No provider responded.")
    return None, None
