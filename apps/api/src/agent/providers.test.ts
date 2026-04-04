import { describe, it, expect } from 'vitest';
import { glm5, deepseekV3, OG_COMPUTE_URL, PLANNING_MODEL, ACTION_MODEL } from './providers';

describe('0G Compute providers', () => {
  it('exports glm5 and it is truthy', () => {
    expect(glm5).toBeTruthy();
  });

  it('exports deepseekV3 and it is truthy', () => {
    expect(deepseekV3).toBeTruthy();
  });

  it('reads OG_COMPUTE_URL from environment', () => {
    expect(OG_COMPUTE_URL).toBe(process.env.OG_COMPUTE_URL);
  });

  it('reads model IDs from environment', () => {
    expect(PLANNING_MODEL).toBe(process.env.OG_PLANNING_MODEL);
    expect(ACTION_MODEL).toBe(process.env.OG_ACTION_MODEL);
  });
});
