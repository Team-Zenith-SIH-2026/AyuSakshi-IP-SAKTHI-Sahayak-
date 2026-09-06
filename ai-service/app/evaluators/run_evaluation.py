"""
Golden benchmark for AyuSakshi.

Reports the four axes the problem statement is scored on, separately, rather
than blending them into one number:

  1. Answer grounding      - was the answer generated from retrieved evidence by an
                             LLM, or assembled from a static template?
  2. Citation correctness  - do the expected provisions appear in the VERIFIED
                             CITATIONS? Matching against the answer string is
                             deliberately not done: the old harness did that, and
                             a hardcoded template containing "Section 3(p)" scored
                             as a pass while the RAG pipeline did nothing.
  3. Safe abstention       - split into false refusals (abstained when it should
                             have answered) and false answers (answered when it
                             should have abstained). The second is the dangerous one.
  4. Fabricated authority  - count of invented provisions. Target is zero.

Run:  docker exec ayusakshi_ai_service python -m app.evaluators.run_evaluation
"""

import asyncio
import json
import os
from datetime import datetime, timezone

from app.agents.rag_orchestrator import RAGOrchestrator
from app.config import settings
from app.seed_knowledge import seed_database

# Groq's free tier caps tokens per minute. The orchestrator retries on 429, but
# pacing the run keeps the benchmark from spending most of its time backing off.
PACE_SECONDS = float(os.getenv("EVAL_PACE_SECONDS", "3"))


def _citation_blob(citations):
    return " | ".join(
        f"{c.get('source_title', '')} {c.get('section_reference', '')}"
        for c in citations
    ).lower()


async def run_benchmark():
    seed_database()

    dataset_path = os.path.join(os.path.dirname(__file__), "golden_dataset.json")
    with open(dataset_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    print("=" * 78)
    print(f"  AyuSakshi Golden Benchmark - {len(cases)} cases")
    print(f"  LLM: {settings.LLM_PROVIDER} / {settings.GROQ_MODEL}")
    print(f"  Abstention threshold: {settings.CONFIDENCE_ABSTAIN_THRESHOLD}")
    print("=" * 78)

    results = []
    for i, case in enumerate(cases):
        response = await RAGOrchestrator.process_query(
            query=case["query"],
            conversation_id=f"eval-{case['id']}",
            jurisdiction=case["jurisdiction"],
        )

        citations = response.get("citations", [])
        fabricated = response.get("fabricated_citations") or []
        level = response.get("confidence_level", "")
        path = response.get("synthesis_path") or "abstained"
        did_abstain = level == "abstained"
        should_abstain = bool(case["expected_abstain"])

        blob = _citation_blob(citations)
        missing = [
            s for s in case.get("expected_statutes", [])
            if s.lower() not in blob
        ]
        cited_ok = not missing

        abstention_ok = did_abstain == should_abstain
        false_refusal = did_abstain and not should_abstain
        false_answer = (not did_abstain) and should_abstain

        results.append({
            "id": case["id"],
            "query": case["query"],
            "jurisdiction": case["jurisdiction"],
            "expected_abstain": should_abstain,
            "abstain_reason": case.get("abstain_reason"),
            "did_abstain": did_abstain,
            "abstention_ok": abstention_ok,
            "false_refusal": false_refusal,
            "false_answer": false_answer,
            "citations_found": len(citations),
            "expected_statutes": case.get("expected_statutes", []),
            "missing_statutes": missing,
            "citation_ok": cited_ok,
            "fabricated": fabricated,
            "confidence_score": response.get("confidence_score", 0),
            "synthesis_path": path,
        })

        flag = "  " if abstention_ok else "!!"
        status = "ABSTAIN" if did_abstain else f"{len(citations)} cites"
        note = ""
        if false_answer:
            note = "  <- ANSWERED, SHOULD HAVE REFUSED"
        elif false_refusal:
            note = f"  <- refused, expected an answer (missing: {', '.join(missing) or 'n/a'})"
        elif not cited_ok and not did_abstain:
            note = f"  <- missing expected: {', '.join(missing)}"
        print(
            f"{flag} {case['id']:<10} {case['jurisdiction']:<14} "
            f"conf {response.get('confidence_score', 0):.2f}  {status:<10} {path:<32}{note}"
        )

        if i < len(cases) - 1:
            await asyncio.sleep(PACE_SECONDS)

    # ---------------------------------------------------------------- metrics
    total = len(results)
    expected_answer = [r for r in results if not r["expected_abstain"]]
    expected_refusal = [r for r in results if r["expected_abstain"]]
    answered = [r for r in results if not r["did_abstain"]]

    abstention_acc = sum(r["abstention_ok"] for r in results) / total * 100
    false_refusals = sum(r["false_refusal"] for r in results)
    false_answers = sum(r["false_answer"] for r in results)

    citation_pool = [r for r in expected_answer if not r["did_abstain"]]
    citation_acc = (
        sum(r["citation_ok"] for r in citation_pool) / len(citation_pool) * 100
        if citation_pool else 0.0
    )
    grounded = [r for r in answered if r["synthesis_path"].startswith("llm:")]
    grounded_rate = len(grounded) / len(answered) * 100 if answered else 0.0

    # Detected is not the same as delivered. A fabricated provision caps confidence
    # and trips the abstention gate, so it never reaches the user. The number that
    # matters for the safety claim is how many survived into a returned answer.
    fabricated_detected = sum(len(r["fabricated"]) for r in results)
    fabricated_delivered = sum(len(r["fabricated"]) for r in results if not r["did_abstain"])

    corpus_gap_refusals = [
        r for r in expected_refusal if r["abstain_reason"] == "corpus_gap"
    ]

    print("=" * 78)
    print("  RESULTS")
    print("-" * 78)
    print(f"  Answer grounding      {grounded_rate:5.1f}%   {len(grounded)}/{len(answered)} answers generated from retrieved evidence")
    print(f"  Citation correctness  {citation_acc:5.1f}%   {sum(r['citation_ok'] for r in citation_pool)}/{len(citation_pool)} carried every expected provision")
    print(f"  Abstention accuracy   {abstention_acc:5.1f}%   {sum(r['abstention_ok'] for r in results)}/{total} correct refuse/answer decisions")
    print(f"    false answers          {false_answers:>3}     answered when it should have refused  (target 0)")
    print(f"    false refusals         {false_refusals:>3}     refused when it should have answered")
    print(f"  Fabricated authority")
    print(f"    delivered to user      {fabricated_delivered:>3}     invented provisions in a returned answer (target 0)")
    print(f"    detected and blocked   {fabricated_detected:>3}     caught by citation validation before returning")
    print("-" * 78)
    print(f"  Out-of-scope refusals  {sum(1 for r in expected_refusal if r['abstain_reason'] == 'out_of_scope' and r['did_abstain'])}/"
          f"{sum(1 for r in expected_refusal if r['abstain_reason'] == 'out_of_scope')} correctly refused")
    if corpus_gap_refusals:
        print(f"  Corpus-gap refusals    {len(corpus_gap_refusals)}       expected to flip to answers once these are ingested:")
        for r in corpus_gap_refusals:
            print(f"                           - {r['id']}: {', '.join(r['expected_statutes']) or 'n/a'}")
    print("=" * 78)

    report = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.GROQ_MODEL,
        "abstain_threshold": settings.CONFIDENCE_ABSTAIN_THRESHOLD,
        "case_count": total,
        "metrics": {
            "answer_grounding_pct": round(grounded_rate, 1),
            "citation_correctness_pct": round(citation_acc, 1),
            "abstention_accuracy_pct": round(abstention_acc, 1),
            "false_answers": false_answers,
            "false_refusals": false_refusals,
            "fabricated_authority_delivered": fabricated_delivered,
            "fabricated_authority_detected_and_blocked": fabricated_detected,
        },
        "cases": results,
    }
    out_path = os.path.join(os.path.dirname(__file__), "last_evaluation.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"  Full report written to {out_path}")

    return report


if __name__ == "__main__":
    asyncio.run(run_benchmark())
