import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://librams:librams_dev@localhost:5432/librams',
      ACCESS_TOKEN_SECRET: 'test-access-secret-at-least-32-characters-long',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret-at-least-32-characters-long',
      REDIS_URL: 'redis://localhost:6379',
      MEILISEARCH_HOST: 'http://localhost:7700',
      MEILISEARCH_API_KEY: 'masterKey',
      SENDGRID_API_KEY: 'SG.test-key-for-unit-tests',
      EMAIL_FROM: 'noreply@test.com',
      APP_URL: 'http://localhost:3000',
    },
  },
});
