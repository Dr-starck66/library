# ASTRA NFL HIDDEN TALENT Ω — NFL Big Data Bowl 2027

Evidence-first starter for the NFL Big Data Bowl 2027.

## Competition truth locked on 2026-10-07
- Ninth annual NFL Big Data Bowl, powered by AWS.
- Theme: NFL Scouting Combine movement/tracking data + selected regular-season Next Gen Stats tracking data.
- Goal: identify pre-draft measurements/traits tied to future NFL performance and communicate actionable insights to coaches, scouts, and front offices.
- Open Track: entrants outside college/university.
- Prize pool: $100,000.
- Kaggle deadline advertised: 2027-01-06 23:59 UTC.
- Official competition: https://www.kaggle.com/c/nfl-big-data-bowl-2027

## Research thesis
**Combine Movement Fingerprint → NFL Translation Score → Hidden Talent / Bust Risk**

Candidate interpretable features: acceleration, jerk, turn rate, speed retention through direction changes, trajectory efficiency, and body-orientation vs motion alignment.

## Included
- `src/features.py`: per-player movement fingerprint extractor.
- `src/schema_probe.py`: Kaggle-side file/column inspector.
- `src/baseline.py`: grouped cross-validated prospect-level baseline.
- `tests/test_features.py`: deterministic smoke tests and fail-closed schema validation.

## Kaggle first run
```bash
python src/schema_probe.py > schema.json
pytest -q
```

## Proof gate
PASS is forbidden until:
1. Competition rules accepted and official data visible.
2. `schema_probe.py` succeeds against the real dataset.
3. Real Combine/game join keys are identified without leakage.
4. Baseline evaluated with grouped/temporal holdout.
5. Translation Score beats simple Combine-only baselines with uncertainty checks.
6. At least one coach/scout-facing visualization is reproducible.

Current status: **PARTIAL** — code + synthetic tests verified; real-data validation awaits Kaggle data access.
