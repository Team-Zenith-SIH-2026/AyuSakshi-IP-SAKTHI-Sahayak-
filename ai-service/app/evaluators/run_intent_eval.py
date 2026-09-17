"""
How well a practitioner's situation is recognised from their own words.

Offline: embeddings only, no language model, no quota. Reports, for the
held-out phrasings in layman_intents.json and for the benchmark's own questions:

  correct        mapped straight to the right situation, or offered it among
                 the choices when the wording was ambiguous
  wrong          mapped straight to a different situation
  missed         no situation offered for an in-scope question
  false_trigger  an out-of-scope question mapped or offered a situation

plus facts read correctly from the wording. Also sweeps the thresholds, so a
change to them in intent_mapper.py is made from numbers rather than by feel.

    docker exec ayusakshi_ai_service python -m app.evaluators.run_intent_eval [--sweep]
"""

import json
import os
import sys
from collections import Counter

from app.agents import intent_mapper as im
from app.agents.intent_mapper import IntentMapper, OUT_OF_SCOPE

HERE = os.path.dirname(__file__)

# The benchmark's questions, with the situation each belongs to. International
# questions are skipped: the intent layer is used for the India jurisdiction only.
GOLDEN_EXPECTED = {
    "brief_01": "patent_my_product",
    "brief_02": "patent_my_product",
    "brief_03": "patent_using_indian_plant",
    "brief_04": "plants_in_business",
    "brief_05": "medicine_licence",
    "brief_06": "advertising_claims",
    "brief_07": "sell_as_food",
    "brief_08": "phytopharmaceutical",
    "brief_09": "gi_tag",
    "brief_11": "stop_others_patent",
    "brief_12": None,
    "india_01": "plants_in_business",
    "india_02": "patent_using_indian_plant",
    "oos_01": None, "oos_02": None, "oos_03": None, "oos_04": None, "oos_05": None, "oos_06": None,
}


def load_cases():
    with open(os.path.join(HERE, "layman_intents.json"), encoding="utf-8") as f:
        held_out = json.load(f)["cases"]
    with open(os.path.join(HERE, "golden_dataset.json"), encoding="utf-8") as f:
        golden = {c["id"]: c for c in json.load(f)}
    bench = [
        {"id": cid, "level": "benchmark", "text": golden[cid]["query"], "intent": expected}
        for cid, expected in GOLDEN_EXPECTED.items() if cid in golden
    ]
    return held_out, bench


def classify(case, ranked):
    """
    Outcome of the recognition step alone, for the current thresholds. Runs the
    service's own IntentMapper.recognise, with the embedding ranking computed
    once up front so the threshold sweep does not re-embed every case.
    """
    original_rank = IntentMapper.__dict__["rank"]
    IntentMapper.rank = classmethod(lambda cls, text: ranked)
    try:
        found = IntentMapper.recognise(case["text"])
    finally:
        IntentMapper.rank = original_rank
    decision, offered = found.decision, found.offered

    expected = case["intent"]
    if expected is None:
        verdict = "false_trigger" if offered else "correct"
    elif not offered:
        verdict = "missed"
    elif decision == "mapped":
        verdict = "correct" if offered[0] == expected else "wrong"
    else:
        verdict = "correct" if expected in offered else "wrong"
    return decision, offered, verdict


def report(cases, ranks, title, verbose=True):
    counts, by_level = Counter(), {}
    slot_total = slot_ok = 0
    print(f"\n{title}")
    print("-" * len(title))
    for case in cases:
        ranked = ranks[case["id"]]
        decision, offered, verdict = classify(case, ranked)
        counts[verdict] += 1
        by_level.setdefault(case["level"], Counter())[verdict] += 1
        mark = {"correct": "ok ", "wrong": "XX ", "missed": "-- ", "false_trigger": "!! "}[verdict]
        if verbose:
            top3 = " ".join(f"{i}:{s:.2f}" for i, s in ranked[:3])
            print(f"{mark}{case['id']:<9} {decision:<7} expected={str(case['intent']):<26} {top3}")
            if verdict != "correct":
                print(f"          \"{case['text']}\"")
        if case.get("slots") is not None and case["intent"] and verdict == "correct":
            from app.agents.intent_catalogue import intent_by_id
            got = IntentMapper.parse_slots(intent_by_id(case["intent"]), case["text"])
            for name, value in case["slots"].items():
                slot_total += 1
                slot_ok += got.get(name) == value
            if not case["slots"]:
                slot_total += 1
                slot_ok += not got  # nothing stated, nothing should be read
    n = sum(counts.values())
    print(f"\n{title}: {counts['correct']}/{n} correct, {counts['wrong']} wrong, "
          f"{counts['missed']} missed, {counts['false_trigger']} false triggers")
    for level, c in sorted(by_level.items()):
        print(f"   {level:<9} {c['correct']}/{sum(c.values())} correct  "
              f"(wrong {c['wrong']}, missed {c['missed']}, false {c['false_trigger']})")
    if slot_total:
        print(f"   facts read from wording: {slot_ok}/{slot_total}")
    return counts


def sweep(cases, ranks):
    print("\nThreshold sweep (all cases): match, margin, floor -> correct / wrong / missed / false")
    rows = []
    for match in (0.45, 0.50, 0.55, 0.60, 0.65):
        for margin in (0.02, 0.04, 0.06, 0.08):
            for floor in (0.35, 0.40, 0.45, 0.50):
                if floor > match:
                    continue
                im.MATCH_THRESHOLD, im.MATCH_MARGIN, im.CHOICE_FLOOR = match, margin, floor
                c = Counter(classify(case, ranks[case["id"]])[2] for case in cases)
                mapped_right = sum(
                    1 for case in cases
                    if classify(case, ranks[case["id"]])[0] == "mapped" and classify(case, ranks[case["id"]])[2] == "correct"
                )
                rows.append((c["wrong"] + c["false_trigger"], c["missed"], -mapped_right, match, margin, floor, c))
    rows.sort()
    for wrong_false, missed, neg_mapped, match, margin, floor, c in rows[:12]:
        print(f"   {match:.2f} {margin:.2f} {floor:.2f} -> {c['correct']} / {c['wrong']} / {c['missed']} / "
              f"{c['false_trigger']}   (mapped directly: {-neg_mapped})")


def main():
    held_out, bench = load_cases()
    ranks = {c["id"]: IntentMapper.rank(c["text"]) for c in held_out + bench}
    report(held_out, ranks, "Held-out phrasings")
    report(bench, ranks, "Benchmark questions")
    if "--sweep" in sys.argv:
        saved = (im.MATCH_THRESHOLD, im.MATCH_MARGIN, im.CHOICE_FLOOR)
        sweep(held_out + bench, ranks)
        im.MATCH_THRESHOLD, im.MATCH_MARGIN, im.CHOICE_FLOOR = saved


if __name__ == "__main__":
    main()
