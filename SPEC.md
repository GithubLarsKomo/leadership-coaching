# SPEC — Leadership Coaching

**Status:** initial normative product specification  
**Target runtime:** Node.js 22, React/Vite/TypeScript, PostgreSQL, Docker/Coolify

## 1. Scope

Leadership Coaching is a generic platform for versioned, timed, adaptive leadership assessment and development. PES/SGL Schleswig-Holstein is the first assessment pack, not hard-coded application behavior.

The system manages bootstrap artifacts, normalized leadership contexts, assessment definitions, scorecards, sessions, timed round attempts, versioned answers, immutable raw handoffs, separately versioned assessments and cumulative development state.

Until further notice all LLM work is **manual copy/paste prompting**. The application contains no provider API integration and does not require OpenAI, Anthropic, Gemini, Ollama or another model service at runtime.

It is not an automated hiring-decision system. It must not infer protected personal characteristics or use health, religion, political views, sexual orientation, family planning, origin or other irrelevant private information as leadership evidence.

## 2. Architecture sources

Operational patterns follow Exam Trainer Framework where appropriate: TypeScript/Vite frontend, Node 22 container, Docker/Coolify deployment, `/healthz`, CI gates and `main` as production branch.

Data-driven progressive-round concepts follow Grilling where appropriate: versioned JSON definitions, stable IDs, progressive rounds, immutable handoff evidence, history preservation and explicit import/export boundaries.

Leadership Coaching adds competency/evidence modeling, timed attempts, coaching state, retest/transfer semantics and a generic bootstrap layer.

## 3. Generic bootstrap lifecycle

The canonical entry point is not an LLM-specific prompt and not a PES-specific JSON. It is a provider-neutral bootstrap artifact:

```text
bootstrap-input.json
  -> manual leadership-bootstrap prompt
  -> leadership-context.json
  -> schema + semantic review
  -> scorecard.json
  -> assessment-definition.json with first locked round
  -> import into runtime
```

### 3.1 Bootstrap Input

Must conform to `schemas/bootstrap-input-v1.schema.json` and contain at least:

- coaching objective and desired outcome;
- target role and organization context;
- evidence maturity;
- available role/competency evidence;
- assessment constraints;
- intended session mode and feedback policy.

Evidence maturity is exactly one of:

- `authoritative`: normative role architecture or competency model exists;
- `evidence-based`: credible role evidence exists but no complete normative model;
- `exploratory`: only limited role/coaching context exists.

### 3.2 Leadership Context

The first manual LLM transformation produces `leadership-context.json` conforming to `schemas/leadership-context-v1.schema.json`.

It separates:

- role purpose;
- outcomes;
- accountabilities;
- decision rights;
- interfaces;
- operating context;
- competencies expressed as observable behavior;
- evidence basis and confidence;
- assessment risks;
- unresolved unknowns.

Competency status is exactly `confirmed`, `supported`, `provisional` or `unknown`.

A schema-valid context is not automatically approved. Human semantic review is mandatory before it is used as a normative coaching source.

### 3.3 Scorecard and first assessment

Only after leadership-context review are scorecard and first round created. These artifacts must preserve version references to their source leadership context. PES/SGL may ship reviewed seed artifacts, but the runtime must remain capable of importing other leadership contexts and assessment packs without code changes.

## 4. Runtime lifecycle

```text
Assessment Definition
  -> Session
  -> Round locked
  -> Unlock
  -> server timestamp
  -> Candidate task visible
  -> versioned answers
  -> Complete
  -> server timestamp + elapsed time
  -> immutable Raw Handoff
  -> manual Assessment import
  -> Development State
  -> manual next-round generation/import
  -> next Round locked
```

`complete`, `assess` and `generate-next` are separate operations. Candidate evidence must never depend on successful LLM use.

## 5. Domain objects

### Bootstrap Input
Provider-neutral description of role, objective, evidence and constraints. It contains no candidate score and no exercise answer key.

### Leadership Context
Reviewed normalized role and competency model. It preserves evidence maturity and uncertainty rather than converting inference into fact.

### Assessment Definition
Stable identity across immutable versions. Contains goal, session policy, round-generation policy, leadership-context reference, scorecard reference and initial round(s).

### Scorecard
Stable identity across immutable versions. Dimensions have stable IDs, definitions, weights, observable evidence guidance and optional minimum levels. Published scorecards are not candidate-specific.

### Assessment Session
One subject/coaching run pinned to one assessment-definition version and one scorecard version. A session never silently upgrades.

### Session Round
A materialized candidate exercise. `source` is `definition`, `generated` or `manual`. Candidate content can be hidden until unlock.

### Round Attempt
One concrete timed attempt. Status: `locked`, `active`, `completed`, `abandoned`. Unlock and completion timestamps are server/database authoritative.

### Answer / Answer Version
Answers are versioned. Each answer version belongs to one attempt. Earlier revisions remain queryable.

### Round Handoff
Immutable application-generated evidence package produced after completion. Contains task, effective answers, timing and provenance. It contains no LLM interpretation.

### Round Assessment
Derived interpretation of a handoff against a fixed scorecard. Assessments are revisioned and include evidence class, score where justified, confidence, observations, gaps and next verification target.

### Development State
Derived, revisioned cumulative state summarizing per-dimension estimate, confidence, evidence count, trend and priority development targets.

### Prompt Contract / Manual Generation Record
Versioned prompt text and provenance for externally generated JSON. During the manual-first phase, provenance may record `creationMode=manual-llm`, prompt version, model name if known, input hash and output hash. Provider API credentials do not exist in the application.

## 6. Timing contract

### Unlock

`POST /api/v1/sessions/:sessionId/rounds/:roundId/unlock`

The server transaction creates or activates the next attempt and persists `unlocked_at = now()` in PostgreSQL. If already active, unlock is idempotent and returns the original timestamp.

When a round has `revealOnUnlock=true`, the task body/questions must not be returned by pre-unlock candidate endpoints.

### Complete

`POST /api/v1/sessions/:sessionId/rounds/:roundId/complete`

The server validates required visible answers, persists `completed_at = now()`, transitions the attempt to `completed`, derives elapsed milliseconds from database timestamps, freezes the attempt for further edits and creates the raw handoff in the same logical completion transaction.

Browser reload, browser close and device change do not pause time. Pause support, if ever added for training, requires an explicit server-side pause model and is not part of MVP.

## 7. Candidate API boundary

Candidate endpoints may expose only information needed to perform the task. Before unlock they return metadata such as title, status and estimated duration, but no hidden stimulus/questions if reveal-on-unlock is enabled.

Candidate responses must never contain scorecard weights, hidden competency mapping, prompt contracts, expected answers, assessments or adaptive-generation rationale during an active assessment block.

## 8. Coach API boundary

Coach endpoints can access definition versions, leadership context, scorecards, raw handoffs, imported assessments, development state, manual-generation provenance and audit history. Authorization must distinguish candidate and coach capabilities even when initial deployment uses an upstream authentication proxy.

## 9. Manual LLM contracts

The product currently supports exactly three manual prompt purposes:

1. `leadership-bootstrap`: transform bootstrap input into normalized leadership context;
2. `assess-round`: evaluate only observable evidence in one immutable handoff;
3. `generate-next-round`: create exactly one adaptive next exercise from fixed leadership context/scorecard plus prior handoffs/assessments.

Manual workflow:

```text
export/copy JSON input
  -> paste with versioned prompt into chosen LLM
  -> receive JSON-only output
  -> local/import schema validation
  -> semantic review where required
  -> persist accepted artifact
```

No model-specific fields may be required by domain schemas. A future API adapter must automate these same artifact boundaries rather than introduce a parallel workflow.

## 10. Evidence classes

Assessments use exactly:

- `verified`
- `supported-inference`
- `unknown`
- `contradicted`

`unknown` is not a negative score. Timing is contextual evidence only; faster is not automatically better and slower is not automatically worse.

## 11. PES/SGL initial pack

The first pack is `assessments/pes-sgl-sh/` and begins from a generic `bootstrap-input.json` with evidence maturity `evidence-based`.

Initial coaching dimensions currently used as a working scorecard are:

- communication — 0.20
- leadership-collaboration — 0.20
- analysis-decision — 0.15
- responsibility — 0.15
- change-innovation — 0.10
- self-management — 0.10
- reflection — 0.10

This is a coaching scorecard based on public role requirements plus an explicit coaching dimension for reflection. It must not be represented as an official confidential Schleswig-Holstein observer matrix unless authoritative evidence is later obtained.

## 12. Persistence and immutability

PostgreSQL is authoritative for session state and timing. Published definition/scorecard versions, completed attempts and raw handoffs are append-only. Reassessment, retry and coach correction create new rows/revisions.

Database access uses `DATABASE_URL`. Production DB is private to the application/network; no public PostgreSQL exposure is required.

Bootstrap files and prompt contracts may also remain version-controlled repository fixtures. Imported runtime artifacts must preserve their version and content hash.

## 13. Authentication and privacy

Production is expected to sit behind the existing trusted authentication boundary. The application stores a stable subject reference and actor provenance but should not require names, personnel numbers or other unnecessary identifiers for assessment logic.

No authentication tokens, LLM credentials or unrelated private data are stored in handoffs, answers or prompt inputs.

## 14. Deployment

Deployment follows the same operational pattern as Exam Trainer Framework:

- repository `main` is the production branch;
- Dockerfile build in Coolify;
- internal port `3000`;
- `GET /healthz` returns no-store health status;
- HTTPS through reverse proxy;
- automatic deployment after merge to `main`.

Unlike ETF, this app is server-stateful and requires PostgreSQL and therefore must not be treated as a static-only PWA.

## 15. MVP API plan

```text
GET  /healthz
GET  /api/v1/version
POST /api/v1/definitions/import
GET  /api/v1/definitions
POST /api/v1/sessions
GET  /api/v1/sessions/:id
GET  /api/v1/sessions/:id/rounds/:roundId
POST /api/v1/sessions/:id/rounds/:roundId/unlock
POST /api/v1/sessions/:id/answers
POST /api/v1/sessions/:id/rounds/:roundId/complete
GET  /api/v1/sessions/:id/rounds/:roundId/handoff
POST /api/v1/sessions/:id/rounds/:roundId/assessments
POST /api/v1/sessions/:id/rounds
GET  /api/v1/sessions/:id/export
```

There is deliberately no `/generate` provider API in MVP.

## 16. Completion gates

MVP is not complete until automated tests prove: task content remains hidden before unlock; unlock is idempotent; elapsed time comes from server timestamps; completed attempt answers cannot be silently edited; handoff is deterministic and hashable; new attempts preserve history; schema-invalid manually generated assessment/round output is rejected; and export contains definition/scorecard/context/prompt provenance.

The generic bootstrap is not complete until fixtures prove all three evidence maturity modes can produce schema-valid leadership contexts without changing runtime code.
