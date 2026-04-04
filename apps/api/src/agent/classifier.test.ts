import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the 'ai' module before imports
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

// Must import after mocks
import { classifyIntent } from './classifier';
import { generateText } from 'ai';

describe('classifyIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "planning" for a financial advice/planning message', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'planning' } as any);
    const result = await classifyIntent('what should I save this month?');
    expect(result).toBe('planning');
  });

  it('returns "action" for a send/transfer message', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'action' } as any);
    const result = await classifyIntent('send $10 to Alice');
    expect(result).toBe('action');
  });

  it('returns "planning" when generateText throws (D-02 default)', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('Network error'));
    const result = await classifyIntent('some message');
    expect(result).toBe('planning');
  });

  it('returns "planning" when generateText returns gibberish (D-02 default)', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'gibberish_response_xyz' } as any);
    const result = await classifyIntent('some ambiguous message');
    expect(result).toBe('planning');
  });
});
