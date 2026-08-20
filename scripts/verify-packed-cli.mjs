#!/usr/bin/env node
// Packs the CLI, installs the tarball into a throwaway project exactly as a user would,
// then exercises it through npm's generated `savedyouatoken` shim — NOT dist/index.js
// directly — so a missing or wrong `bin` entry is caught. Runs `--version` (asserting the
// injected version) and one real audit end to end. Also catches missing runtime deps.
//
// Usage:
//   node scripts/verify-packed-cli.mjs            # pack current source, then verify
//   node scripts/verify-packed-cli.mjs <tarball>  # verify an already-built tarball
import { execFileSync, spawn } from 'node:child_process';
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

// The regression workflow (discover/baseline/compare/policy) must also work through the packed,
// installed shim — not just from source — since it is bundled the same way as the default
// command and a missing/unbundled import would only surface here.
const discoverOutput = run(shim, ['discover', work, '--json']);
const discovered = JSON.parse(discoverOutput);
if (discovered.schema !== 'savedyouatoken.cli/discovery') {
  console.error('✗ discover --json did not produce the expected schema:\n' + discoverOutput);
  process.exit(1);
}

const baselinePath = join(work, 'baseline.json');
run(shim, ['baseline', 'create', promptFile, '--workflow', 'verify/regression', '--out', baselinePath]);
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
if (baseline.baseline?.contract?.kind !== 'baseline' || !/^sha256:[a-f0-9]{64}$/.test(baseline.baseline.reportId)) {
  console.error('✗ baseline create did not produce a valid baseline bundle');
  process.exit(1);
}
if (JSON.stringify(baseline).includes('You are a helpful assistant')) {
  console.error('✗ baseline bundle leaked prompt text');
  process.exit(1);
}

const compareOutput = run(shim, [
  'compare',
  promptFile,
  '--model',
  'claude-sonnet-5',
  '--requests',
  '100',
  '--baseline',
  baselinePath,
  '--json',
]);
const compared = JSON.parse(compareOutput);
if (compared.schema !== 'savedyouatoken.cli/compare' || compared.diff.compatibility.status === 'invalid') {
  console.error('✗ compare against its own just-created baseline should be compatible:\n' + compareOutput);
  process.exit(1);
}

const policyPath = join(work, 'policy.json');
run(shim, ['policy', 'generate', '--baseline', baselinePath, '--out', policyPath]);
const checkOutput = run(shim, [
  'policy',
  'check',
  promptFile,
  '--model',
  'claude-sonnet-5',
  '--requests',
  '100',
  '--policy',
  policyPath,
  '--baseline',
  baselinePath,
  '--json',
]);
const checked = JSON.parse(checkOutput);
if (checked.schema !== 'savedyouatoken.cli/policy-check' || checked.outcome !== 'pass') {
  console.error('✗ policy check against a freshly generated policy should pass:\n' + checkOutput);
  process.exit(1);
}

// The local monitoring workbench — its store commands (no server needed) and, briefly, the
// actual HTTP server — must also work through the packed, installed shim.
const wbDir = join(work, 'workbench-data');
const wbReportPath = join(work, 'workbench-report.json');
writeFileSync(
  wbReportPath,
  run(shim, [promptFile, '--contract-json', '--workflow', 'verify/workbench', '--release', 'packed-test']),
);
const wbImport = run(shim, ['workbench', 'import', wbReportPath, '--data-dir', wbDir]);
const wbReportId = wbImport.match(/\((sha256:[a-f0-9]{64})\)/)?.[1];
if (!wbReportId) {
  console.error('✗ workbench import did not report a content-hash id:\n' + wbImport);
  process.exit(1);
}
run(shim, ['workbench', 'approve', '--report', wbReportId, '--acknowledge-provisional', '--data-dir', wbDir]);
const wbPolicyPath = join(work, 'workbench-policy.json');
run(shim, ['workbench', 'export', '--workflow', 'verify/workbench', '--out', wbPolicyPath, '--data-dir', wbDir]);
const wbPolicy = JSON.parse(readFileSync(wbPolicyPath, 'utf8'));
if (wbPolicy?.contract?.kind !== 'policy' || wbPolicy?.baselineId !== wbReportId) {
  console.error('✗ workbench export did not produce the expected policy:\n' + JSON.stringify(wbPolicy));
  process.exit(1);
}
if (JSON.stringify(wbPolicy).includes('You are a helpful assistant')) {
  console.error('✗ workbench-exported policy leaked prompt text');
  process.exit(1);
}

// Retries the health check briefly: the child announces its URL as soon as the server's
// 'listening' event fires, but the npm bin shim (a symlink through an extra process boundary,
// unlike a direct `node dist/index.js` invocation) can leave a very short window where the
// stdout message has flushed just ahead of the OS actually being ready to accept a connection
// from a *different* process. A few short retries absorb that without masking a real failure —
// this is a live server, not a mock, so an actually-broken bundle still fails outright.
async function fetchWithRetry(url, attempts = 5, delayMs = 100) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

await new Promise((resolveServer, rejectServer) => {
  const child = spawn(shim, ['workbench', 'start', '--port', '0', '--data-dir', join(work, 'workbench-live')]);
  let buffer = '';
  const timeout = setTimeout(() => rejectServer(new Error(`workbench start did not report a URL in time:\n${buffer}`)), 8000);
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const match = buffer.match(/Workbench running at (http:\/\/127\.0\.0\.1:\d+)/);
    if (!match) return;
    clearTimeout(timeout);
    fetchWithRetry(`${match[1]}/api/health`)
      .then((res) => {
        if (res.status !== 200) throw new Error(`/api/health returned ${res.status}`);
        return res.json();
      })
      .then((body) => {
        if (!body.ok) throw new Error(`/api/health body was not ok: ${JSON.stringify(body)}`);
        child.once('exit', (code) => (code === 0 ? resolveServer() : rejectServer(new Error(`workbench exited ${code} on SIGTERM`))));
        child.kill('SIGTERM');
      })
      .catch(rejectServer);
  });
  child.stderr.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
  });
  child.once('error', rejectServer);
});

console.log(
  `✓ installed CLI shim reports ${expected}, runs an audit, emits a portable report, runs the ` +
    'discover/baseline/compare/policy regression workflow, and runs the workbench (store commands and a live server)',
);
