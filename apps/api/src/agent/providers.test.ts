import { describe, it, expect } from 'vitest';
import { glm5, deepseekV3, OG_COMPUTE_URL } from './providers';

describe('0G Compute providers', () => {
  it('exports glm5 and it is truthy', () => {
    expect(glm5).toBeTruthy();
  });

  it('exports deepseekV3 and it is truthy', () => {
    expect(deepseekV3).toBeTruthy();
  });

  it('OG_COMPUTE_URL defaults to compute-network-1.integratenetwork.work when env not set', () => {
    // When OG_COMPUTE_URL env var is not set, the default should be the hosted 0G URL
    const expectedDefault = 'https://compute-network-1.integratenetwork.work';
    // The exported constant reflects whatever was read at module load time
    // In test environment without OG_COMPUTE_URL set, it should equal the default
    if (!process.env.OG_COMPUTE_URL) {
      expect(OG_COMPUTE_URL).toBe(expectedDefault);
    } else {
      // If env var is set, the constant should match the env var
      expect(OG_COMPUTE_URL).toBe(process.env.OG_COMPUTE_URL);
    }
  });
});
