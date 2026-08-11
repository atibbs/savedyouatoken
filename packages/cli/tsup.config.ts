import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // The core package is TypeScript source shared with the web app and the tests, so it is
  // bundled in rather than published separately.
  noExternal: ['@savedyouatoken/core'],
  banner: { js: '#!/usr/bin/env node' },
});
