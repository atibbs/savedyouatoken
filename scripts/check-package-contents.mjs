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

// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\x1b\[[0-9;]*m/g;

for (const { workspace, allow } of packages) {
  // `npm pack` runs the workspace's `prepack`/`build` script first, whose own stdout (tsup's
  // colored log lines) lands in the same stream ahead of the `--json` payload. A colorized log
  // line can itself contain a literal "[" (an ANSI escape like "\x1b[34m"), so a naive
  // `indexOf('[')` can find that instead of the JSON array — this fixes at the source (no color
  // to begin with) and defensively strips any ANSI that slips through anyway, then looks for the
  // JSON specifically at the start of a line rather than anywhere in the string.
  const stdout = execFileSync(
    'npm',
    ['pack', '--workspace', workspace, '--dry-run', '--json', '--pack-destination', work],
    { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } },
  ).replace(ANSI_ESCAPE, '');
  const jsonStart = stdout.search(/^\[/m);
  if (jsonStart === -1) {
    throw new Error(`${workspace}: could not find a JSON array in \`npm pack\` output:\n${stdout}`);
  }
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
