import { tool } from 'ai';
import { z } from 'zod';

/**
 * get_balance tool — Phase 1 stub.
 * Returns a hardcoded USDC balance on World Chain.
 * Real implementation wired in Phase 2 with on-chain balance lookup.
 *
 * CRITICAL: Uses inputSchema (not parameters) per Vercel AI SDK v6 (Pitfall 2).
 */
export const getBalanceTool = tool({
  description: "Get the user's current USDC balance on World Chain.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      // Phase 1: stub — returns hardcoded value
      console.log('[tool:get_balance] called — returning stub balance');
      return { balance: '100.00', currency: 'USDC', chain: 'World Chain' };
    } catch (err) {
      console.error('[tool:get_balance] error:', err);
      return { error: 'FETCH_FAILED', message: 'Could not retrieve balance at this time.' };
    }
  },
});
