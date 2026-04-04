import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUpdateMemoryTool } from './update-memory';
import type { AgentMemory } from '../kv/types';
import { DEFAULT_MEMORY } from '../kv/types';

// Mock writeMemory and invalidateContextCache
vi.mock('../kv', () => ({
  writeMemory: vi.fn().mockResolvedValue(true),
}));
vi.mock('../routes/chat', () => ({
  invalidateContextCache: vi.fn(),
}));

describe('update-memory tool', () => {
  let baseMem: AgentMemory;

  beforeEach(() => {
    baseMem = JSON.parse(JSON.stringify(DEFAULT_MEMORY));
    vi.clearAllMocks();
  });

  it('merges financialProfile fields', async () => {
    const t = createUpdateMemoryTool('user-1', baseMem);
    const result = await t.execute(
      { financialProfile: { monthlyIncome: 5000 } },
      { toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal },
    );
    expect(result.success).toBe(true);
    expect(baseMem.financialProfile.monthlyIncome).toBe(5000);
  });

  it('adds a goal via addGoal', async () => {
    const t = createUpdateMemoryTool('user-1', baseMem);
    const result = await t.execute(
      { addGoal: { type: 'savings', description: 'Save for vacation', targetAmount: 2000 } },
      { toolCallId: 'tc2', messages: [], abortSignal: new AbortController().signal },
    );
    expect(result.success).toBe(true);
    expect(baseMem.activeGoals).toHaveLength(1);
    expect(baseMem.activeGoals[0].type).toBe('savings');
    expect(baseMem.activeGoals[0].description).toBe('Save for vacation');
    expect(baseMem.activeGoals[0].id).toBeTruthy();
  });

  it('removes a goal via removeGoalId', async () => {
    baseMem.activeGoals = [{ id: 'g1', type: 'savings', description: 'test', createdAt: '' }];
    const t = createUpdateMemoryTool('user-1', baseMem);
    const result = await t.execute(
      { removeGoalId: 'g1' },
      { toolCallId: 'tc3', messages: [], abortSignal: new AbortController().signal },
    );
    expect(result.success).toBe(true);
    expect(baseMem.activeGoals).toHaveLength(0);
  });

  it('calls invalidateContextCache on success', async () => {
    const { invalidateContextCache } = await import('../routes/chat');
    const t = createUpdateMemoryTool('user-1', baseMem);
    await t.execute(
      { preferences: { confirmationStyle: 'always' } },
      { toolCallId: 'tc4', messages: [], abortSignal: new AbortController().signal },
    );
    expect(invalidateContextCache).toHaveBeenCalledWith('user-1');
  });

  it('returns success false when writeMemory fails', async () => {
    const { writeMemory } = await import('../kv');
    (writeMemory as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const t = createUpdateMemoryTool('user-1', baseMem);
    const result = await t.execute(
      { financialProfile: { monthlyIncome: 3000 } },
      { toolCallId: 'tc5', messages: [], abortSignal: new AbortController().signal },
    );
    expect(result.success).toBe(false);
  });
});
