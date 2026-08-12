#!/usr/bin/env node
// Decides whether the CLI should be released, idempotently and monotonically.
//
// - If the local version is ALREADY published, there is nothing to do (a rerun after a
//   partial failure must not try to republish an immutable version) → release=false.
// - If the package exists and the local version is NOT semver-greater than the current
//   `latest`, fail hard (guards against downgrades / accidental re-releases).
// - Otherwise → release=true.
//
// Writes `release` and `version` to $GITHUB_OUTPUT when present; otherwise prints them.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { gt } from './semver.mjs';

const PKG = 'savedyouatoken';
const cliDir = fileURLToPath(new URL('../packages/cli/', import.meta.url));
const local = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8')).version;

function npmView(args) {
  try {
    return execFileSync('npm', ['view', PKG, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null; // package missing (E404) or unreachable — treat as not-yet-published
  }
}

const versionsRaw = npmView(['versions', '--json']);
const published = versionsRaw ? [].concat(JSON.parse(versionsRaw)) : [];
const latest = npmView(['version']); // the current `latest` dist-tag, or null

function emit(release) {
  const out = `release=${release}\nversion=${local}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out);
  else process.stdout.write(out);
}

if (published.includes(local)) {
  console.log(`gate: ${PKG}@${local} already published — nothing to release.`);
  emit(false);
  process.exit(0);
}

if (latest && !gt(local, latest)) {
  console.error(`✗ gate: local version ${local} is not greater than published latest ${latest}.`);
  process.exit(1);
}

console.log(`gate: releasing ${PKG}@${local}${latest ? ` (latest is ${latest})` : ' (first release)'}.`);
emit(true);
