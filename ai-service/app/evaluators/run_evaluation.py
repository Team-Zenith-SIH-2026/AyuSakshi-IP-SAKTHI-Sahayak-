import json
import asyncio
import os
from app.agents.rag_orchestrator import RAGOrchestrator
from app.seed_knowledge import seed_database

async def run_benchmark():
    seed_database()
    dataset_path = os.path.join(os.path.dirname(__file__), "golden_dataset.json")
    with open(dataset_path, "r", encoding="utf-8") as f:
        test_cases = json.load(f)
        
    print("==========================================================================")
    print(f"  [*] Running AyuSakshi RAG Golden Benchmark ({len(test_cases)} Test Cases)")
    print("==========================================================================")
    
    passed_cases = 0
    results_summary = []
    
    for case in test_cases:
        case_id = case["id"]
        query = case["query"]
        jur = case["jurisdiction"]
        
        response = await RAGOrchestrator.process_query(
            query=query,
            conversation_id=f"eval-{case_id}",
            jurisdiction=jur
        )
        
        # Check criteria
        citations = response.get("citations", [])
        answer = response.get("answer", "")
        conf_level = response.get("confidence_level", "")
        
        statute_match = True
        for stat in case.get("expected_statutes", []):
            if not any(stat.lower() in (c.get("source_title", "") + c.get("section_reference", "")).lower() for c in citations):
                if stat.lower() not in answer.lower():
                    statute_match = False
                    
        abstain_match = True
        if case["expected_abstain"]:
            if conf_level != "abstained" and "abstain" not in answer.lower() and "could not find sufficient" not in answer.lower():
                abstain_match = False
                
        is_pass = statute_match and abstain_match
        if is_pass:
            passed_cases += 1
            
        results_summary.append({
            "id": case_id,
            "query": query[:50] + "...",
            "jurisdiction": jur,
            "statute_match": statute_match,
            "abstain_match": abstain_match,
            "citations_found": len(citations),
            "confidence_score": response.get("confidence_score", 0),
            "passed": is_pass
        })
        if not is_pass:
            print(f"DEBUG {case_id}: answer contains BDA: {'biological diversity act' in answer.lower()} | citations: {[c.get('source_title', '') + ' ' + c.get('section_reference', '') for c in citations]}")
        print(f"[{'PASS' if is_pass else 'FAIL'}] {case_id} | Jur: {jur} | Citations: {len(citations)} | Conf: {response.get('confidence_score', 0):.2f}")
        
    accuracy = (passed_cases / len(test_cases)) * 100
    print("--------------------------------------------------------------------------")
    print(f"  [RESULT] Overall Golden Benchmark Accuracy: {accuracy:.1f}% ({passed_cases}/{len(test_cases)})")
    print("==========================================================================")
    return results_summary

if __name__ == "__main__":
    asyncio.run(run_benchmark())
