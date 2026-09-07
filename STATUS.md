# AyuSakshi (IP-SAKTI Sahayak) - Project Status

**Last updated: 7 September 2026**
**SIH 2026, Problem Statement SIH26045, Ministry of Ayush / AIIA. Team Zenith.**

> Read `CLAUDE.md` for what the project is and why. Read this file for where it
> currently stands. Where the two disagree, this file is newer.
>
> Everything marked VERIFIED below was executed and observed, not assumed.
> Everything marked UNTESTED has never been run. The original CLAUDE.md warning
> still applies: **do not assume a feature works because the file exists.**

---

## 1. Deadlines

| Date | Milestone | Status |
|---|---|---|
| 8 September 2026 | PPT / solution presentation | **Tomorrow** |
| ~13-14 September 2026 | College internal hackathon, live demo | ~6 days |
| 30 September 2026 | National portal submission | |
| December 2026 | Grand Finale | |

---

## 2. How to run it

```bash
docker compose up -d          # all 5 services
```

Then open **http://localhost:5173**

| Service | Port | Notes |
|---|---|---|
| frontend | 5173 | React + Vite + Tailwind, served by nginx |
| backend | 5000 | Node/Express. Auth, chat, escalation, documents |
| ai-service | 8000 | FastAPI. The RAG pipeline |
| postgres | 5432 | pgvector. Corpus + conversations |
| redis | 6379 | BullMQ ingestion queue |

**Login accounts** (seeded in `database/init.sql`, password `Ayurveda@2026`):
- `admin@ayusakshi.gov.in` - admin. Knowledge base manager, document upload
- `facilitator@ayusakshi.gov.in` - facilitator. Review queue

### Rebuild rules (this catches people out)

- **ai-service**: `app/` is volume-mounted. Python changes need only
  `docker restart ayusakshi_ai_service`. Only dependency changes need a rebuild.
- **backend**: NOT mounted. Any Node change needs `docker compose build backend`.
- **frontend**: NOT mounted. Any React change needs `docker compose build frontend`.

---

## 3. What is DONE

### 3.1 The core claims all work (VERIFIED 7 Sept)

| Claim | State | Evidence |
|---|---|---|
| Answers grounded in retrieved law | Working | Flagship query returns 0.657 confidence, 5 citations, real LLM |
| Citations show **actual statutory text** | Working | Clicking a citation shows *"3. What are not inventions.—...(p) an invention which in effect, is traditional knowledge..."* This was paraphrase until 6 Sept |
| Fabricated authority is blocked | Working | Model-invented section numbers are detected, confidence capped at 0.25, abstention triggered. None reach the user |
| System refuses when unsure | Working | Abstains on out-of-scope questions and on low confidence |
| Jurisdiction toggle | Working | India and international corpora are both real and separate |
| Corpus versioning | Working | Editing a statute's text retires the old version (`is_current=false`) and creates a new one |

### 3.2 Corpus: 13 documents, 38 chunks, 100% verbatim

No paraphrase remains. Every chunk is transcribed from an official PDF in
`knowledge-base/source/` or an official website, with source URL and retrieval
date. Source files are committed.

**India (9 documents, 22 chunks)** - `knowledge-base/corpus/india.json`

| Act | Provisions |
|---|---|
| Patents Act 1970 | 2(1)(j), 3(d), 3(e), 3(p), 10(4), 25(1)(j), 64(1)(p) |
| Biological Diversity Act 2002 | 3, 4, 6, 7 |
| BD (Amendment) Act 2023 | 6, section 7 proviso |
| Drugs & Cosmetics Act 1940 | 3(a), 3(h), First Schedule book list, Rule 158-B |
| DMR Act 1954 | Section 3 |
| GI Act 1999 | 2(1)(e) |
| NDCT Rules 2019 | 2(aa) phytopharmaceutical |
| FSSAI Ayurveda Aahara 2022 | 2(b) |
| Trade Marks Act 1999 | Section 9 |

**International (4 documents, 16 chunks)** - `knowledge-base/corpus/international.json`

Nagoya Protocol (Arts 5, 6, 7, 15, 16, 17), CBD (8(j), 15), TRIPS (22, 27),
WIPO GRATK Treaty 2024 (Arts 1-6).

The BD 2023 amendment includes the two things that matter most for AYUSH: the
change from approval-**before-filing** to approval-**before-grant**, and the
exemption for codified traditional knowledge, cultivated medicinal plants and
registered AYUSH practitioners.

### 3.3 Features verified working end to end

- **Chat with citations** - full 12-step pipeline
- **Classification wizard** - rule-based decision tree, 6 categories, reached in
  1-5 questions, returns the full decision path as an audit trail. Deliberately
  not an LLM, because a decision tree is explainable to a regulator
- **Hindi** - question translated for retrieval, answer returned in Hindi, with
  statute names and section numbers preserved in official English
- **Escalation** - submit -> facilitator queue -> status update to IN_REVIEW
- **Admin document upload** - upload -> BullMQ job -> text extraction ->
  section-aware chunking -> real `document_versions` row in PostgreSQL
- **Auth** - register, login, JWT, role enforcement (403 for wrong role)
- **Standing disclaimer** - always visible, not dismissible

### 3.4 Defects fixed since 5 September

All six defects listed in `CLAUDE.md` section 3 are fixed, plus others found
along the way. Summary, with the ones a reviewer should know about:

| Was | Now |
|---|---|
| ML dependencies missing; embeddings were word hashes, Postgres never touched | Real model, real pgvector, verified from logs |
| `verified_grounded: True` hardcoded on every chunk | Only chunks the answer actually used are returned as citations |
| `should_abstain()` written but never called | Wired into the pipeline |
| Out-of-scope handled by a hardcoded keyword list | Deleted. Scope is decided by retrieval evidence |
| Classifier short-circuited the pipeline at 0.85 confidence | Removed. Classification informs the answer, it does not gate it |
| Node invented a cited Section 3(p) answer when the AI service was down | Abstains honestly |
| `confidence_score \|\| 0.85` rewrote every abstention to 85% in the DB | Fixed (`?? 0`) |
| Static template could be returned as a grounded answer | Never returned. Abstains with reason `llm_unavailable` |
| Chunker split sections at page breaks | Joins pages first, chunks on section boundaries |
| Uploaded documents never reached Postgres | They do, idempotently, with version rows |
| Seeded admin/facilitator accounts could not log in (bad bcrypt hash) | Fixed and verified |
| UI hardcoded "Grounding Verified" and a fake "92.4% Entailment" | Reflects real values |
| Markdown printed raw (`**(A) Direct answer**`) | Renders properly |

---

## 4. What is LEFT

### 4.1 Correctness - do these first

**A. ABS Navigator and TKDL Checker modals make uncited legal claims**
`client/src/components/abs/ABSNavigator.jsx`, `client/src/components/tkdl/TKDLChecker.jsx`

These are **static**. They call no API and do no retrieval, yet they display
confident statutory assertions with section numbers under a heading reading
"Statutory Assessment Summary" - for example "Section 6(1) Mandatory NBA
Approval" and "Benefit sharing levy: 0.1% to 0.5% of annual ex-factory gross
sales". Some of that is not traceable to anything in the corpus.

This is the exact defect the project exists to eliminate, relocated into the UI.
A judge clicking "Biodiversity rules" in the sidebar gets uncited legal
conclusions from the tool whose whole pitch is that it never does that.

Fix: route them through the RAG pipeline so their output is cited, or reduce
them to a triage aid that hands the question to the grounded chat. The backend
already has working ABS logic (`ai-service/app/agents/abs_helper.py`) that
produces cited output in chat.

**B. Abstention threshold is mis-tuned for verbatim text**
`ai-service/app/config.py`, `CONFIDENCE_ABSTAIN_THRESHOLD = 0.50`

Verbatim statute shares fewer words with a natural question than the old
paraphrase did, so confidence sits lower across the board. Observed: a good
answer at 0.657, another good answer at 0.441 that was **wrongly refused**.
Valid questions are being turned away. Needs recalibrating against the current
corpus, not guessing.

### 4.2 Untested - never run even once

- **Mobile / responsive layout**
- **Node test suite** (`server/tests/`)
- **Google and Facebook OAuth** (local auth works; social login unexercised)
- **Password reset flow**
- **Ollama provider** - code written, Ollama not installed. This is both the
  offline safety net and the answer to "how does this run inside a ministry
  with data restrictions", which a Ministry panel is likely to ask

If any of these is in the demo script, test it before the 13th.

### 4.3 Corpus gaps (all recorded in the corpus metadata, none hidden)

| Gap | Detail |
|---|---|
| DMR Act Schedule | The downloaded PDF is an 8-page extract; the list of specified diseases is truncated after two entries. The system can say a restriction exists but not whether a specific condition is on the list |
| Rule 158-B tables | The safety-study and evidence-of-effectiveness tables do not survive PDF text extraction (columns flatten). Summarised in one sentence. Needs manual transcription |
| BD Rules 2024 | Not obtained. What was saved was a link to `elaw.in`, a third-party site, which fails the official-sources-only rule. Get it from nbaindia.org |
| Copyright, Designs, PPVFR Acts | PDFs downloaded and verified, not yet extracted into the corpus |
| TRIPS Arts 23-24 | Not ingested |
| PCT, Madrid, Hague, Budapest | No scope entries |
| Version dates | Only Trade Marks (1 June 2026) and Designs (15 June 2026) state an as-on date. Others record the retrieval date instead |

### 4.4 Verification still owed

The team brief's corpus rule 4 requires a human to confirm that each chunk's
recorded section number matches the text in that chunk. **This has not been
done.** A wrong section number produces a confidently wrong citation, which is
the worst failure this system can have. A verification sheet pairing each
recorded section number with the opening line of its text has not yet been
generated.

### 4.5 Operational, before the demo

- **Deploy** and test the URL from a phone on mobile data
- **Cold-start rehearsal** on the actual demo laptop. The ai-service image is
  3.7GB (model weights are baked in so no internet is needed at runtime)
- **Delete or rename** `C:\Users\Anudeep Devineni\Desktop\AyuSakshi-IP-SAKTHI-Sahayak--main`.
  That is a **second copy** of the project holding the original broken code with
  no git history. All real work is in the `OneDrive\Desktop\...` copy. Someone
  demoing from the wrong folder gets the broken version
- **Feature freeze 12 September**, three timed rehearsals, record a backup video

### 4.6 Measured results

The evaluation harness exists (`ai-service/app/evaluators/run_evaluation.py`,
25 cases in `golden_dataset.json` built from the team brief's own test
questions). It reports four axes separately: answer grounding, citation
correctness, abstention accuracy, and fabricated authority.

**No current number exists.** The last stored report predates both the template
fix and the entire corpus replacement, so it describes a system that no longer
exists. Do not quote it. One clean run is needed after the threshold in 4.1B is
fixed. `brief_06` also still carries `abstain_reason: corpus_gap` and needs
updating, because the DMR Act is now in the corpus.

---

## 5. Things that will bite you

**Groq daily token limit.** 200,000 tokens per day, **per model**. This was
fully exhausted on `openai/gpt-oss-120b` during testing on 6 September, which
made the whole app abstain until the model was switched. Currently on
`openai/gpt-oss-20b`. Fallbacks with untouched budgets: `qwen/qwen3.8-27b`,
`qwen/qwen3.6-27b`, `allam-2-7b`. Change with `GROQ_MODEL` in `.env`.

**One full benchmark run costs roughly a quarter of a model's daily budget.
Do not run it on demo day.**

**The Groq API key is in `.env`** (gitignored, correctly). It was pasted into a
chat transcript during development, so **rotate it** at console.groq.com before
anything public.

**Retrieval depends on `retrieval_context`.** Each corpus chunk carries a
plain-language aid indexed for search but never shown as citation text. Without
it retrieval fails, because statutes do not contain the words people search
with: Section 3(p) never says "patent", "Ayurvedic" or "Charaka Samhita". When
adding corpus entries, **always write a `retrieval_context`**, or that provision
will be effectively invisible to search.

**Docker Desktop must be running** before any `docker` command. It does not
start automatically after a reboot.

---

## 6. Key files

| Path | What it is |
|---|---|
| `knowledge-base/corpus/*.json` | **The corpus. Source of truth.** Verbatim text + metadata |
| `knowledge-base/source/*.pdf` | The 12 official PDFs the corpus was transcribed from |
| `knowledge-base/DOWNLOAD_LIST.md` | Which documents were needed, links, priority |
| `ai-service/app/agents/rag_orchestrator.py` | The 12-step pipeline |
| `ai-service/app/evaluators/citation_verifier.py` | Citation validation and fabrication detection |
| `ai-service/app/agents/classification_tree.py` | The rule-based wizard |
| `ai-service/app/rag/hybrid_retriever.py` | Dense + sparse + RRF |
| `ai-service/app/llm/providers.py` | Groq / OpenAI / Ollama chain |
| `ai-service/app/seed_knowledge.py` | Loads corpus files into Postgres, idempotently |
| `database/init.sql` | Schema. Only runs on a fresh postgres volume |
| `walkthrough.md` | Demo walkthrough. **Contains stale benchmark numbers** |

---

## 7. Suggested order of work

1. Fix the ABS / TKDL modals (4.1A) - correctness, and it is demo-visible
2. Retune the abstention threshold (4.1B) - currently refusing valid questions
3. Update `brief_06`, run one clean benchmark, record honest numbers
4. Generate the verification sheet and have a human spot-check section numbers
5. Install and test Ollama
6. Deploy, phone test, cold-start rehearsal on the demo laptop
7. Walk the demo script end to end and test whichever untested features it uses
