import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: false,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // e2e boots the real AppModule against the local Postgres (denly_test) — one worker keeps runs
    // from racing each other over the same database (testing skill § NestJS e2e).
    fileParallelism: false,
  },
});
