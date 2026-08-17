/**
 * Subprocess-level tests against the built `dist/index.js` — the same artifact users run. These
 * exist specifically to catch packaging regressions the in-process server/store tests can't see:
 * `workbench start` previously broke the CLI's single-file bundle by pulling in a dynamic
 * `import()`, which tsup silently turned into extra chunk files instead of one `dist/index.js`.
 */

import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const cliPath = fileURLToPath(new URL('../../dist/index.js', import.meta.url));
const fixture = fileURLToPath(new URL('../../../../examples/support-triage.txt', import.meta.url));

function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync('node', [cliPath, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
}

describe('workbench CLI subcommands (import/export/delete)', () => {
  let dataDir: string;

  function withDataDir() {
    dataDir = mkdtempSync(join(tmpdir(), 'savedyouatoken-workbench-cli-'));
    return dataDir;
  }

  it('imports a report file, is idempotent, and rejects an invalid one', () => {
    const dir = withDataDir();
    const reportPath = join(dir, 'report.json');
    const contractJson = run([fixture, '--contract-json', '--workflow', 'cli/workbench-test', '--release', 'v1']);
    writeFileSync(reportPath, contractJson.stdout);

    const first = run(['workbench', 'import', reportPath, '--data-dir', dir]);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain('imported');

    const second = run(['workbench', 'import', reportPath, '--data-dir', dir]);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('already stored');

    const badPath = join(dir, 'bad.json');
    writeFileSync(badPath, '{"not":"a report"}');
    const bad = run(['workbench', 'import', badPath, '--data-dir', dir]);
    expect(bad.status).toBe(2);
  });

  it('approve (with provisional acknowledgement), export, then policy check pass — a full CLI round trip with no server running', () => {
    const dir = withDataDir();
    const reportPath = join(dir, 'report.json');
    writeFileSync(reportPath, run([fixture, '--contract-json', '--workflow', 'cli/roundtrip', '--release', 'v1']).stdout);

    const imported = run(['workbench', 'import', reportPath, '--data-dir', dir]);
    const reportId = imported.stdout.match(/\((sha256:[a-f0-9]+)\)/)?.[1];
    expect(reportId).toBeDefined();

    const withoutAck = run(['workbench', 'approve', '--report', reportId!, '--data-dir', dir]);
    expect(withoutAck.status).toBe(2);
    expect(withoutAck.stderr).toContain('--acknowledge-provisional');

    const approved = run([
      'workbench', 'approve', '--report', reportId!, '--data-dir', dir,
      '--acknowledge-provisional', '--enforcement', 'fail', '--max-token-regression-percent', '10',
    ]);
    expect(approved.status).toBe(0);

    const policyPath = join(dir, 'exported.policy.json');
    const exported = run(['workbench', 'export', '--workflow', 'cli/roundtrip', '--out', policyPath, '--data-dir', dir]);
    expect(exported.status).toBe(0);

    // policy check needs a baseline bundle (not a bare report); build one from the same report so
    // its content-hash reportId matches what was just approved.
    const baselinePath = join(dir, 'baseline.json');
    expect(run(['baseline', 'create', '--from-report', reportPath, '--out', baselinePath]).status).toBe(0);

    const finalCheck = run(['policy', 'check', fixture, '--policy', policyPath, '--baseline', baselinePath, '--json']);
    expect(finalCheck.status).toBe(0);
    expect(JSON.parse(finalCheck.stdout).outcome).toBe('pass');
  });

  it('export requires an approved baseline and refuses to write one that does not exist', () => {
    const dir = withDataDir();
    const result = run(['workbench', 'export', '--workflow', 'no/such/workflow', '--out', join(dir, 'out.json'), '--data-dir', dir]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('No approved baseline');
  });

  it('delete refuses without --yes and wipes the store with it', () => {
    const dir = withDataDir();
    const reportPath = join(dir, 'report.json');
    writeFileSync(reportPath, run([fixture, '--contract-json', '--workflow', 'cli/workbench-test']).stdout);
    run(['workbench', 'import', reportPath, '--data-dir', dir]);

    const refused = run(['workbench', 'delete', '--data-dir', dir]);
    expect(refused.status).toBe(2);

    const deleted = run(['workbench', 'delete', '--data-dir', dir, '--yes']);
    expect(deleted.status).toBe(0);
  });

  it('never leaks prompt text through import/export output (canary)', () => {
    const dir = withDataDir();
    const canaryFixture = join(dir, 'canary.txt');
    writeFileSync(canaryFixture, 'CANARY_WORKBENCH_CLI_TEXT_Z9 please kindly respond, thanks so much.');
    const reportPath = join(dir, 'canary-report.json');
    writeFileSync(reportPath, run([canaryFixture, '--contract-json', '--workflow', 'canary/workflow']).stdout);

    const imported = run(['workbench', 'import', reportPath, '--data-dir', dir]);
    expect(imported.stdout).not.toContain('CANARY_WORKBENCH_CLI_TEXT_Z9');

    const stored = readFileSync(reportPath, 'utf8');
    expect(stored).not.toContain('CANARY_WORKBENCH_CLI_TEXT_Z9');
  });
});

describe('workbench start (packaging + process lifecycle)', () => {
  let child: ChildProcessWithoutNullStreams | undefined;

  afterEach(() => {
    child?.kill('SIGTERM');
    child = undefined;
  });

  it('boots from the built single-file bundle, serves the HTTP API, and shuts down cleanly on SIGTERM', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'savedyouatoken-workbench-cli-start-'));
    child = spawn('node', [cliPath, 'workbench', 'start', '--port', '0', '--data-dir', dataDir]);

    const output = await waitForOutput(child, /Workbench running at (http:\/\/127\.0\.0\.1:\d+)/, 8000);
    const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)![0];

    const health = await fetch(`${url}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, dataDir });

    const exited = new Promise<number | null>((resolve) => child!.once('exit', resolve));
    child.kill('SIGTERM');
    const code = await exited;
    expect(code).toBe(0);
  });
});

function waitForOutput(child: ChildProcessWithoutNullStreams, pattern: RegExp, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${pattern} in: ${buffer}`)), timeoutMs);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      if (pattern.test(buffer)) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve(buffer);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
    });
  });
}
