/**
 * End-to-end tests against the built `dist/index.js`, the same artifact users run. `pretest`
 * builds it first (see package.json); these never import CLI source directly, so they also
 * catch bundling regressions the way `scripts/verify-packed-cli.mjs` does for the tarball.
 */

import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const cliPath = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const fixture = fileURLToPath(new URL('../../../examples/support-triage.txt', import.meta.url));

function run(args: string[], cwd?: string): SpawnSyncReturns<string> {
  return spawnSync('node', [cliPath, ...args], { encoding: 'utf8', cwd });
}

describe('CLI regression workflow (end to end)', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'savedyouatoken-e2e-'));
  });

  it('leaves the default audit command byte-for-byte compatible', () => {
    const first = run([fixture, '--quiet']);
    const second = run([fixture, '--quiet']);
    expect(first.status).toBe(0);
    expect(first.stdout).toBe(second.stdout); // deterministic rerun
  });

  it('legacy --json output has no contract field (backward compatibility)', () => {
    const result = run([fixture, '--json']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).not.toHaveProperty('contract');
    expect(parsed.files[0]).toHaveProperty('inputTokens');
  });

  it('discover emits a schema-versioned document', () => {
    const result = run(['discover', 'examples', '--json'], fileURLToPath(new URL('../../..', import.meta.url)));
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.schema).toBe('savedyouatoken.cli/discovery');
    expect(parsed.version).toEqual({ major: 1, minor: 0 });
  });

  it('audits the same file identically across reruns (deterministic analysis)', () => {
    const out = join(dir, 'baseline.json');
    run(['baseline', 'create', fixture, '--workflow', 'e2e/triage', '--out', out]);
    const bundleA = JSON.parse(readFileSync(out, 'utf8'));

    run(['baseline', 'create', fixture, '--workflow', 'e2e/triage', '--out', out]);
    const bundleB = JSON.parse(readFileSync(out, 'utf8'));

    // provenance.generatedAt legitimately differs between runs (and so, correctly, does the
    // content identity, since it hashes the full report) — but the analysis itself must not.
    expect(bundleA.report.analysis).toEqual(bundleB.report.analysis);
  });

  it('reproduces an identical content identity when the input report itself is unchanged', () => {
    const reportPath = join(dir, 'fixed-report.json');
    const contractJson = run([fixture, '--contract-json', '--workflow', 'fixed/workflow', '--release', 'v1']);
    writeFileSync(reportPath, contractJson.stdout);

    const outA = join(dir, 'from-report-a.json');
    const outB = join(dir, 'from-report-b.json');
    run(['baseline', 'create', '--from-report', reportPath, '--out', outA]);
    run(['baseline', 'create', '--from-report', reportPath, '--out', outB]);

    const bundleA = JSON.parse(readFileSync(outA, 'utf8'));
    const bundleB = JSON.parse(readFileSync(outB, 'utf8'));
    // Here the *input* report is byte-identical (no fresh generatedAt is injected), so its
    // content identity — and therefore the baseline's reportId — must round-trip exactly.
    expect(bundleA.baseline.reportId).toBe(bundleB.baseline.reportId);
  });

  it('compare reports no change against its own just-created baseline', () => {
    const out = join(dir, 'baseline.json');
    const result = run(['compare', fixture, '--baseline', out, '--json']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.diff.compatibility.status).not.toBe('invalid');
    expect(parsed.diff.tokens.inputTokens.delta).toBe(0);
  });

  it('compare --json carries the workflow id, so PR-comment rendering can group by asset', () => {
    // Regression test: compare's JSON envelope previously omitted this entirely, so every
    // compare-based pull-request comment section silently rendered under the heading "unknown".
    const out = join(dir, 'baseline.json');
    const result = run(['compare', fixture, '--baseline', out, '--json']);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.workflow?.id).toBe('e2e/triage');
  });

  it('compare exits 2 and refuses arithmetic across an incompatible model', () => {
    const out = join(dir, 'baseline.json'); // baselined on the default model, claude-sonnet-5
    const result = run(['compare', fixture, '-m', 'gpt-5-5', '--baseline', out, '--json']);
    expect(result.status).toBe(2);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.diff.compatibility.status).toBe('invalid');
    expect(parsed.diff.tokens).toBeUndefined();
  });

  it('policy generate --baseline then policy check passes, then fails once tightened', () => {
    const baselineOut = join(dir, 'baseline.json');
    const policyOut = join(dir, 'policy.json');

    const generated = run(['policy', 'generate', '--baseline', baselineOut, '--out', policyOut]);
    expect(generated.status).toBe(0);

    const passing = run(['policy', 'check', fixture, '--policy', policyOut, '--baseline', baselineOut, '--json']);
    expect(passing.status).toBe(0);
    const passingParsed = JSON.parse(passing.stdout);
    expect(passingParsed.schema).toBe('savedyouatoken.cli/policy-check');
    expect(passingParsed.outcome).toBe('pass');

    const policy = JSON.parse(readFileSync(policyOut, 'utf8'));
    policy.budgets.maxInputTokens = 1;
    policy.enforcement = 'fail';
    const tightPath = join(dir, 'policy-tight.json');
    writeFileSync(tightPath, JSON.stringify(policy));

    const failing = run(['policy', 'check', fixture, '--policy', tightPath, '--baseline', baselineOut, '--json']);
    expect(failing.status).toBe(1);
    const failingParsed = JSON.parse(failing.stdout);
    expect(failingParsed.outcome).toBe('fail');
    expect(failingParsed.breaches.length).toBeGreaterThan(0);
  });

  it('policy generate rejects more than one file instead of silently dropping the rest', () => {
    const otherFixture = fileURLToPath(new URL('../../../examples/rag-answerer.txt', import.meta.url));
    const out = join(dir, 'should-not-exist.json');
    const result = run(['policy', 'generate', fixture, otherFixture, '--out', out]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('at most one file');
  });

  it('rejects a policy check against a baseline it was not generated from', () => {
    const policyOut = join(dir, 'policy.json');
    const otherBaselineOut = join(dir, 'other-baseline.json');
    run(['baseline', 'create', fixture, '--workflow', 'different/workflow', '--out', otherBaselineOut]);

    const result = run(['policy', 'check', fixture, '--policy', policyOut, '--baseline', otherBaselineOut]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('does not match the baseline');
  });

  it('never leaks prompt text through any JSON surface (canary)', () => {
    const canaryFixture = join(dir, 'canary.txt');
    writeFileSync(canaryFixture, 'CANARY_TEXT_Z9 please kindly respond, thanks so much.');
    const baselineOut = join(dir, 'canary-baseline.json');
    run(['baseline', 'create', canaryFixture, '--workflow', 'canary', '--out', baselineOut]);

    const compareResult = run(['compare', canaryFixture, '--baseline', baselineOut, '--json']);
    const policyGenerate = run(['policy', 'generate', '--baseline', baselineOut, '--out', join(dir, 'canary-policy.json')]);
    const contractJson = run([canaryFixture, '--contract-json', '--workflow', 'canary']);

    for (const output of [
      readFileSync(baselineOut, 'utf8'),
      compareResult.stdout,
      policyGenerate.stdout,
      readFileSync(join(dir, 'canary-policy.json'), 'utf8'),
      contractJson.stdout,
    ]) {
      expect(output).not.toContain('CANARY_TEXT_Z9');
    }
  });
});
