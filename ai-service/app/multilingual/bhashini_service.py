import os
import re
import httpx
from typing import Dict, Any, Optional
from app.config import settings
from app.llm.providers import call_llm

class BhashiniService:
    """
    Bhashini / ULCA Neural Machine Translation client for Indian Languages.
    Preserves exact statutory citations (e.g., 'Section 3(p)', 'Rule 157', 'Form A') during translation.
    """
    
    BHASHINI_BASE_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
    
    # Supported Indian Languages
    SUPPORTED_LANGUAGES = {
        "en": "English",
        "hi": "Hindi",
        "sa": "Sanskrit",
        "ta": "Tamil",
        "te": "Telugu",
        "kn": "Kannada",
        "mr": "Marathi",
        "bn": "Bengali",
        "gu": "Gujarati",
        "ml": "Malayalam",
        "pa": "Punjabi"
    }
    
    @staticmethod
    def detect_language(text: str) -> str:
        """
        Detects primary script or language of input text.
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
        
        counts = {
            "hi": devanagari_count,
            "ta": tamil_count,
            "te": telugu_count,
            "kn": kannada_count,
            "bn": bengali_count,
            "gu": gujarati_count,
        }
        
        max_lang = max(counts, key=counts.get)
        if counts[max_lang] > 3:
            return max_lang
            
        return "en"

    @classmethod
    async def translate(cls, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """
        Translates text between Indian languages and English using Bhashini NMT API or high-fidelity fallback.
        """
        if not text or source_lang == target_lang:
            return {"translated_text": text, "source_language": source_lang, "target_language": target_lang, "provider": "passthrough"}
            
        if not settings.BHASHINI_ENABLED or not settings.BHASHINI_API_KEY:
            # Bhashini is the preferred provider for Indian languages, but it needs
            # ULCA credentials. Without them, translate with the configured LLM
            # rather than returning the source text dressed up as a translation.
            return await cls._fallback_translate(text, source_lang, target_lang)
            
        try:
            headers = {
                "User-Agent": "AyuSakshi-SIH26045",
                "Content-Type": "application/json",
                "userID": settings.BHASHINI_USER_ID,
                "ulcaApiKey": settings.BHASHINI_API_KEY,
                "Authorization": settings.BHASHINI_API_KEY
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
                "inputData": {
                    "input": [{"source": text}]
                }
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(cls.BHASHINI_BASE_URL, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    translated = data["pipelineResponse"][0]["output"][0]["target"]
                    return {
                        "translated_text": translated,
                        "source_language": source_lang,
                        "target_language": target_lang,
                        "provider": "bhashini_live"
                    }
        except Exception as e:
            print(f"[Bhashini Translation Warning]: {e}")

        # Bhashini unreachable. Fall through to the neural fallback below.
        return await cls._fallback_translate(text, source_lang, target_lang)

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

        system_prompt = (
            f"You are a legal translator working between {src} and {tgt}.\n"
            "RULES:\n"
            f"1. Translate the user's text from {src} into {tgt}. Output ONLY the translation.\n"
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
