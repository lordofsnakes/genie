import { describe, it, expect } from 'vitest';
import { getBalanceTool } from './get-balance';

describe('getBalanceTool', () => {
  it('has a description containing "USDC"', () => {
    expect(getBalanceTool.description).toContain('USDC');
  });

  it('has inputSchema and execute function', () => {
    expect(getBalanceTool.inputSchema).toBeDefined();
    expect(typeof getBalanceTool.execute).toBe('function');
  });

  it('execute() returns stub balance object', async () => {
    const result = await getBalanceTool.execute({}, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({
      balance: '100.00',
      currency: 'USDC',
      chain: 'World Chain',
    });
  });
});
