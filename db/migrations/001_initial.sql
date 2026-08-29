BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE assessment_definition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scorecard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scorecard_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id uuid NOT NULL REFERENCES scorecard(id) ON DELETE RESTRICT,
  version text NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT 'system',
  UNIQUE(scorecard_id, version),
  UNIQUE(scorecard_id, content_hash)
);

CREATE TABLE assessment_definition_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_definition_id uuid NOT NULL REFERENCES assessment_definition(id) ON DELETE RESTRICT,
  version text NOT NULL,
  scorecard_version_id uuid NOT NULL REFERENCES scorecard_version(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT 'system',
  UNIQUE(assessment_definition_id, version),
  UNIQUE(assessment_definition_id, content_hash)
);

CREATE TABLE assessment_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_version_id uuid NOT NULL REFERENCES assessment_definition_version(id) ON DELETE RESTRICT,
  scorecard_version_id uuid NOT NULL REFERENCES scorecard_version(id) ON DELETE RESTRICT,
  subject_ref text NOT NULL,
  label text,
  mode text NOT NULL CHECK (mode IN ('baseline','training','simulation','final-assessment')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  owner_actor text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session_round (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES assessment_session(id) ON DELETE RESTRICT,
  round_index integer NOT NULL CHECK (round_index >= 1),
  round_key text NOT NULL,
  payload jsonb NOT NULL,
  source text NOT NULL CHECK (source IN ('definition','generated','manual')),
  reveal_on_unlock boolean NOT NULL DEFAULT true,
  time_limit_seconds integer CHECK (time_limit_seconds IS NULL OR time_limit_seconds > 0),
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','active','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, round_index),
  UNIQUE(session_id, round_key)
);

CREATE TABLE round_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_round_id uuid NOT NULL REFERENCES session_round(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES assessment_session(id) ON DELETE RESTRICT,
  attempt_no integer NOT NULL CHECK (attempt_no >= 1),
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','active','completed','abandoned')),
  unlocked_at timestamptz,
  completed_at timestamptz,
  elapsed_ms bigint GENERATED ALWAYS AS (
    CASE WHEN unlocked_at IS NOT NULL AND completed_at IS NOT NULL
      THEN (extract(epoch FROM (completed_at - unlocked_at)) * 1000)::bigint
      ELSE NULL END
  ) STORED,
  completed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR unlocked_at IS NOT NULL),
  CHECK (completed_at IS NULL OR completed_at >= unlocked_at),
  UNIQUE(session_round_id, attempt_no)
);

CREATE UNIQUE INDEX uq_active_attempt_per_round ON round_attempt(session_round_id) WHERE status = 'active';

CREATE TABLE answer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_attempt_id uuid NOT NULL REFERENCES round_attempt(id) ON DELETE RESTRICT,
  question_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(round_attempt_id, question_key)
);

CREATE TABLE answer_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id uuid NOT NULL REFERENCES answer(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision >= 1),
  value jsonb NOT NULL,
  actor text NOT NULL DEFAULT 'candidate',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(answer_id, revision)
);

CREATE TABLE round_handoff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_attempt_id uuid NOT NULL UNIQUE REFERENCES round_attempt(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES assessment_session(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL,
  content_hash text NOT NULL UNIQUE CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE round_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_handoff_id uuid NOT NULL REFERENCES round_handoff(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision >= 1),
  payload jsonb NOT NULL,
  source text NOT NULL CHECK (source IN ('human','llm','hybrid')),
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(round_handoff_id, revision)
);

CREATE TABLE development_state_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES assessment_session(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision >= 1),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  UNIQUE(session_id, revision)
);

CREATE TABLE prompt_definition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text NOT NULL,
  version text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('bootstrap','assess-round','generate-next-round')),
  system_prompt text NOT NULL,
  user_template text NOT NULL,
  input_schema_ref text NOT NULL,
  output_schema_ref text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prompt_key, version)
);

CREATE TABLE generation_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES assessment_session(id) ON DELETE RESTRICT,
  round_attempt_id uuid REFERENCES round_attempt(id) ON DELETE RESTRICT,
  prompt_definition_id uuid NOT NULL REFERENCES prompt_definition(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  model text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_hash text NOT NULL CHECK (input_hash ~ '^sha256:[a-f0-9]{64}$'),
  output_hash text NOT NULL CHECK (output_hash ~ '^sha256:[a-f0-9]{64}$'),
  output_payload jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('generated','accepted','rejected','error')),
  latency_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_event (
  id bigserial PRIMARY KEY,
  session_id uuid REFERENCES assessment_session(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  actor text NOT NULL DEFAULT 'system',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_round_session ON session_round(session_id, round_index);
CREATE INDEX idx_attempt_session ON round_attempt(session_id, created_at);
CREATE INDEX idx_audit_session ON audit_event(session_id, created_at);
CREATE INDEX idx_generation_session ON generation_event(session_id, created_at);

COMMIT;
