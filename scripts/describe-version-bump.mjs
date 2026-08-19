#!/usr/bin/env node
// Prints the "chore: version packages" PR body to stdout. Kept as its own script (rather than
// inline in the workflow YAML) so the markdown isn't at the mercy of YAML/heredoc indentation,
// which would otherwise get interpreted as a code block.
import { readFileSync } from 'node:fs';

const cli = JSON.parse(readFileSync('packages/cli/package.json', 'utf8')).version;
const sdk = JSON.parse(readFileSync('packages/sdk/package.json', 'utf8')).version;

console.log(`Automated version bump, computed from Conventional Commit messages since each package's last release (see \`scripts/version-bump.mjs\`).

| Package | New version |
|---|---|
| \`savedyouatoken\` | \`${cli}\` |
| \`@savedyouatoken/sdk\` | \`${sdk}\` |

Merging this ships it: the push to \`main\` triggers \`release.yml\`/\`release-sdk.yml\`, which publish only the package(s) whose version actually increased.

If a bump type looks wrong (e.g. a fix mislabeled as a feature), edit \`packages/*/package.json\` on this branch directly before merging — this workflow will not overwrite a version you raised further by hand.`);
