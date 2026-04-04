import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MEMORY,
  encodeKvKey,
  encodeKvValue,
  decodeKvValue,
  type AgentMemory,
} from './types';

describe('DEFAULT_MEMORY', () => {
  it('has empty financialProfile object', () => {
    expect(DEFAULT_MEMORY.financialProfile).toEqual({});
  });

  it('has empty preferences object', () => {
    expect(DEFAULT_MEMORY.preferences).toEqual({});
  });

  it('has empty activeGoals array', () => {
    expect(DEFAULT_MEMORY.activeGoals).toEqual([]);
  });

  it('has updatedAt as ISO string', () => {
    expect(DEFAULT_MEMORY.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
    );
  });
});

describe('encodeKvKey', () => {
  it('returns a Uint8Array of the UTF-8 bytes', () => {
    const key = 'user:abc:memory';
    const result = encodeKvKey(key);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(result).toString('utf-8')).toBe(key);
  });
});

describe('encodeKvValue / decodeKvValue', () => {
  it('round-trips AgentMemory correctly', () => {
    const memory: AgentMemory = {
      financialProfile: {
        monthlyIncome: 5000,
        spendingCategories: ['food', 'rent'],
        riskTolerance: 'moderate',
      },
      preferences: {
        confirmationStyle: 'threshold',
        reminderFrequency: 'weekly',
      },
      activeGoals: [
        {
          id: 'goal-1',
          type: 'savings',
          description: 'Emergency fund',
          targetAmount: 10000,
          currentAmount: 1500,
          createdAt: '2026-04-04T00:00:00.000Z',
        },
      ],
      updatedAt: '2026-04-04T00:00:00.000Z',
    };

    const encoded = encodeKvValue(memory);
    const decoded = decodeKvValue(encoded);
    expect(decoded).toEqual(memory);
  });

  it('returns null for null input', () => {
    expect(decodeKvValue(null)).toBeNull();
  });

  it('returns null for empty string input', () => {
    expect(decodeKvValue('')).toBeNull();
  });
});
