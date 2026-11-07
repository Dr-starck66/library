# ASTRA MACRO Ω — independent scientific evaluation protocol (public freeze, 2026-11-07)

**Status: NOT YET INDEPENDENTLY VALIDATED.** A public protocol, successful software tests and SHA-256 receipts do **not** constitute an external scientific assessment.

## Objective and eligibility
The claims under examination are:
1. Does the proposed model predict the **first official publication** of a macroeconomic statistic more accurately than the available **pre-release consensus** and a trivial or seasonal baseline?
2. Does the model predict the direction of **first print − contemporaneous consensus** on a genuine prospective, uncontaminated set?
3. Is any 90% accuracy achieved on a declared denominator, not by excluding missed dates or retroactively switching model/rule/target?

Evaluate **each indicator separately**, as well as a prespecified pooled score. Never pool 30 unrelated series to hide a weak series. Distinguish directional accuracy from exact-to-official-decimal accuracy, MAE/RMSE from consensus, probability calibration (Brier), abstention coverage, runtime latency, and commercial data-license clearance.

## Prospective design
An independent assessor selects and records the target release calendar, test horizon, acceptance precision, primary baseline, inclusion criteria and adverse-control logic **before observing outcomes**. Minimum per claimed target: 30 independently emitted prospective forecasts (more are needed for a narrow 95% uncertainty interval). No previously explored 2022–2025 NFP dates may be called pristine holdout. Regime-specific results (recessions/non-recessions and high/low inflation where sample sizes permit) must also be published.

For every event:
- Prior to the official release, publish an externally time-anchored receipt with: target series, reference period, official release_at UTC, release source, pre-release consensus value/source/consensus-as-of UTC, forecast value/sign/probability, model Git commit SHA, feature source SHA-256, observation as-of UTC, and abstention flag.
- Capture the **first official print** with original source bytes, official URL, first seen UTC, SHA-256 and later revision ledger. Reject current revised FRED/BLS values as labels when a first print is required.
- The independent assessor must obtain/verify the raw sources and external timestamps. A self-written JSON timestamp, arbitrary SHA-256 text, self-authored expert review or GitHub green CI run alone is NOT independent attestation.
- Record every scheduled event including those without a forecast, failures/late snapshots and revoked licensed inputs, never just successful signals.
- Keep all data not licensed for redistribution private to an authorized reviewer. A public client demo may expose aggregated results only.

## Acceptance gates
- No information as-of later than forecast freeze; negative controls intentionally introduce future leakage and altered hashes and **must fail**.
- Signed-off independent assessor with a verifiable identity, controlled raw-data access and a reproducible execution receipt; validation status remains UNVERIFIED before that sign-off.
- For each advertised target: 30+ eligible prospectively emitted predictions, 90%+ directional accuracy **and separately** 90%+ exact-to-official-precision accuracy if exact-print performance is advertised. Also require improvement against contemporaneous consensus and the best simple baseline, paired uncertainty and multiplicity correction when many indicators/models were tried. Report Wilson 95% confidence bounds, McNemar paired test and counts TP/FP/TN/FN.
- A raw 90% success rate in 30 trials is not by itself a 95%-confidence lower bound >90%; report statistical uncertainty rather than asserting certainty.
- Commercial buyers must independently confirm data rights, API security, reliability, permitted usage, and economic value. A technical PASS can never confer a $1 million valuation.

## Prior adverse result — mandatory benchmark
The already explored NFP retrospective 2022–2025:
- 38 observations.
- Interdisciplinary fusion: 23/38 correct (60.5263%).
- Trivial always-positive baseline: 27/38 correct (71.0526%).
- Model-only correct: 2; baseline-only correct: 6.
- One-sided paired binomial/McNemar superiority p = **0.96484375** (fails). The model has no demonstrated advantage on this sample.
- The inputs include post-hoc consensus vintages that are **NOT independently authenticated**. This set has been inspected repeatedly; it is NOT a pristine test.

## Reuse and provenance (no model publication)
Private research project: Dr-starck66/indexation PR #182, branch astra/macro-shadow-nfp-vintage-20261106.
- AION-ARC: experimental test selection and falsification.
- BIO-MIMIC X: external-validation and evidence-gating principles.
- ANT Robotics: pheromone-inspired ensemble heuristics, not robotics hardware in economic production.
- MACRO SHADOW: original CPI/NFP nowcasts and first-print ledgers.
- Institutional Value Gate Ω: excludes hypothetical sales/valuation from verified results.

This public sanitized repository deliberately excludes proprietary algorithms, historical third-party raw rows, client identities, trade execution, and privileged access tokens.

## Independent reviewer deliverable
A reviewer may return an assessment containing:
- identity/affiliation/authority and funding/conflicts disclosure;
- dataset source licenses, first-print and consensus vintage audit;
- exact preregistered Git commit and event inclusion log;
- reproducible commands, package/hash inventory and dated raw results;
- signed PASS / PARTIAL / FAIL / UNVERIFIED determination per claim;
- explicit negative results, abstentions and unsupported commercial claims.

**Current determination: scientific independent validation = UNVERIFIED; commercial SaaS production = NOT DEPLOYED; commercial valuation = UNVERIFIED.**
