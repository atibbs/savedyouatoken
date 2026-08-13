## Context

SDK consumers currently receive console, file, callback, or network-sink output. A local experience
must remain prompt-free and useful offline, while avoiding collision with the static public website
or premature hosted infrastructure. It also serves as a low-cost prototype of Monitor's central
workflow.

## Goals / Non-Goals

**Goals:**

- Make valid SDK output understandable immediately after installation.
- Provide trustworthy comparison and baseline export locally.
- Exercise the Monitor information model before committing to hosted architecture.

**Non-Goals:**

- Multi-user collaboration or cloud synchronization.
- Raw prompt inspection or re-analysis from stored reports.
- Background operation after the user exits the workbench.

## Decisions

**Ship a CLI-launched loopback application.** A command starts a local HTTP process, opens or prints a
URL, and stops on explicit termination. Embedding history into the public website was rejected
because browser storage cannot receive production SDK output reliably; a desktop binary was rejected
as premature packaging overhead.

**Store immutable contract documents plus a small index.** Source reports remain untouched; derived
views can be rebuilt. A bespoke relational model was rejected initially because it could harden the
wrong hosted schema before validation.

**Bind to loopback and authenticate ingestion with an ephemeral local token.** This prevents other
local pages from posting reports casually. Listening on the LAN was rejected as an unsafe default.

**Reuse shared compatibility and policy evaluation.** Comparison arithmetic and baseline export live
in public contract/core code, not UI components, so CLI and future Monitor stay consistent.

**Treat baseline approval as a recorded local decision.** The workbench captures report identity,
tolerance, and acknowledgement of any provisional evidence. Automatically choosing the newest
report was rejected because recency does not imply validity.

## Risks / Trade-offs

- [Local server feels heavy for a CLI] → Start on demand, require no account, and expose file import as
  a simpler alternative.
- [Local database format changes] → Store versioned source documents and make indexes disposable.
- [Users assume savings preserve quality] → Keep a visible evaluation reminder during baseline
  approval.
- [Loopback ingestion can be abused locally] → Use ephemeral authorization, origin checks, size
  limits, and prompt-free validation.

## Migration Plan

Begin with file import and read-only history, then add SDK local sink, comparisons, and policy export.
Store schema versions alongside data and provide export before any migration. Rollback leaves source
report files readable by the CLI and removes only the disposable local viewer/index.
