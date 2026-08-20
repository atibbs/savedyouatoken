#!/usr/bin/env node
// Publication safety gate (openspec/changes/publish-community-source, task 3.4): fails CI if any
// dependency in the full install tree resolves to a license outside this allow-list. The list
// reflects the redistribution review recorded in docs/community-publication-audit.md — every
// license below was checked there and found compatible with an MIT-licensed public distribution.
import checker from 'license-checker';

const ALLOWED = new Set([
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'MPL-2.0',
  'Unlicense',
  'CC-BY-4.0',
  'CC-BY-3.0',
  '(MIT AND CC-BY-3.0)',
  'CC0-1.0',
  // Bundled only as an unmodified, dynamically-used build/runtime dependency (sharp/libvips);
  // does not require this project's own license to change. See the audit log for the review.
  'LGPL-3.0-or-later',
  'Apache-2.0 AND LGPL-3.0-or-later AND MIT',
]);

checker.init({ start: process.cwd(), excludePrivatePackages: true }, (err, packages) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  const violations = Object.entries(packages).filter(([, info]) => !ALLOWED.has(info.licenses));

  if (violations.length > 0) {
    console.error('✗ dependencies with a license outside the reviewed allow-list:');
    for (const [name, info] of violations) {
      console.error(`  ${name}: ${info.licenses}`);
    }
    console.error(
      '\nReview the license in docs/community-publication-audit.md and either add it to the ' +
        'allow-list in scripts/check-licenses.mjs with a reasoned note, or remove the dependency.',
    );
    process.exit(1);
  }

  console.log(`✓ all ${Object.keys(packages).length} dependencies use an approved license`);
});
