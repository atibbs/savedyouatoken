/**
 * Emit self-contained TypeScript declarations for the published SDK.
 *
 * `@savedyouatoken/core` is bundled into the JS (tsup `noExternal`) but ships raw TypeScript
 * source and is never published to npm, so a normal consumer cannot resolve a bare
 * `import ... from '@savedyouatoken/core'` left in the SDK's `.d.ts` (TS2307). Rather than
 * publish core, we make the declarations self-contained:
 *
 *   1. Emit the SDK's own declarations with `tsc` (these reference '@savedyouatoken/core').
 *   2. Emit a self-contained copy of core's declarations into `dist/_core/`.
 *   3. Rewrite every '@savedyouatoken/core' specifier in the SDK's `.d.ts` files to a
 *      depth-correct relative path into `dist/_core/index`.
 *
 * The result: `npm pack` ships only `dist/`, and a clean consumer type-checks with no
 * dependency on core.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sdkRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(sdkRoot, 'dist');
const coreOut = join(dist, '_core');
// Resolve the compiler through Node so it works regardless of npm workspace hoisting.
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');

function run(args) {
  execFileSync(process.execPath, [tsc, ...args], { cwd: sdkRoot, stdio: 'inherit' });
}

// 1. SDK declarations (src only; tests excluded).
run(['-p', 'tsconfig.dts.json']);

// 2. Self-contained copy of core's declarations. Point tsc at core's entry so it follows the
//    import graph and emits the whole reachable set into dist/_core, with relative imports
//    among the files (no external references).
run([
  '../core/src/index.ts',
  '--declaration',
  '--emitDeclarationOnly',
  '--skipLibCheck',
  '--target',
  'ES2022',
  '--module',
  'ESNext',
  '--moduleResolution',
  'Bundler',
  '--strict',
  '--lib',
  'ES2022,DOM',
  '--outDir',
  coreOut,
]);

// 3. Rewrite the core specifier in every SDK .d.ts (outside dist/_core) to the local copy.
const coreIndex = join(coreOut, 'index');
let rewritten = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (full === coreOut) continue; // Leave the bundled core copy untouched.
      walk(full);
      continue;
    }
    if (!full.endsWith('.d.ts')) continue;
    const before = readFileSync(full, 'utf8');
    if (!before.includes('@savedyouatoken/core')) continue;
    let rel = relative(dirname(full), coreIndex).split(sep).join('/');
    if (!rel.startsWith('.')) rel = './' + rel;
    const after = before.replaceAll(/(['"])@savedyouatoken\/core\1/g, `'${rel}'`);
    if (after !== before) {
      writeFileSync(full, after, 'utf8');
      rewritten++;
    }
  }
}

walk(dist);
console.log(`emit-dts: rewrote core import in ${rewritten} declaration file(s) → dist/_core`);
