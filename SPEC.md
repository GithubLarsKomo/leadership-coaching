# SPEC — Leadership Assessment Coaching

**Status:** initial normative product specification  
**Target runtime:** Node.js 22, React/Vite/TypeScript, PostgreSQL, Docker/Coolify

## 1. Scope

The system manages versioned leadership assessment definitions, scorecards, sessions, timed round attempts, versioned answers, immutable raw handoffs, separately versioned assessments, cumulative development state and optional structured LLM generation events.

It is not an automated hiring-decision system. It must not infer protected personal characteristics or use health, religion, political views, sexual orientation, family planning, origin or other irrelevant private information as leadership evidence.

## 2. Core lifecycle

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
  -> Assessment
  -> Development State
  -> Generate/import next Round
  -> next Round locked
```

`complete`, `assess` and `generate-next` are separate operations. Failure of an LLM provider must never lose or invalidate candidate evidence.

## 3. Domain objects

### Assessment Definition
Stable identity across immutable versions. Contains goal, allowed session modes, round-generation policy and references to a scorecard version.

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

### Prompt Definition / Generation Event
Versioned prompt contract plus provider/model provenance, input/output hashes and structured output. Provider metadata must not affect domain contracts.

## 4. Timing contract

### Unlock

`POST /api/v1/sessions/:sessionId/rounds/:roundId/unlock`

The server transaction creates or activates the next attempt and persists `unlocked_at = now()` in PostgreSQL. If already active, unlock is idempotent and returns the original timestamp.

When a round has `revealOnUnlock=true`, the task body/questions must not be returned by pre-unlock candidate endpoints.

### Complete

`POST /api/v1/sessions/:sessionId/rounds/:roundId/complete`

The server validates required visible answers, persists `completed_at = now()`, transitions the attempt to `completed`, derives elapsed milliseconds from database timestamps, freezes the attempt for further edits and creates the raw handoff in the same logical completion transaction.

Browser reload, browser close and device change do not pause time. Pause support, if ever added for training, requires an explicit server-side pause model and is not part of MVP.

## 5. Candidate API boundary

Candidate endpoints may expose only information needed to perform the task. Before unlock they return metadata such as title, status and estimated duration, but no hidden stimulus/questions if reveal-on-unlock is enabled.

Candidate responses must never contain scorecard weights, hidden competency mapping, model prompts, expected answers, assessments or adaptive-generation rationale during an active assessment block.

## 6. Coach API boundary

Coach endpoints can access definition versions, scorecards, raw handoffs, assessments, development state, generation provenance and audit history. Authorization must distinguish candidate and coach capabilities even when initial deployment uses an upstream authentication proxy.

## 7. LLM contracts

The system knows one provider-neutral operation:

```ts
generateStructured({ promptContract, input, outputSchema, generationOptions })
```

Required prompt purposes:

- `bootstrap`: generate an initial exercise from role architecture, scorecard and session mode.
- `assess-round`: evaluate only observable evidence in one immutable handoff.
- `generate-next-round`: create exactly one adaptive next exercise from fixed role/scorecard plus prior handoffs/assessments.

Every generation event stores prompt ID/version, provider, model, settings, generated time, input hash and output hash. Structured output is schema-validated before persistence as an accepted round or assessment.

## 8. Evidence classes

Assessments use exactly:

- `verified`
- `supported-inference`
- `unknown`
- `contradicted`

`unknown` is not a negative score. Timing is contextual evidence only; faster is not automatically better and slower is not automatically worse.

## 9. PES/SGL initial scorecard

Initial coaching dimensions:

- communication — 0.20
- leadership-collaboration — 0.20
- analysis-decision — 0.15
- responsibility — 0.15
- change-innovation — 0.10
- self-management — 0.10
- reflection — 0.10

This is a coaching scorecard based on the working concept. It must not be represented as an official internal Schleswig-Holstein observer matrix unless official evidence is later obtained.

## 10. Persistence and immutability

PostgreSQL is authoritative for session state and timing. Published definition/scorecard versions, completed attempts and raw handoffs are append-only. Reassessment, retry and coach correction create new rows/revisions.

Database access uses `DATABASE_URL`. Production DB is private to the application/network; no public PostgreSQL exposure is required.

## 11. Authentication and privacy

Production is expected to sit behind the existing trusted authentication boundary. The application stores a stable subject reference and actor provenance but should not require names, personnel numbers or other unnecessary identifiers for assessment logic.

No authentication tokens or provider API secrets are stored in handoffs, answers or prompt inputs.

## 12. Deployment

Deployment follows the same operational pattern as Exam Trainer Framework:

- repository `main` is the production branch;
- Dockerfile build in Coolify;
- internal port `3000`;
- `GET /healthz` returns no-store health status;
- HTTPS through reverse proxy;
- automatic deployment after merge to `main`.

Unlike ETF, this app is server-stateful and requires PostgreSQL and therefore must not be treated as a static-only PWA.

## 13. MVP API plan

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

## 14. Completion gates

MVP is not complete until automated tests prove: task content remains hidden before unlock; unlock is idempotent; elapsed time comes from server timestamps; completed attempt answers cannot be silently edited; handoff is deterministic and hashable; new attempts preserve history; schema-invalid assessment/round output is rejected; and export contains definition/scorecard/prompt provenance.
