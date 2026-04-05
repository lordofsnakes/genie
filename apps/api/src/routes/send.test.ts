import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB
const mockDbSelect = vi.fn();
const mockDbInsertValues = vi.fn();
const mockDbInsertReturning = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@genie/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@genie/db')>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: mockDbSelect,
          }),
        }),
      }),
      insert: () => ({
        values: (vals: unknown) => {
          mockDbInsertValues(vals);
          return {
            returning: mockDbInsertReturning,
            then: (resolve: (v: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
          };
        },
      }),
      update: () => ({
        set: () => ({
          where: mockDbUpdate,
        }),
      }),
    },
    transactions: {},
    users: {},
    eq: actual.eq,
    and: actual.and,
  };
});

// Mock executeOnChainTransfer
const mockExecuteTransfer = vi.fn();
vi.mock('../chain/transfer', () => ({
  executeOnChainTransfer: (...args: unknown[]) => mockExecuteTransfer(...args),
}));

// Mock bridgeUsdc
const mockBridgeUsdc = vi.fn();
vi.mock('../chain/bridge', () => ({
  bridgeUsdc: (...args: unknown[]) => mockBridgeUsdc(...args),
  CCTP_DOMAIN_IDS: { ethereum: 0, optimism: 2, arbitrum: 3, base: 6 },
}));

// Mock categorize
vi.mock('../tools/categorize', () => ({
  inferCategory: vi.fn(() => 'transfers'),
}));

// Import after mocks
const { sendRoute } = await import('./send');

const app = new Hono();
app.route('/', sendRoute);

const VALID_USER_ID = 'user-uuid-001';
const VALID_RECIPIENT = '0x1234567890123456789012345678901234567890';
const VERIFIED_USER = {
  id: VALID_USER_ID,
  walletAddress: '0xSender0000000000000000000000000000000001',
  worldId: '0xnullifier',
  displayName: 'Alice',
  autoApproveUsd: '25.00',
  createdAt: new Date(),
};
const UNVERIFIED_USER = {
  ...VERIFIED_USER,
  worldId: null,
};

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: user found and verified
  mockDbSelect.mockResolvedValue([VERIFIED_USER]);
  // Default DB insert returning (for pending tx)
  mockDbInsertReturning.mockResolvedValue([{ id: 'tx-new-id' }]);
  // Default DB update resolves
  mockDbUpdate.mockResolvedValue([]);
  // Default transfer success
  mockExecuteTransfer.mockResolvedValue({
    routeTxHash: '0xrouteHash',
    executeTxHash: '0xexecHash',
  });
  // Default bridge success
  mockBridgeUsdc.mockResolvedValue({
    routeTxHash: '0xrouteHash',
    approveTxHash: '0xapproveHash',
    bridgeTxHash: '0xbridgeHash',
  });
});

describe('POST /send', () => {
  it('Test 1: World Chain under-threshold returns 200 transfer_complete', async () => {
    const res = await app.fetch(makeRequest({
      userId: VALID_USER_ID,
      recipient: VALID_RECIPIENT,
      amount: 10, // 10 <= 25 autoApproveUsd
      chain: 'World Chain',
    }));
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.type).toBe('transfer_complete');
    expect(json.txHash).toBe('0xexecHash');
    expect(json.amount).toBe(10);
    expect(json.recipient).toBe(VALID_RECIPIENT);
    expect(mockExecuteTransfer).toHaveBeenCalledWith(
      VERIFIED_USER.walletAddress,
      VALID_RECIPIENT,
      10,
    );
  });

  it('Test 2: World Chain over-threshold returns 200 confirmation_required', async () => {
    const res = await app.fetch(makeRequest({
      userId: VALID_USER_ID,
      recipient: VALID_RECIPIENT,
      amount: 100, // 100 > 25 autoApproveUsd
      chain: 'World Chain',
    }));
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.type).toBe('confirmation_required');
    expect(json.txId).toBeDefined();
    expect(json.amount).toBe(100);
    expect(json.recipient).toBe(VALID_RECIPIENT);
    expect(json.expiresInMinutes).toBe(15);
    expect(mockExecuteTransfer).not.toHaveBeenCalled();
  });

  it('Test 3: cross-chain (Base) calls bridgeUsdc and returns 200 bridge_initiated', async () => {
    const res = await app.fetch(makeRequest({
      userId: VALID_USER_ID,
      recipient: VALID_RECIPIENT,
      amount: 50,
      chain: 'Base',
    }));
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.type).toBe('bridge_initiated');
    expect(json.bridgeTxHash).toBe('0xbridgeHash');
    expect(json.amount).toBe(50);
    expect(json.recipient).toBe(VALID_RECIPIENT);
    expect(mockBridgeUsdc).toHaveBeenCalledWith(
      expect.objectContaining({ destinationChain: 'base', amountUsd: 50 }),
    );
  });

  it('Test 4: invalid recipient (not 0x address) returns 400', async () => {
    const res = await app.fetch(makeRequest({
      userId: VALID_USER_ID,
      recipient: 'not-an-address',
      amount: 10,
      chain: 'World Chain',
    }));
    expect(res.status).toBe(400);
    const json = await res.json() as Record<string, unknown>;
    expect(json.error).toBe('Invalid recipient address');
  });

  it('Test 5: unverified user (worldId=null) returns 403 VERIFICATION_REQUIRED', async () => {
    mockDbSelect.mockResolvedValue([UNVERIFIED_USER]);
    const res = await app.fetch(makeRequest({
      userId: VALID_USER_ID,
      recipient: VALID_RECIPIENT,
      amount: 10,
      chain: 'World Chain',
    }));
    expect(res.status).toBe(403);
    const json = await res.json() as Record<string, unknown>;
    expect(json.error).toBe('VERIFICATION_REQUIRED');
  });

  it('Test 6: missing userId returns 400', async () => {
    const res = await app.fetch(makeRequest({
      recipient: VALID_RECIPIENT,
      amount: 10,
      chain: 'World Chain',
    }));
    expect(res.status).toBe(400);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.error).toBe('string');
  });
});
