# SDK user story: reducing the cost of a production support agent

## Story

> As the engineer responsible for a production LLM workflow, I want to audit the requests my
> application actually sends so I can identify expensive prompt patterns, quantify their cost,
> and reduce spending without exposing customer or prompt data.

## The user and production system

Maya is a senior backend engineer at a growing e-commerce company. Her team operates an AI
customer-support agent that handles order questions, returns, refunds, and product inquiries.

The agent processes approximately 80,000 messages per day through OpenAI. For every conversation,
the application assembles a request from:

- a shared system prompt;
- the retailer's policies and brand voice;
- customer and order information;
- retrieved help-center articles;
- conversation history; and
- twelve function definitions for order, refund, catalogue, and account operations.

The system works well, but its monthly LLM bill has risen from $18,000 to $43,000. The provider
dashboard shows aggregate token usage, but it does not explain which parts of the request are
responsible or what Maya can safely change.

Maya needs to reduce the cost without changing customer-facing behaviour, adding response latency,
or sending sensitive prompts and customer data to another service.

## 1. Evaluating savedyouatoken

Maya first pastes a copy of the main system prompt into savedyouatoken.com. The report identifies
repeated instructions, excess examples, and possible caching opportunities.

The result is useful but incomplete. Her application does not have one definitive prompt file. The
final request is assembled at runtime, and its tool definitions come from several internal modules.
To inspect the request that production actually sends, she decides to use the savedyouatoken SDK.

Her evaluation criteria are:

- existing OpenAI calls must continue to behave identically;
- auditing must not delay the customer response;
- prompt and tool text must remain inside the application by default;
- costs should reflect actual production workload rather than guesses; and
- recommendations must be concrete enough to test and prioritize.

## 2. Installing and wrapping the client

Maya installs the SDK:

```bash
npm install @savedyouatoken/sdk
```

Before instrumentation, the support service creates its client like this:

```ts
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

She wraps that client:

```ts
import OpenAI from 'openai';
import { wrapOpenAI } from '@savedyouatoken/sdk';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const openai = wrapOpenAI(client);
```

No request call sites need to change. Existing code continues to call the OpenAI client normally:

```ts
const response = await openai.responses.create({
  model: 'gpt-5.5',
  instructions: systemPrompt,
  input: messages,
  tools,
});
```

The wrapper returns the provider response unchanged and preserves OpenAI's enhanced promise methods,
including `withResponse()` and `asResponse()`.

## 3. Running the first local audit

Maya starts the support service in development and submits a test conversation. The customer-facing
response arrives normally. After it returns, savedyouatoken prints a report to the development
console:

```text
savedyouatoken · GPT-5.5 · 6,284 input tokens · $31,900/mo
(provisional workload — still measuring traffic)

high   What your tools cost before anyone calls one
high   A cacheable prompt, uncached
medium More examples than the model needs
```

The initial report is marked provisional because the SDK has seen the request structure but has not
yet observed enough traffic to calculate a reliable request rate.

Maya confirms that:

- the application received the same provider response;
- the audit ran only after the response returned;
- no additional model call occurred; and
- no prompt was uploaded to savedyouatoken.

## 4. Sending reports to internal observability

Console output is useful locally, but Maya wants structured production results in the company's
approved internal observability system. She configures a callback sink:

```ts
import OpenAI from 'openai';
import {
  callbackSink,
  type AuditEvent,
  wrapOpenAI,
} from '@savedyouatoken/sdk';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const openai = wrapOpenAI(client, {
  sink: callbackSink((event: AuditEvent) => {
    internalTokenAuditLogger.write(event);
  }),
});
```

Callback events remain in-process and may contain prompt-derived finding details. Maya sends them
only to an internal system approved to receive that information. If she later needs an external
destination, she will send only the SDK's redacted report or use `dashboardSink`, which excludes
prompt and tool text.

## 5. Normalizing tenant-specific content

The system prompt contains a retailer identifier:

```text
You are the support assistant for tenant: northwind.
```

Because the tenant changes between otherwise equivalent requests, Maya supplies a mask:

```ts
export const openai = wrapOpenAI(client, {
  sink: callbackSink(writeAuditEvent),

  mask(system) {
    return system.replace(
      /tenant: [a-z0-9_-]+/gi,
      'tenant: <tenant>',
    );
  },
});
```

The mask affects only shape identification inside the auditor. It does not modify the prompt sent
to OpenAI. The model still receives the real retailer name.

The SDK also normalizes common variable values such as timestamps, UUIDs, long identifiers, email
addresses, and bearer tokens.

## 6. Deploying safely

Maya opens a small pull request containing:

- the SDK dependency;
- the wrapped OpenAI client;
- the tenant mask;
- the internal callback sink; and
- a feature flag that can disable instrumentation.

During review, the team confirms that observation happens after the provider response, audit errors
cannot break the application, prompt data stays local by default, and retained request-shape state
is bounded.

They deploy the integration to a small percentage of production traffic before enabling it across
the service.

## 7. Measuring the real workload

The SDK emits a provisional analysis the first time it sees a request shape. It then continues
collecting traffic measurements without rerunning the full analysis for every identical request.

For each shape, it measures:

- requests over time;
- average output length; and
- the proportion of responses reporting cached input usage.

By default, the request-rate estimate matures after at least 20 observations spanning at least five
minutes. Once enough data accumulates, the SDK emits an updated report.

Maya sees the production workload settle at approximately:

```text
Requests per day:       79,400
Average output tokens:     612
Observed cache-hit rate:    4%
```

The cost projections now reflect real traffic rather than the provisional defaults used for the
first report.

## 8. Investigating the findings

### Tool definitions are unusually expensive

All twelve tool definitions are sent with every request. Their schemas and provider overhead account
for roughly 1,900 input tokens, although most order-status questions need only two tools:

- `find_order`; and
- `get_shipping_status`.

The report does not treat every tool token as waste. It exposes the recurring cost so Maya can
decide whether all twelve tools need to be available during every workflow step.

### Dynamic content disrupts prompt caching

A request timestamp and customer-specific context appear before several thousand tokens of stable
instructions. Because prompt caches depend on a stable prefix, this early variable content prevents
the later instructions from being reused effectively. The measured 4% cache-hit rate supports the
finding.

### The prompt contains too many examples

The prompt contains seven lengthy support examples, several of which demonstrate nearly identical
escalation behaviour. The audit estimates the recurring cost of transmitting them on every request.

### Output is also a major cost driver

The average completion is longer than the team expected. The report makes clear that input
optimization alone cannot eliminate the whole bill, preventing Maya from overestimating what a
shorter prompt can accomplish.

## 9. Testing targeted optimizations

Maya treats the findings as performance-profile evidence, not instructions to apply blindly. Each
change is tested against customer-resolution and escalation metrics.

First, she routes requests through smaller tool sets:

```ts
const tools =
  intent === 'order_status'
    ? [findOrderTool, shippingStatusTool]
    : allSupportTools;
```

Next, she reorganizes the prompt so stable content forms a reusable prefix:

```text
Stable role and safety instructions
Stable retailer policy
Stable tool-use rules
Stable response contract

Dynamic timestamp
Dynamic customer context
Retrieved documentation
Conversation
```

Finally, she reduces seven examples to three representative cases and adds a tighter response-length
instruction. The team deploys each change behind an experiment and confirms that support quality
remains stable.

## 10. Comparing the mature before-and-after reports

The revised request is a new shape, so savedyouatoken audits it promptly. Once the new shape's
traffic matures, Maya compares the reports:

| Metric | Before | After |
|---|---:|---:|
| Input tokens per request | 6,284 | 3,910 |
| Average output tokens | 612 | 470 |
| Cache-hit rate | 4% | 76% |
| Requests per day | 79,400 | 80,100 |
| Projected monthly cost | $43,000 | $24,600 |

The figures are illustrative, but the workflow is concrete: measured production behaviour connects
specific engineering changes to their financial outcome.

The company saves approximately $18,000 per month without reducing support quality.

## 11. Preventing the cost from returning

Maya knows the prompt and tool set will continue to evolve. The team adds the savedyouatoken CLI to
CI for the stable prompt assets:

```bash
npx savedyouatoken prompts/support-agent.txt \
  --model gpt-5-5 \
  --requests 80000 \
  --max-tokens 4500
```

If a future change exceeds the agreed token budget, the command exits unsuccessfully and blocks the
pull request. The SDK continues to cover dynamically assembled content that cannot be represented by
a single prompt file.

The resulting operating process is:

1. Observe actual production request shapes with the SDK.
2. Investigate the highest-value findings.
3. Test optimizations against product-quality metrics.
4. Compare mature before-and-after reports.
5. Add enforceable budgets for stable prompt assets.
6. Continue monitoring new shapes and material workload changes.

## User experience and outcome

From Maya's perspective, savedyouatoken is a lightweight profiler rather than another operational
dashboard:

- she wraps one provider client;
- existing request code continues to work;
- reports appear locally without additional configuration;
- production estimates improve as real traffic matures;
- repeated identical requests do not create constant audit noise;
- prompt content remains local unless she deliberately routes full events elsewhere;
- recommendations include economic impact rather than only style advice; and
- successful optimizations become durable CI guardrails.

The company gains lower inference costs, better gross-margin visibility, and an engineering process
for reviewing prompt-cost regressions before they reach the next invoice. Maya gains a defensible
answer to where the money was going, which changes mattered, and how much they saved.

That is the intended SDK experience: observe the real production system with minimal disruption,
turn opaque token consumption into prioritized engineering work, and preserve the improvement with
continuous measurement and enforceable budgets.
