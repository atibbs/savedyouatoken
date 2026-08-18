#!/usr/bin/env node
// Publication safety gate (openspec/changes/publish-community-source, task 3.4): asserts each
// publishable package's tarball contains only the files it is expected to contain. Catches a
// stray .env, test fixture, source map, or build-tool config leaking into a published package
// before it ships, not after.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const packages = [
  {
    workspace: 'savedyouatoken',
    allow: [/^LICENSE$/, /^README\.md$/, /^package\.json$/, /^dist\//],
  },
  {
    workspace: '@savedyouatoken/sdk',
    allow: [/^LICENSE$/, /^README\.md$/, /^package\.json$/, /^dist\//],
  },
  {
    workspace: '@savedyouatoken/core',
    allow: [/^LICENSE$/, /^README\.md$/, /^package\.json$/, /^src\//, /^contracts\//],
  },
];

const work = mkdtempSync(join(tmpdir(), 'syat-pack-contents-'));
let failed = false;

for (const { workspace, allow } of packages) {
  const stdout = execFileSync(
    'npm',
    ['pack', '--workspace', workspace, '--dry-run', '--json', '--pack-destination', work],
    { encoding: 'utf8' },
  );
  const jsonStart = stdout.indexOf('[');
  const [{ files }] = JSON.parse(stdout.slice(jsonStart));
  const unexpected = files.map((f) => f.path).filter((path) => !allow.some((re) => re.test(path)));

  if (unexpected.length > 0) {
    failed = true;
    console.error(`✗ ${workspace} tarball contains unexpected files:\n  ${unexpected.join('\n  ')}`);
  } else {
    console.log(`✓ ${workspace} tarball contains only expected files (${files.length} files)`);
  }
}

rmSync(work, { recursive: true, force: true });

if (failed) {
  process.exit(1);
}
