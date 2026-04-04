import { describe, it, expect } from 'vitest';
import { assembleContext } from './context';
import type { UserContext } from './context';
import type { CoreMessage } from 'ai';

const mockUserContext: UserContext = {
  walletAddress: '0xABC',
  displayName: 'Alice',
  autoApproveUsd: 25,
};

const mockSystemPrompt = 'You are Genie. Current date: 2026-04-04';

const mockHistory: CoreMessage[] = [
  { role: 'user', content: 'What is my balance?' },
  { role: 'assistant', content: 'Your balance is 100 USDC.' },
];

describe('assembleContext', () => {
  it('returns system string equal to the passed systemPrompt', () => {
    const result = assembleContext(mockSystemPrompt, mockUserContext, [], 'hello');
    expect(result.system).toBe(mockSystemPrompt);
  });

  it('messages start with user context injection, then assistant ack, then current user message (empty history)', () => {
    const result = assembleContext(mockSystemPrompt, mockUserContext, [], 'What can you do?');
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[2].role).toBe('user');
    expect(result.messages[2].content).toBe('What can you do?');
  });

  it('user context injection contains wallet address and display name', () => {
    const result = assembleContext(mockSystemPrompt, mockUserContext, [], 'hello');
    const contextMsg = result.messages[0];
    expect(contextMsg.content).toContain('0xABC');
    expect(contextMsg.content).toContain('Alice');
    expect(contextMsg.content).toContain('25');
  });

  it('messages with history: context injection + ack + history + current message', () => {
    const result = assembleContext(mockSystemPrompt, mockUserContext, mockHistory, 'Next question');
    // context injection (1) + assistant ack (1) + history (2) + current (1) = 5
    expect(result.messages).toHaveLength(5);
    expect(result.messages[0].role).toBe('user'); // context injection
    expect(result.messages[1].role).toBe('assistant'); // ack
    expect(result.messages[2].content).toBe('What is my balance?'); // history[0]
    expect(result.messages[3].content).toBe('Your balance is 100 USDC.'); // history[1]
    expect(result.messages[4].content).toBe('Next question'); // current
  });
});
