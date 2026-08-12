#!/usr/bin/env node
// Packages kit/ into the distributable archive uploaded to Gumroad, then verifies the
// archive by extracting it and comparing every file's CONTENTS (not just names) against
// the kit source. Combined with the launcher-not-snapshot guard test (which scans kit/
// source for model ids and price tokens), a byte-for-byte match proves the shipped archive
// is guard-clean — packaging can neither add a file nor alter one without failing here.
//
// Run from the repo root: node scripts/build-kit.mjs  (also runs in CI via `npm run build:kit`)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const kitDir = join(root, 'kit');
const outDir = join(root, 'kit-dist');
const archive = join(outDir, 'cost-aware-agent-kit.zip');
const extractDir = join(outDir, '_verify');

function filesUnder(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath ?? dir, e.name)))
    .sort();
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Zip with paths relative to kit/ so the archive root is the kit contents, not a kit/ folder.
// -X drops extra file attributes for a more reproducible archive.
execFileSync('zip', ['-r', '-X', '-q', archive, '.', '-x', '.*'], { cwd: kitDir });

// Extract and verify contents against source.
mkdirSync(extractDir, { recursive: true });
execFileSync('unzip', ['-o', '-q', archive, '-d', extractDir]);

const source = filesUnder(kitDir);
const shipped = filesUnder(extractDir);

const missing = source.filter((f) => !shipped.includes(f));
const extra = shipped.filter((f) => !source.includes(f));
if (missing.length || extra.length) {
  if (missing.length) console.error('✗ archive is missing kit files:', missing);
  if (extra.length) console.error('✗ archive has files not in kit/:', extra);
  process.exit(1);
}

const changed = source.filter(
  (f) => !readFileSync(join(kitDir, f)).equals(readFileSync(join(extractDir, f))),
);
if (changed.length) {
  console.error('✗ archived contents differ from kit/ source (packaging altered files):', changed);
  process.exit(1);
}

rmSync(extractDir, { recursive: true, force: true });
console.log(`✓ built ${relative(root, archive)} — ${shipped.length} files, contents match kit/ exactly`);
