import { createOpenAI } from '@ai-sdk/openai';

export const OG_COMPUTE_URL =
  process.env.OG_COMPUTE_URL ?? 'https://compute-network-1.integratenetwork.work';

const OG_API_KEY = process.env.OG_API_KEY ?? 'app-sk-placeholder';

// Phase 1: static OG_API_KEY mode — @0glabs/0g-serving-broker and ethers deferred to Phase 2
const og = createOpenAI({
  baseURL: `${OG_COMPUTE_URL}/v1/proxy`,
  apiKey: OG_API_KEY,
});

// GLM-5: planning and advisory responses
export const glm5 = og('zai-org/GLM-5-FP8');

// DeepSeek V3: fast tool execution
export const deepseekV3 = og('deepseek-chat-v3-0324');
