import { describe, expect, it } from 'vitest';
import scorecard from '../assessments/pes-sgl-sh/scorecard.json';

describe('PES/SGL scorecard', () => {
  it('has weights summing to 1.0', () => {
    const sum = scorecard.dimensions.reduce((total, dimension) => total + dimension.weight, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('uses stable unique dimension ids', () => {
    const ids = scorecard.dimensions.map((dimension) => dimension.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
