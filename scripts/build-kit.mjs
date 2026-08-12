#!/usr/bin/env node
// Packages kit/ into the distributable archive uploaded to Gumroad, then verifies the
// archive contains exactly the kit source files (no more, no less). Combined with the
// launcher-not-snapshot guard test (which scans kit/ source), this proves the shipped
// archive is guard-clean — it contains only files that passed the no-prices check.
//
// Run from the repo root: node scripts/build-kit.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const kitDir = join(root, 'kit');
const outDir = join(root, 'kit-dist');
const archive = join(outDir, 'cost-aware-agent-kit.zip');

function kitEntries() {
  return readdirSync(kitDir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(kitDir, join(e.parentPath ?? kitDir, e.name)))
    .sort();
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Zip with paths relative to kit/ so the archive root is the kit contents, not a kit/ folder.
// -X drops extra file attributes for a more reproducible archive.
execFileSync('zip', ['-r', '-X', '-q', archive, '.', '-x', '.*'], { cwd: kitDir });

// Verify: the archive's file list must equal the kit source file list.
const zipped = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => s && !s.endsWith('/'))
  .sort();

const source = kitEntries();
const missing = source.filter((f) => !zipped.includes(f));
const extra = zipped.filter((f) => !source.includes(f));

if (missing.length || extra.length) {
  if (missing.length) console.error('✗ archive is missing kit files:', missing);
  if (extra.length) console.error('✗ archive has files not in kit/:', extra);
  process.exit(1);
}

console.log(`✓ built ${relative(root, archive)} — ${zipped.length} files, matches kit/ exactly`);
