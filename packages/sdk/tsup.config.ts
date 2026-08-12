import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: true,
  clean: true,
  // The core package is TypeScript source shared with the web app, CLI and tests, so it is
  // bundled in rather than published separately — guaranteeing identical analysis logic.
  noExternal: ['@savedyouatoken/core'],
});
