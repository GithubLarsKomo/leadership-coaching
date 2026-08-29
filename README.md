# Leadership Coaching

Generic adaptive leadership assessment and coaching platform with versioned definitions, immutable handoffs, server-authoritative timing and LLM-agnostic manual prompt contracts.

PES/SGL Schleswig-Holstein is the first assessment pack; it is not hard-coded application logic.

## Status

Initial architecture plus first usable PES/SGL vertical slice on `feat/initial-mvp`.

## Product principles

- Assessment definitions and scorecards are versioned and immutable once published.
- Candidate-facing tasks remain locked until server-authoritative unlock.
- Timing is measured from database timestamps, never browser clocks.
- Raw answers, timing and handoffs are immutable evidence; assessments are derived, separately versioned interpretations.
- LLM interaction is manual copy/paste for the MVP. No built-in provider API calls are required.
- Bootstrap, assessment and next-round generation use provider-neutral JSON and prompt contracts.
- PES/SGL Schleswig-Holstein is the first assessment pack, not hard-coded application logic.

## Local test

The local browser entry point is:

```text
http://localhost:3010
```

See `docs/local-testing.md` for PostgreSQL startup, migrations, PES/SGL seed and the timed candidate flow.

## Target deployment

- Node.js 22
- React + Vite + TypeScript
- PostgreSQL
- Docker / Coolify
- internal production port configurable through `PORT` (default `3000`)
- health endpoint `GET /healthz`
- production deployment from `main`
