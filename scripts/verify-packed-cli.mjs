#!/usr/bin/env node
// Packs the CLI, installs the tarball into a throwaway project exactly as a user would,
// then exercises it through npm's generated `savedyouatoken` shim — NOT dist/index.js
// directly — so a missing or wrong `bin` entry is caught. Runs `--version` (asserting the
// injected version) and one real audit end to end. Also catches missing runtime deps.
//
// Usage:
//   node scripts/verify-packed-cli.mjs            # pack current source, then verify
//   node scripts/verify-packed-cli.mjs <tarball>  # verify an already-built tarball
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join, resolve } from 'node:path';

const cliDir = fileURLToPath(new URL('../packages/cli/', import.meta.url));
const expected = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8')).version;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts });

const work = mkdtempSync(join(tmpdir(), 'syat-cli-'));

const argTarball = process.argv[2];
const tarball = argTarball
  ? isAbsolute(argTarball)
    ? argTarball
    : resolve(process.cwd(), argTarball)
  : join(work, run('npm', ['pack', cliDir, '--pack-destination', work, '--silent']).trim().split('\n').pop());

// A clean consumer project — npm install pulls the tarball's declared deps from the registry.
writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'syat-verify', private: true }));
run('npm', ['install', tarball, '--no-audit', '--no-fund', '--silent'], { cwd: work });

// Exercise the installed command via npm's bin shim, not the raw file.
const shim = join(work, 'node_modules', '.bin', 'savedyouatoken');

const reported = run(shim, ['--version']).trim();
if (reported !== expected) {
  console.error(`✗ installed CLI reports "${reported}" but package.json is "${expected}"`);
  process.exit(1);
}

// One real audit end to end through the shim.
const promptFile = join(work, 'prompt.txt');
writeFileSync(
  promptFile,
  'You are a helpful assistant. Please always be polite and thorough in your responses.\n',
);
const audit = run(shim, [promptFile, '--model', 'claude-sonnet-5', '--requests', '100']);
if (!/token|\$/.test(audit)) {
  console.error('✗ audit produced no recognizable cost/token output:\n' + audit);
  process.exit(1);
}

const legacyJson = JSON.parse(run(shim, [promptFile, '--model', 'claude-sonnet-5', '--json']));
if (legacyJson.model !== 'claude-sonnet-5' || !Array.isArray(legacyJson.files) || legacyJson.contract) {
  console.error('✗ legacy --json automation shape changed unexpectedly');
  process.exit(1);
}

// The additive portable output must parse as one prompt-free contract document while the legacy
// --json mode above remains untouched for existing automation.
const contractOutput = run(shim, [
  promptFile,
  '--model',
  'claude-sonnet-5',
  '--requests',
  '100',
  '--contract-json',
  '--workflow',
  'verify/cli',
  '--release',
  'packed-test',
]).trim();
const contract = JSON.parse(contractOutput);
if (
  contract?.contract?.kind !== 'report' ||
  contract?.contract?.version?.major !== 1 ||
  contract?.workflow?.id !== 'verify/cli' ||
  contract?.release?.id !== 'packed-test'
) {
  console.error('✗ --contract-json did not produce the expected report envelope:\n' + contractOutput);
  process.exit(1);
}
if (contractOutput.includes('You are a helpful assistant')) {
  console.error('✗ --contract-json leaked prompt text');
  process.exit(1);
}

console.log(`✓ installed CLI shim reports ${expected}, runs an audit, and emits a portable report`);
