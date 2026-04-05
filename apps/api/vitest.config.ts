import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './src',
    environment: 'node',
    env: {
      OG_COMPUTE_URL: 'http://localhost:8000',
      OG_API_KEY: 'test-key',
      OG_PLANNING_MODEL: 'test-planning-model',
      OG_ACTION_MODEL: 'test-action-model',
      OG_KV_CLIENT_URL: 'http://localhost:6789',
      OG_KV_STREAM_ID: '0xtest-stream-id',
      RELAYER_PRIVATE_KEY: '0x0000000000000000000000000000000000000000000000000000000000000001',
      WORLD_CHAIN_RPC_URL: 'http://localhost:8545',
      WORLD_CHAIN_TESTNET: 'true',
      WORLD_APP_ID: 'app_test123',
      WORLD_ACTION: 'verify-human',
      WORLD_VERIFY_API_URL: 'https://developer.world.org/api/v2/verify',
    },
  },
});
