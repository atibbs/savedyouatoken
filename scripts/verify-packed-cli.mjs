#!/usr/bin/env node
// Packs the CLI, installs the tarball into a throwaway project exactly as a user would
// (so npm resolves its declared dependencies), runs the installed binary, and asserts it
// reports the tarball's own version. Catches both version drift (the build injects the
// version via tsup define) and missing-runtime-dependency packaging bugs.
// Run from the repo root: node scripts/verify-packed-cli.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const cliDir = fileURLToPath(new URL('../packages/cli/', import.meta.url));
const expected = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8')).version;

const work = mkdtempSync(join(tmpdir(), 'syat-cli-'));
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts });

const tarball = run('npm', ['pack', cliDir, '--pack-destination', work, '--silent']).trim().split('\n').pop();

// A clean consumer project — npm install pulls the tarball's declared deps from the registry.
writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'syat-verify', private: true }));
run('npm', ['install', join(work, tarball), '--no-audit', '--no-fund', '--silent'], { cwd: work });

const bin = join(work, 'node_modules', 'savedyouatoken', 'dist', 'index.js');
const reported = run('node', [bin, '--version']).trim();

if (reported !== expected) {
  console.error(`✗ installed CLI reports "${reported}" but package.json is "${expected}"`);
  process.exit(1);
}
console.log(`✓ installed CLI runs and reports its published version (${expected})`);
