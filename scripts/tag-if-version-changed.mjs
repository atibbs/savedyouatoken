#!/usr/bin/env node
// Decides whether HEAD's package.json just changed version relative to its parent commit, and
// if so, what release tag should mark it.
//
//   node scripts/tag-if-version-changed.mjs <pkgDir> <tagPrefix>
//
// Example:
//   node scripts/tag-if-version-changed.mjs packages/cli cli-v
//
// This only computes the answer — it does not create, push, or delete any tag. The caller
// (tag-releases.yml) decides what to do with the result, so this stays a pure, testable check.
// Writes `shouldTag` and `tag` to $GITHUB_OUTPUT when present; otherwise prints them.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const [pkgDir, tagPrefix] = process.argv.slice(2);
if (!pkgDir || !tagPrefix) {
  console.error('Usage: node scripts/tag-if-version-changed.mjs <pkgDir> <tagPrefix>');
  process.exit(2);
}

const pkgJsonRelPath = `${pkgDir}/package.json`;

function versionAt(ref) {
  try {
    const raw = execFileSync('git', ['show', `${ref}:${pkgJsonRelPath}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(raw).version;
  } catch {
    return null; // file/ref does not exist (e.g. HEAD^ predates this package)
  }
}

const head = versionAt('HEAD');
if (head == null) {
  console.error(`No ${pkgJsonRelPath} at HEAD.`);
  process.exit(2);
}

const parent = versionAt('HEAD^');
const shouldTag = head !== parent;
const tag = shouldTag ? `${tagPrefix}${head}` : '';

function emit() {
  const out = `shouldTag=${shouldTag}\ntag=${tag}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out);
  else process.stdout.write(out);
}

emit();

if (shouldTag) {
  console.log(`tag-if-version-changed: ${pkgDir} → ${tag} (was ${parent ?? 'nonexistent'}).`);
} else {
  console.log(`tag-if-version-changed: ${pkgDir} version unchanged (${head}) in this push.`);
}
