# Evaluation Benchmark & Quality Metrics

## Evaluation Framework
AyuSakshi evaluates RAG performance across eight measurable dimensions:
1. **Answer Accuracy & Grounding**: Claims verified against statutory text.
2. **Retrieval Precision & Recall**: Relevant statutory sections retrieved in top $k$.
3. **Citation Completeness**: Valid section numbers and authorities cited for every assertion.
4. **Jurisdiction Isolation**: Zero cross-contamination between India and International regimes.
5. **Safe Abstention Rate**: 100% abstention on out-of-scope / ungrounded queries.
6. **Formulation Classification Accuracy**: Precision on 6 SIH26045 regulatory classes.
7. **ABS Compliance Precision**: Accurate Form A / Form III / Exemption identification.
8. **Multilingual Entailment**: Correct translation fidelity across Indian languages via Bhashini.

### Running the Automated Benchmark
```bash
python -m app.evaluators.run_evaluation
```
