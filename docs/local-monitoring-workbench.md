# Local monitoring workbench

A local, account-free history of versioned reports: import files or point the SDK's local sink
at a running workbench, browse workflow/release history with maturity context, compare
before/after, approve a baseline, and export it as a policy `savedyouatoken policy check`
consumes directly. It is also a low-cost prototype of the hosted Monitor's information model —
see [`docs/product-platform-strategy.md`](product-platform-strategy.md) — built entirely on the
same [report/baseline/policy contracts](contracts.md) the CLI regression workflow uses.

## Quick start

```bash
npx savedyouatoken workbench start
```

This prints a URL (`http://127.0.0.1:4590` by default) and an ephemeral ingestion token, then
blocks until you press Ctrl+C. Open the URL in a browser. To populate it without the SDK:

```bash
npx savedyouatoken examples/support-triage.txt --contract-json --workflow support/triage > report.json
npx savedyouatoken workbench import report.json
```

## Commands

```
savedyouatoken workbench start [--port <n>] [--data-dir <path>]
savedyouatoken workbench import <report.json...> [--data-dir <path>]
savedyouatoken workbench approve --report <id> [--enforcement warn|fail] [--acknowledge-provisional]
                                  [--max-input-tokens N] [--max-monthly-cost N]
                                  [--max-token-regression-percent N] [--max-cost-regression-percent N]
savedyouatoken workbench export --workflow <id> --out <path> [--data-dir <path>]
savedyouatoken workbench delete [--data-dir <path>] [--yes]
```

`import`, `approve`, and `export` work directly against the local store without a server running
— useful for scripting a full `import → approve → export` pipeline (see
`packages/cli/test/workbench/cli.test.ts` for a worked example that round-trips through
`savedyouatoken policy check`). `export` writes the same canonical policy the running server's
"Download policy.json" button produces for the workflow's approved baseline; `approve` is the
CLI equivalent of that page's approval form, including the same requirement to pass
`--acknowledge-provisional` for a report that isn't mature yet.

## SDK connection

```ts
import { createAuditor, localWorkbenchSink } from '@savedyouatoken/sdk';

const auditor = createAuditor(anthropicAdapter, {
  sink: localWorkbenchSink({ token: process.env.WORKBENCH_TOKEN! }),
});
```

The token is ephemeral — copied from `workbench start`'s console output each time it runs, e.g.
into an environment variable for local development. `localWorkbenchSink` only ever transmits the
prompt-free `portableReport` (the same [`ReportEnvelope`](contracts.md) contract as everything
else in this product); it never sends the in-process `result`, prompt text, or tool schemas. A
local request can arrive before the workbench has finished starting, so unlike the SDK's
`dashboardSink` this sink retries a bounded number of times (2 by default) with backoff before
giving up; a final failure still throws, so it surfaces through the SDK's existing
`sink-delivery` health event exactly like any other sink failure.

## Local data boundary

There was no local-storage convention anywhere in this codebase before the workbench, so this is
new: `$SAVEDYOUATOKEN_WORKBENCH_DIR`, falling back to `~/.savedyouatoken/workbench`. Inside it:

```
reports/<sha256-hex>.json   # immutable ReportEnvelope documents, one per ingested report
index.json                  # a disposable summary index — rebuilt automatically if missing/corrupt
baselines.json              # recorded baseline approvals (report id, workflow, tolerance, enforcement)
```

Only `reports/*.json` is durable, load-bearing state. `index.json` never needs a backup — delete
it and the workbench rebuilds it from the source documents on next read. Every document that
reaches disk has already passed through `@savedyouatoken/core`'s contract parser, which is what
makes it prompt-free by construction: a `ReportEnvelope` cannot carry prompt text, tool schemas,
or per-finding detail (see [`docs/contracts.md`](contracts.md)). A raw ingested document larger
than 256 KiB is rejected before parsing, since a real report is compact metadata and anything far
past that size indicates a misbehaving sender, not a legitimate one.

**Backups and upgrades:** copy the data directory, or run `workbench export --out <dir>` for a
plain-file copy you can move anywhere. There is no schema migration today — the store is versioned
per-document (each `ReportEnvelope`/`BaselineDocument`/policy carries its own contract version),
so a future format change can migrate documents individually rather than requiring a bulk
conversion.

**Deletion:** `workbench delete --yes` (or the web UI's confirmation form) permanently removes
`reports/`, `index.json`, and `baselines.json`. It never touches a policy file you have already
committed to a repository — that file is a separate, independent artifact once exported.

## Security boundary

- **Loopback only.** The server binds to `127.0.0.1` and has no option to listen on a LAN
  address — this is deliberate, not a missing feature; see `design.md`'s decision log.
- **Ephemeral token.** A new random token is generated every time `workbench start` runs and is
  never persisted. It gates every state-changing route: `POST /ingest` (as an `Authorization:
  Bearer` header, for the SDK/CLI), and `POST /approve-baseline` / `POST /api/delete` (as a form
  field, embedded by the server in every page it renders — a page from any other origin has no
  way to obtain it). Read-only navigation (workflow/release/report/compare pages) needs no token.
- **Origin checking.** When a request carries an `Origin` header that doesn't match the server's
  own origin, mutating routes reject it — defense in depth against a hostile page on the same
  machine driving a fetch call, on top of the token requirement.
- **No network transmission** beyond what you explicitly configure (the SDK sink, or your own
  `curl`/import). The workbench itself never calls out anywhere.

## What this is not

- Not multi-user or cloud-synced — see design.md's non-goals.
- Not a place to inspect or re-analyze raw prompts — reports are portable, prompt-free
  aggregates; there is nothing to view beyond what the contract carries.
- Not a background service — it runs only while `workbench start` is running, and exits cleanly
  on Ctrl+C (SIGINT/SIGTERM).
