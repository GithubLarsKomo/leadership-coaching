# PRODUCT — Leadership Assessment Coaching

## Product purpose

Leadership Assessment Coaching is a reusable web application for evidence-based leadership assessment, timed simulations and adaptive coaching. It separates candidate evidence from interpretation and supports human review as well as optional LLM-assisted assessment and next-round generation.

PES/SGL Schleswig-Holstein is the first domain pack. The application itself must remain generic enough for other leadership roles and development programs.

## Primary users

### Candidate
Receives locked exercises, explicitly unlocks a task, answers under server-authoritative timing and completes an attempt. The candidate never sees hidden scorecard weights, evaluator prompts or expected answers during an assessment.

### Coach / assessor
Creates or selects an assessment session, reviews raw evidence, timing, assessments and development trends, accepts or revises derived assessments, and controls whether the next round is generated, regenerated or supplied manually.

## Product principles

1. **Evidence before interpretation.** Raw task, answers, timestamps and handoffs are immutable evidence. Assessment is separately versioned.
2. **Server-authoritative timing.** Unlock and completion use database timestamps. Browser clocks are never authoritative.
3. **Locked-by-default tasks.** Candidate-facing task content is not returned before unlock when `revealOnUnlock=true`.
4. **Attempts, not destructive retries.** Repetition creates a new attempt and preserves earlier performance.
5. **Fixed scorecards.** Assessment dimensions and weights are versioned independently of a candidate and cannot be silently adapted to improve fit.
6. **LLM-agnostic workflow.** Prompt contracts, JSON schemas and generation provenance are provider-neutral.
7. **Human override without history loss.** Coach corrections are new revisions, not overwrites.
8. **Domain packs, not forks.** PES/SGL is content and configuration, not application-specific branching.

## Session modes

- `baseline`: no coaching during the measurement block; feedback normally after the block or session.
- `training`: adaptive exercises with coaching feedback between rounds.
- `simulation`: realistic assessment conditions without in-task support.
- `final-assessment`: standardized final measurement with restricted adaptive variation.

## MVP outcome

The MVP is complete when a coach can load the PES/SGL definition, create a session, present a locked first round, unlock it with a database timestamp, collect and version answers, complete the attempt, calculate elapsed time, export an immutable raw handoff, import or create a structured assessment, and prepare a locked next round.

Direct LLM API integration is intentionally not required for the first vertical slice; prompt input/output can initially be copied manually so the domain and audit contracts can be validated independently of a model provider.
