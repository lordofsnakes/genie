import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @genie/db for contacts queries
vi.mock('@genie/db', () => ({
  db: {
    select: vi.fn(),
  },
  contacts: {},
  eq: vi.fn(),
}));

import { createResolveContactTool } from './resolve-contact';
import { db } from '@genie/db';

const mockDbSelect = db.select as ReturnType<typeof vi.fn>;

// Helper to set up a DB select chain that returns given rows
function mockDbReturning(rows: object[]) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

const USER_ID = 'user-123';

describe('createResolveContactTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns raw 0x address immediately without any API/DB calls when input is 0x and 42 chars', async () => {
    const address = '0x1234567890123456789012345678901234567890';
    const tool = createResolveContactTool(USER_ID);
    const result = await tool.execute({ recipient: address }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ resolved: true, address, source: 'direct' });
    expect(fetch).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('calls World Username API and returns address when API returns 200', async () => {
    const worldAddress = '0xWorld00000000000000000000000000000000001';
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ address: worldAddress }),
    });
    const tool = createResolveContactTool(USER_ID);
    const result = await tool.execute({ recipient: 'alice.world' }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      resolved: true,
      address: worldAddress,
      source: 'world_username',
    });
  });

  it('falls back to DB contacts search when World API returns 404', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    });
    mockDbReturning([
      { displayName: 'Bob', walletAddress: '0xBob0000000000000000000000000000000000001', id: 'c1', ownerUserId: USER_ID, genieUserId: null, createdAt: new Date() },
    ]);
    const tool = createResolveContactTool(USER_ID);
    const result = await tool.execute({ recipient: 'Bob' }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      resolved: true,
      source: 'contact',
      address: '0xBob0000000000000000000000000000000000001',
    });
  });

  it('returns multiple matches with wallet snippets when DB returns more than 1 contact', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    mockDbReturning([
      { displayName: 'Alice', walletAddress: '0xAlice000000000000000000000000000000001A', id: 'c1', ownerUserId: USER_ID, genieUserId: null, createdAt: new Date() },
      { displayName: 'Alice Smith', walletAddress: '0xAlice000000000000000000000000000000002A', id: 'c2', ownerUserId: USER_ID, genieUserId: null, createdAt: new Date() },
    ]);
    const tool = createResolveContactTool(USER_ID);
    const result = await tool.execute({ recipient: 'Alice' }, { messages: [], toolCallId: 'test' }) as Record<string, unknown>;
    expect(result.resolved).toBe(false);
    expect(result.reason).toBe('multiple_matches');
    const matches = result.matches as Array<{ addressSnippet: string }>;
    expect(matches).toHaveLength(2);
    expect(matches[0].addressSnippet).toMatch(/^0x.+\.\.\..+$/);
  });

  it('returns not_found when no resolution path finds a match', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    mockDbReturning([]);
    const tool = createResolveContactTool(USER_ID);
    const result = await tool.execute({ recipient: 'nobody' }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      resolved: false,
      reason: 'not_found',
    });
  });
});
