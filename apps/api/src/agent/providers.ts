import { createOpenAI } from '@ai-sdk/openai';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const OG_COMPUTE_URL = requireEnv('OG_COMPUTE_URL');
const OG_API_KEY = requireEnv('OG_API_KEY');
export const PLANNING_MODEL = requireEnv('OG_PLANNING_MODEL');
export const ACTION_MODEL = requireEnv('OG_ACTION_MODEL');

// 0G Compute Adapter exposes an OpenAI-compatible API at /v1
// compatibility: 'compatible' strips OpenAI-specific fields the adapter doesn't support
const og = createOpenAI({
  baseURL: `${OG_COMPUTE_URL}/v1`,
  apiKey: OG_API_KEY,
  compatibility: 'compatible',
});

// Use .chat() to force /v1/chat/completions (not /v1/responses which 0G doesn't support)
// structuredOutputs: false prevents sending response_format the upstream rejects
export const glm5 = og.chat(PLANNING_MODEL, { structuredOutputs: false });
export const deepseekV3 = og.chat(ACTION_MODEL, { structuredOutputs: false });
