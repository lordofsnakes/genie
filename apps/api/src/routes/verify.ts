import { Hono } from 'hono';
import { z } from 'zod';
import { db, users, eq } from '@genie/db';
import { invalidateContextCache, resolveUserId } from './chat';

export const verifyRoute = new Hono();

// D-03: Backend trusts BFF — accepts only userId + nullifier_hash (no proof fields)
const proofSchema = z.object({
  userId: z.string().min(1),
  nullifier_hash: z.string().min(1),
});

verifyRoute.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = proofSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'INVALID_INPUT', message: 'Missing or invalid proof fields' }, 400);
  }

  const { userId: rawUserId, nullifier_hash } = parsed.data;

  // Resolve wallet address → internal UUID (same as chat route — session.user.id is wallet address)
  const userId = await resolveUserId(rawUserId);
  if (!userId) {
    return c.json({ error: 'USER_NOT_FOUND', message: 'Could not resolve userId' }, 404);
  }

  // Check if user exists and is not already verified
  const [existing] = await db.select({ worldId: users.worldId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) {
    return c.json({ error: 'USER_NOT_FOUND' }, 404);
  }
  if (existing.worldId !== null) {
    return c.json({ error: 'ALREADY_VERIFIED', message: 'This account is already verified with World ID' }, 409);
  }

  // D-03: Store nullifier_hash in users.worldId (BFF already validated with World ID Cloud API)
  await db.update(users).set({ worldId: nullifier_hash }).where(eq(users.id, userId));

  // Invalidate context cache so isVerified updates immediately
  invalidateContextCache(userId);

  console.log(`[route:verify] user ${userId} verified with World ID`);
  return c.json({ success: true });
});
