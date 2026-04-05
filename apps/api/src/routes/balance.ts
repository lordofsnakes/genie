import { Hono } from 'hono';
import { erc20Abi, formatUnits, isAddress } from 'viem';
import { publicClient, USDC_ADDRESS } from '../chain/clients';

export const balanceRoute = new Hono();

balanceRoute.get('/balance', async (c) => {
  const wallet = c.req.query('wallet');
  if (!wallet || !isAddress(wallet)) {
    return c.json({ error: 'INVALID_WALLET', message: 'wallet query param must be a valid address' }, 400);
  }
  try {
    const raw = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [wallet as `0x${string}`],
    });
    const balance = formatUnits(raw as bigint, 6);
    return c.json({ balance, currency: 'USDC' });
  } catch (err) {
    console.error('[route:balance] error:', err);
    return c.json({ error: 'FETCH_FAILED', message: 'Could not retrieve balance' }, 500);
  }
});
