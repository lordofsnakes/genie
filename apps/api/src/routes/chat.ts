import { Hono } from 'hono';
import { runAgent } from '../agent/index';
import { db, users, eq } from '@genie/db';
import { readMemory } from '../kv';
import type { UserContext } from '../agent/context';
import { checkAndSettleDebts, type SettlementNotice } from '../agent/settlement';

export const chatRoute = new Hono();

// 30-minute context cache TTL per session (D-09)
const SESSION_TTL_MS = 30 * 60 * 1000;

interface CachedContext {
  userContext: UserContext;
  fetchedAt: number;
}

const contextCache = new Map<string, CachedContext>();

function getCachedContext(userId: string): UserContext | null {
  const entry = contextCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > SESSION_TTL_MS) {
    contextCache.delete(userId);
    return null;
  }
  return entry.userContext;
}

/** Invalidate cached context for a user so next fetch reloads from DB + KV. Called by update_memory tool after KV write. */
export function invalidateContextCache(userId: string): void {
  contextCache.delete(userId);
  console.log(`[route:chat] context cache invalidated for user ${userId}`);
}

async function fetchUserContext(userId: string): Promise<UserContext> {
  // Check cache first (D-10)
  const cached = getCachedContext(userId);
  if (cached) {
    console.log(`[route:chat] context cache hit for user ${userId}`);
    return cached;
  }

  console.log(`[route:chat] context cache miss — fetching for user ${userId}`);

  // Fetch from Supabase
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    console.warn(`[route:chat] user ${userId} not found — using stub context`);
    return {
      walletAddress: '0x0000000000000000000000000000000000000000',
      displayName: 'User',
      autoApproveUsd: 25,
      isVerified: false,
      isHumanBacked: false,
    };
  }

  // Fetch from 0G KV (graceful — returns null if KV unavailable)
  const memory = await readMemory(userId);

  const userContext: UserContext = {
    walletAddress: user.walletAddress,
    displayName: user.displayName,
    autoApproveUsd: parseFloat(user.autoApproveUsd),
    memory: memory ?? undefined,
    isVerified: user.worldId !== null,
    isHumanBacked: user.worldId !== null,
  };

  // Cache it (D-08)
  contextCache.set(userId, { userContext, fetchedAt: Date.now() });
  return userContext;
}

/**
 * POST /chat — streaming agent endpoint.
 *
 * Returns Server-Sent Events via toUIMessageStreamResponse() (not pipeDataStreamToResponse,
 * which is Node.js-only and crashes on Bun/Hono — Pitfall 3 from RESEARCH).
 */
chatRoute.post('/chat', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, userId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        { error: 'messages array is required and must not be empty' },
        400,
      );
    }

    console.log(`[route:chat] received ${messages.length} messages, userId: ${userId ?? 'none'}`);

    // Fetch user context if userId provided (D-10), otherwise use stub
    const userContext = userId ? await fetchUserContext(userId) : undefined;

    // Phase 5: Auto-settle debts from incoming transfers (DEBT-02, D-09, D-10)
    let settlementNotices: SettlementNotice[] = [];
    if (userId && userContext) {
      try {
        settlementNotices = await checkAndSettleDebts(userId, userContext.walletAddress);
        if (settlementNotices.length > 0) {
          console.log(`[route:chat] settled ${settlementNotices.length} debt(s) for user ${userId}`);
        }
      } catch (err) {
        console.error('[route:chat] settlement check failed (continuing):', err);
      }
    }

    const result = await runAgent({ messages, userId, userContext, settlementNotices });

    // CRITICAL: Use toUIMessageStreamResponse() NOT pipeDataStreamToResponse()
    // pipeDataStreamToResponse is Node.js-specific and crashes on Bun/Hono (Pitfall 3)
    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error('[route:chat] error:', err);
    return c.json({ error: 'Internal server error', message: String(err) }, 500);
  }
});
