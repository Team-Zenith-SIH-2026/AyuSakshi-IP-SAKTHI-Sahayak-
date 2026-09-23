import os
import re
import time
import hashlib
import httpx
from typing import Dict, Any, List, Optional, Tuple
from app.config import settings
from app.llm.providers import call_llm

# A capitalised word that can be part of a law's name.
_NAME_WORD = (
    r"(?!(?:The|A|An|Under|According|As|Per|By|In|If|Yes|No|Both|Also|Only|When|For|From|With|Before|After|See|"
    r"This|That|These|Those|Your|You|It|Unlike|Like|Since|Because)\b)[A-Z][\w'’-]*"
)

class BhashiniService:
    """
    Bhashini / ULCA Neural Machine Translation client for Indian Languages.
    Preserves exact statutory citations (e.g., 'Section 3(p)', 'Rule 157', 'Form A') during translation.
    Features:
      - 2-step ULCA Pipeline Discovery & Inference with auto Pipeline ID (64392f96daac500b55c543cd)
      - Direct Dhruva inference when the key is an inference key that the ULCA config endpoint does not know
      - In-memory config caching to minimize API calls (at most 1 config call per language pair)
      - Translation response cache to prevent redundant quota usage
      - Circuit breaker / cooldown if quota limit (429/401/403) is encountered, seamlessly falling back to LLM translation
    """

    BHASHINI_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
    BHASHINI_DEFAULT_INFERENCE_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
    DEFAULT_PIPELINE_ID = "64392f96daac500b55c543cd"
    # IndicTrans2 on Dhruva: the model the config endpoint hands out for translation.
    DEFAULT_SERVICE_ID = "ai4bharat/indictrans-v2-all-gpu--t4"

    # Bhashini's language codes where they differ from ours.
    BHASHINI_CODES = {"kok": "gom"}

    # Scripts shared by more than one language we offer. The script says
    # Devanagari; the language the user picked says whether it is Marathi.
    SCRIPT_FAMILIES = {"hi": {"hi", "mr", "sa", "ne", "mai", "kok"}, "bn": {"bn", "as"}, "ur": {"ur", "sd"}}

    # What must come back from machine translation exactly as it went in.
    # IndicTrans2 renders "Section 3(p)" as "धारा 3 (पी)", which can no longer
    # be checked against the Act. These spans are swapped for {0}, {1}, ...
    # before translation (a marker it was seen to keep intact) and put back
    # afterwards; if any marker does not come back, the LLM translation, which
    # is told to keep citations, is used instead.
    _PROTECTED = re.compile(
        r"https?://\S+"
        r"|\b(?:Sections?|Sec\.|Rules?|Articles?|Regulations?|Clauses?|Sub-sections?|Chapters?|Schedules?|Forms?)"
        r"\s+(?:\d+[A-Z]*|[IVXL]+|[A-Z]{1,2})(?!\w)(?:\s*\([0-9A-Za-z]{1,4}\))*"
        r"|\b(?:First|Second|Third|Fourth|Fifth|Sixth)\s+Schedule\b"
        r"|\b\d+[A-Z]*(?:\([0-9A-Za-z]{1,4}\))+"
        # A law's name, but not the word that introduces it ("Under the ..."),
        # and not a bare "the Act".
        rf"|{_NAME_WORD}\s+(?:(?:{_NAME_WORD}|and|of|&|\([A-Z][\w'’-]*|[\w'’-]*\))\s+){{0,7}}"
        r"(?:Act|Rules|Regulations|Protocol|Treaty|Convention|Agreement)\b(?:,?\s+(?:18|19|20)\d\d)?"
        r"|\b(?:National Biodiversity Authority|State Biodiversity Boards?|Biodiversity Management Committees?"
        r"|Controller General of Patents, Designs and Trade Marks|Central Drugs Standard Control Organi[sz]ation"
        r"|Food Safety and Standards Authority of India|Geographical Indications Registry|Ministry of Ayush)\b"
        r"|\b(?:NBA|SBB|BMC|CDSCO|FSSAI|AYUSH|TKDL|WIPO|WTO|TRIPS|PCT|GI|IPR|ABS|PIC|MAT|ASU)\b"
    )
    _PLACEHOLDER = re.compile(r"\{\s*(\d+)\s*\}")
    _MD_PREFIX = re.compile(r"^(\s*(?:#{1,6}\s+|[-*•]\s+|\d+[.)]\s+|>\s*)*)(.*)$")
    _SENTENCE_END = re.compile(r"(?<=[.!?।॥])\s+(?=[A-Z{\"'(\[]|[^\x00-\x7F])")

    # Supported Indian Languages (18 verified languages)
    SUPPORTED_LANGUAGES = {
        "en": "English",
        "hi": "Hindi",
        "sa": "Sanskrit",
        "ta": "Tamil",
        "te": "Telugu",
        "kn": "Kannada",
        "ml": "Malayalam",
        "mr": "Marathi",
        "bn": "Bengali",
        "gu": "Gujarati",
        "pa": "Punjabi",
        "or": "Odia",
        "as": "Assamese",
        "ur": "Urdu",
        "mai": "Maithili",
        "ne": "Nepali",
        "sd": "Sindhi",
        "kok": "Konkani",
    }

    # Precise script guidance for AI neural translation
    LANGUAGE_SCRIPTS = {
        "as": "Assamese (using authentic Eastern Nagari / Assamese script: অসমীয়া)",
        "ne": "Nepali (using Devanagari script: नेपाली)",
        "kok": "Konkani (using Goan Konkani Devanagari script: कोंकणी)",
        "sd": "Sindhi (using authentic Perso-Arabic Sindhi script: سنڌي)",
        "mai": "Maithili (using Devanagari script: मैथिली)",
        "ml": "Malayalam (using Malayalam script: മലയാളം)",
        "bn": "Bengali (using Bengali script: বাংলা)",
        "ta": "Tamil (using Tamil script: தமிழ்)",
        "te": "Telugu (using Telugu script: తెలుగు)",
        "kn": "Kannada (using Kannada script: ಕನ್ನಡ)",
        "mr": "Marathi (using Marathi Devanagari script: मराठी)",
        "gu": "Gujarati (using Gujarati script: ગુજરાતી)",
        "pa": "Punjabi (using Gurmukhi script: ਪੰਜਾਬੀ)",
        "or": "Odia (using Odia script: ଓଡ଼ିଆ)",
        "sa": "Sanskrit (using Devanagari script: संस्कृतम्)",
        "ur": "Urdu (using Urdu Nastaliq / Perso-Arabic script: اردو)",
        "hi": "Hindi (using Hindi Devanagari script: हिन्दी)",
        "en": "English",
    }

    # In-memory caches to minimize Bhashini API calls (strict quota preservation)
    _pipeline_cache: Dict[str, Dict[str, Any]] = {}
    _translation_cache: Dict[str, str] = {}
    _throttle_until: float = 0.0
    _direct_until: float = 0.0

    @classmethod
    def detect_language(cls, text: str, preferred: Optional[str] = None) -> str:
        """
        Detects primary script or language of input text.

        Several languages share a script, so the script alone reads Marathi as
        Hindi. When the language the user picked is written in the detected
        script, that language is the answer.
        """
        if not text:
            return "en"

        # Devanagari script range (Hindi / Sanskrit / Marathi)
        devanagari_count = len(re.findall(r'[\u0900-\u097F]', text))
        tamil_count = len(re.findall(r'[\u0B80-\u0BFF]', text))
        telugu_count = len(re.findall(r'[\u0C00-\u0C7F]', text))
        kannada_count = len(re.findall(r'[\u0C80-\u0CFF]', text))
        bengali_count = len(re.findall(r'[\u0980-\u09FF]', text))
        gujarati_count = len(re.findall(r'[\u0A80-\u0AFF]', text))
        malayalam_count = len(re.findall(r'[\u0D00-\u0D7F]', text))
        punjabi_count = len(re.findall(r'[\u0A00-\u0A7F]', text))
        odia_count = len(re.findall(r'[\u0B00-\u0B7F]', text))
        arabic_count = len(re.findall(r'[\u0600-\u06FF]', text))

        counts = {
            "hi": devanagari_count,
            "ta": tamil_count,
            "te": telugu_count,
            "kn": kannada_count,
            "bn": bengali_count,
            "gu": gujarati_count,
            "ml": malayalam_count,
            "pa": punjabi_count,
            "or": odia_count,
            "ur": arabic_count,
        }

        max_lang = max(counts, key=counts.get)
        if counts[max_lang] > 3:
            if preferred in cls.SCRIPT_FAMILIES.get(max_lang, ()):
                return preferred
            return max_lang

        return "en"

    @classmethod
    async def _get_pipeline_config(cls, client: httpx.AsyncClient, source_lang: str, target_lang: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves and caches pipeline configuration from Bhashini ULCA config endpoint.
        Uses in-memory cache so only ONE config call is ever made per (source, target) pair.
        """
        pair_key = f"{source_lang}_{target_lang}"
        cached = cls._pipeline_cache.get(pair_key)
        now = time.time()
        if cached and cached.get("expires_at", 0) > now:
            return cached
        if now < cls._direct_until:
            return cls._direct_config(pair_key, now)
        source_lang, target_lang = cls._code(source_lang), cls._code(target_lang)

        pipeline_id = settings.BHASHINI_PIPELINE_ID or cls.DEFAULT_PIPELINE_ID
        if not pipeline_id or pipeline_id == "demo_pipeline_id":
            pipeline_id = cls.DEFAULT_PIPELINE_ID

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AyuSakshi-SIH26045",
            "userID": settings.BHASHINI_USER_ID,
            "ulcaApiKey": settings.BHASHINI_API_KEY
        }

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": source_lang,
                            "targetLanguage": target_lang
                        }
                    }
                }
            ],
            "pipelineRequestConfig": {
                "pipelineId": pipeline_id
            }
        }

        try:
            res = await client.post(cls.BHASHINI_CONFIG_URL, headers=headers, json=payload, timeout=10.0)
            if res.status_code == 200:
                data = res.json()
                pipeline_endpoint = data.get("pipelineInferenceAPIEndPoint", {})
                callback_url = pipeline_endpoint.get("callbackUrl") or cls.BHASHINI_DEFAULT_INFERENCE_URL
                inf_api_key = pipeline_endpoint.get("inferenceApiKey", {})
                auth_header_name = inf_api_key.get("name", "Authorization")
                auth_header_value = inf_api_key.get("value") or settings.BHASHINI_API_KEY

                service_id = None
                for task in data.get("pipelineResponseConfig", []):
                    if task.get("taskType") == "translation":
                        configs = task.get("config", [])
                        if configs:
                            service_id = configs[0].get("serviceId")
                            break

                config_entry = {
                    "callback_url": callback_url,
                    "auth_header_name": auth_header_name,
                    "auth_header_value": auth_header_value,
                    "service_id": service_id,
                    "expires_at": now + 86400  # 24 hours TTL cache
                }
                cls._pipeline_cache[pair_key] = config_entry
                print(f"[Bhashini Service] Pipeline configured for {source_lang}->{target_lang} (serviceId: {service_id})")
                return config_entry
            elif res.status_code in (400, 401, 403, 429):
                # "Error in fetching ulcaApiKey" means the key is an inference
                # key, which the config endpoint does not know but Dhruva
                # accepts. Stop asking for a day and call Dhruva directly.
                print(f"[Bhashini Service] Config endpoint returned status {res.status_code}: {res.text[:200]}. "
                      "Calling the inference endpoint directly.")
                cls._direct_until = now + 86400
                return cls._direct_config(pair_key, now)
            else:
                print(f"[Bhashini Service] Config endpoint warning ({res.status_code}): {res.text[:200]}")
                return cls._direct_config(pair_key, now)
        except Exception as e:
            print(f"[Bhashini Service] Failed to reach Bhashini config endpoint: {e}")
            return cls._direct_config(pair_key, now)

    @classmethod
    def _direct_config(cls, pair_key: str, now: float) -> Dict[str, Any]:
        config_entry = {
            "callback_url": cls.BHASHINI_DEFAULT_INFERENCE_URL,
            "auth_header_name": "Authorization",
            "auth_header_value": settings.BHASHINI_API_KEY,
            "service_id": cls.DEFAULT_SERVICE_ID,
            "expires_at": now + 86400,
        }
        cls._pipeline_cache[pair_key] = config_entry
        return config_entry

    @classmethod
    def _code(cls, lang: str) -> str:
        return cls.BHASHINI_CODES.get(lang, lang)

    @classmethod
    async def translate(cls, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """
        Translates text between Indian languages and English.
        Prioritizes Bhashini NMT with aggressive quota-preservation caching,
        and seamlessly falls back to high-fidelity LLM translation.
        """
        if not text or not text.strip() or source_lang == target_lang:
            return {
                "translated_text": text,
                "source_language": source_lang,
                "target_language": target_lang,
                "provider": "passthrough"
            }

        # Check local translation cache (prevents redundant API calls)
        cache_key = f"{source_lang}_{target_lang}_{hashlib.md5(text.strip().encode('utf-8')).hexdigest()}"
        if cache_key in cls._translation_cache:
            return {
                "translated_text": cls._translation_cache[cache_key],
                "source_language": source_lang,
                "target_language": target_lang,
                "provider": "cache"
            }

        now = time.time()
        # If Bhashini is not enabled or currently in cooldown due to rate limit/quota, use LLM fallback
        if not settings.BHASHINI_ENABLED or not settings.BHASHINI_API_KEY or now < cls._throttle_until:
            fallback_res = await cls._fallback_translate(text, source_lang, target_lang)
            if fallback_res.get("translated_text"):
                if len(cls._translation_cache) > 500:
                    cls._translation_cache.clear()
                cls._translation_cache[cache_key] = fallback_res["translated_text"]
            return fallback_res

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                config = await cls._get_pipeline_config(client, source_lang, target_lang)
                if not config:
                    fallback_res = await cls._fallback_translate(text, source_lang, target_lang)
                    if fallback_res.get("translated_text"):
                        if len(cls._translation_cache) > 500:
                            cls._translation_cache.clear()
                        cls._translation_cache[cache_key] = fallback_res["translated_text"]
                    return fallback_res

                headers = {
                    "User-Agent": "AyuSakshi-SIH26045",
                    "Content-Type": "application/json",
                    config["auth_header_name"]: config["auth_header_value"]
                }

                task_config = {
                    "language": {
                        "sourceLanguage": cls._code(source_lang),
                        "targetLanguage": cls._code(target_lang)
                    }
                }
                if config.get("service_id"):
                    task_config["serviceId"] = config["service_id"]

                prepared = cls._prepare(text)
                if prepared is None:
                    raise ValueError("text already contains {n} markers; cannot protect its citations")
                lines, sources = prepared
                if not sources:
                    return {"translated_text": text, "source_language": source_lang,
                            "target_language": target_lang, "provider": "passthrough"}
                payload = {
                    "pipelineTasks": [
                        {
                            "taskType": "translation",
                            "config": task_config
                        }
                    ],
                    "inputData": {
                        "input": [{"source": s} for s in sources]
                    }
                }

                res = await client.post(config["callback_url"], headers=headers, json=payload, timeout=30.0)
                if res.status_code == 200:
                    data = res.json()
                    pipeline_res = data.get("pipelineResponse", [])
                    if pipeline_res and "output" in pipeline_res[0]:
                        outputs = [o.get("target") for o in pipeline_res[0]["output"] or []]
                        translated = cls._reassemble(lines, outputs) if len(outputs) == len(sources) else None
                        if translated:
                            if len(cls._translation_cache) > 500:
                                cls._translation_cache.clear()
                            cls._translation_cache[cache_key] = translated
                            return {
                                "translated_text": translated,
                                "source_language": source_lang,
                                "target_language": target_lang,
                                "provider": "bhashini_live"
                            }
                        print("[Bhashini Service] A citation did not survive translation; using the LLM translation.")
                elif res.status_code in (401, 403, 429):
                    print(f"[Bhashini Service] Inference returned {res.status_code} (Quota or Auth). Cooling down 5m.")
                    cls._throttle_until = now + 300
                else:
                    print(f"[Bhashini Service] Inference response status {res.status_code}: {res.text[:200]}")
        except Exception as e:
            print(f"[Bhashini Translation Warning]: {e}")

        # Seamlessly fall through to neural LLM translation
        fallback_res = await cls._fallback_translate(text, source_lang, target_lang)
        if fallback_res.get("translated_text"):
            if len(cls._translation_cache) > 500:
                cls._translation_cache.clear()
            cls._translation_cache[cache_key] = fallback_res["translated_text"]
        return fallback_res

    @classmethod
    def _prepare(cls, text: str) -> Optional[Tuple[List[Dict[str, Any]], List[str]]]:
        """
        Split text into the sentences NMT should see, with citations swapped for
        markers, and note how to put the translation back together.

        Only words go to NMT, so Markdown survives: a line's bullet or number is
        kept aside, and bold markers, which NMT scatters, are dropped except
        around a whole line or a whole citation. Returns None when the text
        already holds something that looks like a marker.
        """
        lines: List[Dict[str, Any]] = []
        sources: List[str] = []
        for line in text.split("\n"):
            prefix, body = cls._MD_PREFIX.match(line).groups()
            if cls._PLACEHOLDER.search(body):
                return None
            bold = len(body) > 4 and body.startswith("**") and body.endswith("**") and body.count("**") == 2
            if bold:
                body = body[2:-2]
            saved: List[str] = []

            def keep(m):
                saved.append(m.group(0))
                return "{%d}" % (len(saved) - 1)

            def keep_bold(m):
                i = int(m.group(1))
                saved[i] = f"**{saved[i]}**"
                return "{%d}" % i

            masked = cls._PROTECTED.sub(keep, body)
            masked = re.sub(r"\*\*\s*\{(\d+)\}\s*\*\*", keep_bold, masked).replace("**", "").strip()
            if not any(ch.isalpha() for ch in cls._PLACEHOLDER.sub("", masked)):
                lines.append({"original": line, "count": 0})
                continue
            parts = [p for p in cls._SENTENCE_END.split(masked) if p.strip()]
            lines.append({"prefix": prefix, "bold": bold, "saved": saved, "start": len(sources), "count": len(parts)})
            sources.extend(parts)
        return lines, sources

    @classmethod
    def _reassemble(cls, lines: List[Dict[str, Any]], outputs: List[Optional[str]]) -> Optional[str]:
        """Put the translated sentences back, or None if a citation marker was lost."""
        out = []
        for line in lines:
            if not line["count"]:
                out.append(line["original"])
                continue
            pieces = outputs[line["start"]:line["start"] + line["count"]]
            if not all(p and p.strip() for p in pieces):
                return None
            body = " ".join(p.strip() for p in pieces)
            if sorted(int(i) for i in cls._PLACEHOLDER.findall(body)) != list(range(len(line["saved"]))):
                return None
            body = cls._PLACEHOLDER.sub(lambda m: line["saved"][int(m.group(1))], body)
            out.append(line["prefix"] + (f"**{body}**" if line["bold"] else body))
        return "\n".join(out)

    @classmethod
    async def _fallback_translate(cls, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """
        Translate via the configured LLM when Bhashini is not available.

        Statutory citations must survive translation unchanged. A section number
        rendered in Devanagari digits, or an act name translated into Hindi, is
        no longer checkable against the official text, which defeats the whole
        point of citing it. The prompt pins those in their official English form.
        """
        src = cls.SUPPORTED_LANGUAGES.get(source_lang, source_lang)
        tgt = cls.SUPPORTED_LANGUAGES.get(target_lang, target_lang)
        tgt_spec = cls.LANGUAGE_SCRIPTS.get(target_lang, tgt)

        system_prompt = (
            f"You are a legal translator working between {src} and {tgt}.\n"
            "RULES:\n"
            f"1. Translate the user's text from {src} into {tgt_spec}. Output ONLY the translation in {tgt_spec}.\n"
            "2. Do not add a preamble, a note, or a comment of your own.\n"
            "3. Keep every statutory citation EXACTLY as written, in English and in Latin script: act and "
            "treaty names, section, rule, article and regulation numbers, form numbers, and authority names "
            "such as the National Biodiversity Authority. Do not transliterate or translate them, and do not "
            "convert digits to another numeral system.\n"
            "4. Preserve Markdown structure: headings, bold markers, lists and line breaks.\n"
            "5. Translate the surrounding explanation naturally, as a lawyer writing for a lay reader would."
        )

        try:
            translated, provider = await call_llm(system_prompt, text)
            if translated and translated.strip():
                return {
                    "translated_text": translated.strip(),
                    "source_language": source_lang,
                    "target_language": target_lang,
                    "provider": f"llm:{provider}",
                }
        except Exception as e:
            print(f"[Translation] LLM fallback failed: {e}")

        # Last resort. This is a term-substitution dictionary, not a translation.
        print(
            "=" * 78 + "\n"
            "[Translation] *** NO TRANSLATION PROVIDER AVAILABLE.\n"
            f"[Translation] *** Returning {source_lang} -> {target_lang} via term substitution only.\n"
            "[Translation] *** The output is NOT a real translation.\n"
            + "=" * 78
        )
        return {
            "translated_text": cls._local_domain_translate(text, source_lang, target_lang),
            "source_language": source_lang,
            "target_language": target_lang,
            "provider": "term_substitution_fallback",
            "degraded": True,
        }

    @classmethod
    def _local_domain_translate(cls, text: str, source_lang: str, target_lang: str) -> str:
        """
        Rule-based high-fidelity terminology translation dictionary for Hindi <-> English.
        """
        if source_lang == "hi" and target_lang == "en":
            # Translate Hindi queries to English for statutory retrieval
            t = text
            translations = {
                "पेटेंट": "patent",
                "शास्त्रीय योग": "classical formulation",
                "जैव विविधता": "biological diversity",
                "अनुदान": "grant",
                "पारंपरिक ज्ञान": "traditional knowledge",
                "दवा": "medicine",
                "औषधि": "drug",
                "अश्वगंधा": "Ashwagandha",
                "त्रिफला": "Triphala",
                "क्या मैं": "can I",
                "नियम": "rules",
                "अधिनियम": "act",
                "लाभांश": "benefit sharing",
                "पंजीकरण": "registration",
                "ट्रेडमार्क": "trademark"
            }
            for k, v in translations.items():
                t = t.replace(k, v)
            return t
        elif source_lang == "en" and target_lang == "hi":
            # Return text with Hindi introductory banner
            return f"[आयुसाक्षी अनुवाद (हिंदी)] {text}"
            
        return text
