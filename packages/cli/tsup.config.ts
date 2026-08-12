import { createRequire } from 'node:module';
import { defineConfig } from 'tsup';

// Single-source the CLI version from package.json so the built binary can never disagree
// with the version it is published as.
const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // The core package is TypeScript source shared with the web app and the tests, so it is
  // bundled in rather than published separately.
  noExternal: ['@savedyouatoken/core'],
  banner: { js: '#!/usr/bin/env node' },
  define: { __CLI_VERSION__: JSON.stringify(version) },
});
