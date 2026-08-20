#!/usr/bin/env node
// Automatic semver bump for a publishable package, driven by Conventional Commit messages.
//
//   node scripts/version-bump.mjs <npmName> <pkgDir> [watchPath...]
//
// Example:
//   node scripts/version-bump.mjs savedyouatoken packages/cli packages/core/src
//
// `watchPath...` defaults to [pkgDir] and can list extra paths whose changes should also count
// toward this package's version — e.g. packages/core/src, which is bundled into both the CLI
// and SDK builds rather than published on its own, so a core-only change still needs a bump.
//
// Algorithm:
//   1. Find this package's "version epoch": the most recent commit that changed the "version"
//      field in <pkgDir>/package.json. That commit is when the current version number became
//      current.
//   2. Walk every commit after the epoch that touched a watched path.
//   3. Classify each by Conventional Commit type: a `!` after the type/scope, or a
//      "BREAKING CHANGE:" footer, means major; `feat` means minor; anything else (fix, perf,
//      refactor, or an unlabeled commit) means patch — the conservative default, since silently
//      not bumping is worse than an extra patch release.
//   4. Bump package.json by the highest severity found. No-ops if nothing watched changed since
//      the epoch (including when a manual bump earlier in the same range already became the new
//      epoch — this makes the script safe to run after a human has already bumped by hand).
//
// This only edits package.json; it does not commit, push, or publish anything.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { bump } from './semver.mjs';

const [npmName, rawPkgDir, ...rawExtraWatchPaths] = process.argv.slice(2);
if (!npmName || !rawPkgDir) {
  console.error('Usage: node scripts/version-bump.mjs <npmName> <pkgDir> [watchPath...]');
  process.exit(2);
}

// Git pathspecs, refs (`<ref>:<path>`), and `--name-only` output are always POSIX ("/"), on every
// OS git itself runs on — never the platform separator. Every path below is normalized to that
// form up front and used as a plain string for all git-facing work; only the final filesystem
// read/write reconverts to a native path.
const toPosix = (p) => p.split(sep).join('/').replace(/\/+$/, '');

const pkgDir = toPosix(rawPkgDir);
const watchPaths = [pkgDir, ...rawExtraWatchPaths.map(toPosix)].map((p) => `${p}/`);
const pkgJsonRelPath = `${pkgDir}/package.json`;

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function versionAt(ref) {
  try {
    // stderr is suppressed here only: a ref like "<initial-commit>^" or a not-yet-existing file
    // path is an *expected* failure this function turns into `null`, not a real error to surface.
    const raw = execFileSync('git', ['show', `${ref}:${pkgJsonRelPath}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(raw).version;
  } catch {
    return null; // file/ref does not exist (e.g. ref is the initial commit's "parent")
  }
}

function findVersionEpoch() {
  const hashes = git(['log', '--format=%H', '--', pkgJsonRelPath]).split('\n').filter(Boolean);
  for (const hash of hashes) {
    if (versionAt(hash) !== versionAt(`${hash}^`)) return hash;
  }
  throw new Error(`Could not find a version-setting commit for ${pkgJsonRelPath}`);
}

function classifyCommit(hash) {
  const subject = git(['log', '-1', '--format=%s', hash]);
  const body = git(['log', '-1', '--format=%b', hash]);
  const m = subject.match(/^(\w+)(\([^)]*\))?(!)?:/);
  if ((m && m[3] === '!') || /BREAKING CHANGE:/.test(body)) return 'major';
  if (m && m[1] === 'feat') return 'minor';
  return 'patch';
}

const epoch = findVersionEpoch();
const range = `${epoch}..HEAD`;
const hashesInRange = git(['log', '--format=%H', range]).split('\n').filter(Boolean);

const RANK = { patch: 1, minor: 2, major: 3 };
let bumpType = null;
for (const hash of hashesInRange) {
  const files = git(['diff-tree', '--no-commit-id', '--name-only', '-r', hash]).split('\n').filter(Boolean);
  if (!watchPaths.some((p) => files.some((f) => f.startsWith(p)))) continue;
  const type = classifyCommit(hash);
  if (!bumpType || RANK[type] > RANK[bumpType]) bumpType = type;
}

if (!bumpType) {
  console.log(`version-bump: ${npmName} — no changes under ${watchPaths.join(', ')} since ${epoch.slice(0, 8)}, leaving version as-is.`);
  process.exit(0);
}

const pkgJsonPath = join(process.cwd(), ...pkgJsonRelPath.split('/'));
const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
const oldVersion = pkgJson.version;
const newVersion = bump(oldVersion, bumpType);
pkgJson.version = newVersion;
writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`, 'utf8');

console.log(`version-bump: ${npmName} — ${bumpType} bump ${oldVersion} → ${newVersion} (since ${epoch.slice(0, 8)}).`);
