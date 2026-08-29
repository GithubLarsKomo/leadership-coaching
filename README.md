# Leadership Assessment Coaching

Adaptive, timed leadership assessment and coaching application with versioned round definitions, immutable handoffs, server-authoritative timing and LLM-agnostic prompt contracts.

> Repository bootstrap note: the current GitHub repository name contains the typo `leaderdhip`. Rename the repository to `leadership-assessment-coaching` before production deployment.

## Status

Initial architecture and vertical MVP bootstrap.

## Product principles

- Assessment definitions and scorecards are versioned and immutable once published.
- Candidate-facing tasks remain locked until server-authoritative unlock.
- Timing is measured from database timestamps, never browser clocks.
- Raw answers, timing and handoffs are immutable evidence; assessments are derived, separately versioned interpretations.
- LLM use is optional and provider-agnostic through versioned prompt contracts and structured JSON schemas.
- PES/SGL Schleswig-Holstein is the first assessment pack, not hard-coded application logic.

## Target deployment

- Node.js 22
- React + Vite + TypeScript
- PostgreSQL
- Docker / Coolify
- internal port `3000`
- health endpoint `GET /healthz`
- production deployment from `main`
