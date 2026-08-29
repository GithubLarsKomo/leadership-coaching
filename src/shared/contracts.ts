export type SessionMode = 'baseline' | 'training' | 'simulation' | 'final-assessment';
export type EvidenceClass = 'verified' | 'supported-inference' | 'unknown' | 'contradicted';
export type AttemptStatus = 'locked' | 'active' | 'completed' | 'abandoned';

export interface GenerationProvenance {
  promptId: string;
  promptVersion: string;
  provider: string;
  model: string;
  generatedAt: string;
  inputHash: `sha256:${string}`;
  outputHash: `sha256:${string}`;
}
