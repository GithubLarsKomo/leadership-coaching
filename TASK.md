# TASK — Initial vertical MVP

## T1 Repository and runtime
- [x] Product architecture documented
- [x] Vite/React/TypeScript client skeleton
- [x] Node production server skeleton
- [x] Docker/Coolify-compatible runtime on port 3000
- [x] `/healthz`
- [x] CI build/test/docker gate

## T2 Persistence contracts
- [x] Initial PostgreSQL migration with definitions, sessions, rounds, attempts, answers, handoffs, assessments, prompt/generation and audit tables
- [ ] Migration runner
- [ ] DB integration tests
- [ ] Append-only/immutability trigger tests

## T3 Definition contracts
- [x] JSON schemas for assessment definition, round, scorecard, handoff and assessment
- [x] PES/SGL first definition and coaching scorecard
- [ ] AJV validators wired into API
- [ ] Import endpoint and content hashing

## T4 Timed candidate vertical slice
- [ ] Create session
- [ ] Candidate metadata endpoint hides locked content
- [ ] Server-authoritative unlock
- [ ] Versioned autosave answers
- [ ] Complete attempt and freeze answers
- [ ] Deterministic raw handoff + hash
- [ ] Retry creates a new attempt

## T5 Assessment and adaptive rounds
- [x] Versioned bootstrap prompt contract
- [x] Versioned assess-round prompt contract
- [x] Versioned next-round prompt contract
- [ ] Manual structured assessment import
- [ ] Manual next-round import
- [ ] Development-state projection
- [ ] Provider-neutral structured generation interface
- [ ] First provider adapter after manual workflow validation

## T6 UX
- [x] Candidate/coach shell
- [ ] Candidate task unlock/countdown/answer flow
- [ ] Coach evidence and assessment review
- [ ] Trend and retest visualization
- [ ] Accessibility and responsive acceptance

## T7 Deployment
- [ ] Rename repository from `leaderdhip-assessment-coaching` to `leadership-assessment-coaching`
- [ ] Provision `leadership_assessment` PostgreSQL database and least-privilege runtime role
- [ ] Configure Coolify application from `main`
- [ ] Configure upstream authentication boundary
- [ ] Production smoke test `/healthz` and application shell
