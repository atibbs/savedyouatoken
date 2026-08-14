# @savedyouatoken/sdk

Wrap your Anthropic or OpenAI client and get a token-waste audit of the **real** request — the
fully-assembled system prompt, tool schemas and provider overhead your app actually sends, not
a copy you pasted into a box.

- **Zero latency.** The real call is untouched; the audit runs *after* the response returns, on
  a deferred macrotask. An audit failure never reaches your code.
- **Private by default.** No prompt or tool text leaves your process. The optional network sink
  transmits only counts, dollar figures and static rule identifiers — never prompt or tool text.
- **Same numbers as the website.** It reuses `@savedyouatoken/core` verbatim, so findings and
  costs match [savedyouatoken.com](https://savedyouatoken.com) and the CLI exactly. No model is
  called.

## Install

```bash
npm install @savedyouatoken/sdk
```

## Use

```ts
import Anthropic from '@anthropic-ai/sdk';
import { wrapAnthropic } from '@savedyouatoken/sdk';

const anthropic = wrapAnthropic(new Anthropic());

// Use the client exactly as before. In development, an audit prints to the console.
await anthropic.messages.create({ model: 'claude-sonnet-5', system, tools, messages });
```

OpenAI is the same:

```ts
import OpenAI from 'openai';
import { wrapOpenAI } from '@savedyouatoken/sdk';

const openai = wrapOpenAI(new OpenAI());
```

The workload behind the dollar figures — requests/day, average output length, cache-hit rate —
is **measured from your traffic**, not guessed. The first audit for a shape uses a provisional
workload and is marked as such; once enough traffic accrues, an updated report is emitted.

### Manual capture

For frameworks that hide the request params, observe directly:

```ts
import { createAuditor, anthropicAdapter } from '@savedyouatoken/sdk';

const auditor = createAuditor(anthropicAdapter);
auditor.observe(params, response); // never throws
```

…or intercept at the fetch layer (opt-in, more invasive):

```ts
import { installFetchInterceptor } from '@savedyouatoken/sdk';
const uninstall = installFetchInterceptor();
```

### Where results go

Pass a sink (or several) via options. Default: console in development, silent in production.

```ts
import { wrapOpenAI, fileSink, dashboardSink, callbackSink } from '@savedyouatoken/sdk';

wrapOpenAI(new OpenAI(), {
  reportContext: {
    workflowId: 'support-agent',
    environment: 'production',
    releaseId: process.env.RELEASE_SHA!,
  },
  sinks: [
    fileSink('./token-audit.jsonl'),               // prompt-free JSON lines
    callbackSink((e) => myLogger.info(e)),          // in-process, full result
    dashboardSink({ url: process.env.SYAT_URL! }),  // opt-in; transmits only the redacted report
  ],
  // Pin any workload field you'd rather state than measure:
  workload: { cacheTtl: '1h' },
  // Exclude a known-variable region from shape identity:
  mask: (system) => system.replace(/Tenant: \w+/g, 'Tenant: <id>'),
});
```

Every analysis callback includes both `analysis.report`, the existing legacy report, and
`analysis.portableReport`, the versioned cross-tool contract. Use the portable report for new
automation, baselines, and policy checks while existing sinks and consumers continue unchanged:

```ts
callbackSink((event) => {
  if (event.type === 'analysis') {
    storeReport(event.analysis.portableReport);
  }
});
```

The JSON Schemas and canonical identity vectors are published with `@savedyouatoken/core` under
`contracts/`. See the [contract guide](../../docs/contracts.md) for compatibility and migration
rules.

## Privacy

Prompt and tool text never leave the process by default. The only off-process payload is
`toSharedReport()` from `@savedyouatoken/core`: counts, dollar figures, and each finding's
static rule `title`/`summary`. It carries no prompt text, tool names, tool descriptions or
schema text — guaranteed by construction and by a canary test in this package.

## License

MIT
