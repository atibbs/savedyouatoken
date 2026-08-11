#!/usr/bin/env node
// Release staleness guard.
//
// The CLI bundles the pricing catalogue at build time, so `npx savedyouatoken@latest` is
// only "current" if a new version ships whenever the catalogue changes. This guard fails a
// change that edits the catalogue without bumping the CLI's version, so a price edit cannot
// merge without triggering a release. It is necessary-but-not-sufficient: the release
// workflow (on push to main) is what actually publishes the bumped version.
//
// Usage (CI, on pull_request):  BASE_REF=origin/main node scripts/guard-cli-release.mjs
import { execFileSync } from 'node:child_process';

const CATALOGUE = 'packages/core/src/models.ts';
const CLI_PKG = 'packages/cli/package.json';
const base = process.env.BASE_REF || 'origin/main';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

let changed;
try {
  changed = git(['diff', '--name-only', `${base}...HEAD`]).split('\n').filter(Boolean);
} catch {
  console.log(`guard: base ref "${base}" unavailable; skipping (fetch it in CI to enable).`);
  process.exit(0);
}

if (!changed.includes(CATALOGUE)) {
  console.log('guard: pricing catalogue unchanged — no release required.');
  process.exit(0);
}

const headVersion = JSON.parse(git(['show', `HEAD:${CLI_PKG}`])).version;
const baseVersion = JSON.parse(git(['show', `${base}:${CLI_PKG}`])).version;

if (headVersion === baseVersion) {
  console.error(
    `✗ ${CATALOGUE} changed but ${CLI_PKG} version is still ${headVersion}.\n` +
      `  Bump the CLI version so the catalogue change ships to npm as a new "latest".`,
  );
  process.exit(1);
}

console.log(`✓ catalogue changed and CLI version bumped ${baseVersion} → ${headVersion}.`);
