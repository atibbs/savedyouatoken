# Contributing to savedyouatoken

Thank you for helping improve savedyouatoken. Community contributions are accepted under the same
MIT license as the project. By submitting a pull request, you confirm that you have the right to
contribute the work and license it under MIT.

## Before opening an issue

- Use the question issue template or the support guidance in [`SUPPORT.md`](SUPPORT.md) for usage
  questions.
- Search existing issues before filing a bug or feature request.
- Report security vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md).
- Do not include real prompts, API keys, production reports, customer data, or other confidential
  material in an issue, fixture, screenshot, or pull request.

## Development setup

Use Node.js 20.9 or newer and npm:

```bash
git clone https://github.com/atibbs/savedyouatoken.git
cd savedyouatoken
npm ci
npm run typecheck
npm test
npm run build
```

The Community surfaces require no account, API key, database, or hosted Monitor access. See
[`docs/community-development.md`](docs/community-development.md) for the complete verification
commands and architecture boundaries.

## Pull requests

1. Keep each change focused and explain the user-facing problem it solves.
2. Add or update tests for behaviour changes.
3. Run the relevant typechecks, tests, builds, and package verification commands.
4. Update documentation when interfaces, package contents, prices, or workflows change.
5. Use synthetic examples. Never commit a real user's prompt or production report.

Maintainers may decline changes that expand support burden, cross the Community/hosted boundary,
conflict with the product direction, or lack sufficient tests. Acceptance does not promise a
release date, hosted-service capability, integration, or support commitment.

## Sensitive areas

Changes to token counting, pricing, rewrite safety, report contracts, SDK capture, privacy filters,
or release workflows require maintainer review. Pricing changes must update the verification date
and source notes alongside tests.

## Conduct

Participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
