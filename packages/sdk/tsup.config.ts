import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  // Declarations are emitted separately by scripts/emit-dts.mjs (tsc + a self-contained copy
  // of core's types + import rewrite), because core ships TypeScript source with no built .d.ts
  // and is never published — so the bundler-based dts paths leave a dangling
  // `import ... from '@savedyouatoken/core'` that would give consumers TS2307.
  dts: false,
  clean: true,
  // The core package is TypeScript source shared with the web app, CLI and tests, so it is
  // bundled in rather than published separately — guaranteeing identical analysis logic.
  noExternal: ['@savedyouatoken/core'],
  define: { __SDK_VERSION__: JSON.stringify(version) },
});
