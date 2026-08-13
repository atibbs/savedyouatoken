import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock } from '@/components/Code';
import { ProductChooser } from '@/components/ProductChooser';
import { Panel } from '@/components/ui';
import { getProduct } from '@/lib/products';

const product = getProduct('sdk');

export const metadata: Metadata = {
  title: `${product.name} — ${product.job.charAt(0).toLowerCase()}${product.job.slice(1)}`,
  description: `${product.description} Install ${product.packageName} for Anthropic or OpenAI.`,
  alternates: { canonical: product.href },
};

export default function SdkPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <span className="eyebrow inline-flex rounded-full border-[1.5px] border-[#171713] bg-acid px-3 py-2 text-[#171713]">
        Runtime observation
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">Audit the request your app actually sends</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        The <code className="font-mono text-ink">@savedyouatoken/sdk</code> package observes fully assembled
        Anthropic and OpenAI requests in your own process: system prompt, tool schemas, model, and measured
        traffic. The real model call is untouched and the audit runs after its response.
      </p>

      <div className="mt-8 max-w-2xl">
        <CodeBlock label="Install">npm install @savedyouatoken/sdk</CodeBlock>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <CodeBlock label="Anthropic">
          {`import Anthropic from '@anthropic-ai/sdk';
import { wrapAnthropic } from '@savedyouatoken/sdk';

const anthropic = wrapAnthropic(new Anthropic());

await anthropic.messages.create({
  model: 'claude-sonnet-5',
  system,
  tools,
  messages,
});`}
        </CodeBlock>
        <CodeBlock label="OpenAI">
          {`import OpenAI from 'openai';
import { wrapOpenAI } from '@savedyouatoken/sdk';

const openai = wrapOpenAI(new OpenAI());

await openai.responses.create({
  model: 'gpt-5.4',
  instructions,
  tools,
  input,
});`}
        </CodeBlock>
      </div>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-[15px] font-bold text-ink">Reports mature with traffic</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            The first report for a request shape uses a provisional workload. After enough observations and
            elapsed time, the SDK emits an updated report based on measured request rate, output length, and
            cache behavior. You can override workload fields when you know them.
          </p>
        </Panel>
        <Panel className="p-5">
          <h2 className="text-[15px] font-bold text-ink">Safe in the request path</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Auditing is deferred until after the provider responds. A capture, analysis, or sink failure never
            reaches application code, and no extra model call is made.
          </p>
        </Panel>
        <Panel className="p-5">
          <h2 className="text-[15px] font-bold text-ink">Private by default</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Prompt and tool text stay in your process by default. The optional dashboard sink sends only a
            redacted report of counts, dollar figures, and static finding identifiers.
          </p>
        </Panel>
        <Panel className="p-5">
          <h2 className="text-[15px] font-bold text-ink">You choose the destination</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Development defaults to console output; production defaults to silence. Opt in to console, file,
            callback, or dashboard sinks. The file and network forms contain prompt-free report data.
          </p>
        </Panel>
      </section>

      <section className="mt-12 border-[1.5px] border-line-strong bg-panel p-5 sm:p-6">
        <h2 className="text-lg font-medium text-ink">SDK or CLI?</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
          Use this SDK when prompts are assembled dynamically inside a live application and you need to inspect
          the real outbound request. Use the <Link href="/cli" className="text-info underline underline-offset-2">CLI</Link>{' '}
          when prompts already exist as files or you want a pull request budget check. The packages are separate:
          <code className="ml-1 font-mono text-ink">@savedyouatoken/sdk</code> for runtime integration and
          <code className="ml-1 font-mono text-ink">savedyouatoken</code> for the command line.
        </p>
        <a
          href="https://www.npmjs.com/package/@savedyouatoken/sdk"
          className="mt-4 inline-block text-[13px] font-bold text-info underline underline-offset-2"
        >
          Read the complete SDK package documentation
        </a>
      </section>

      <ProductChooser current="sdk" />
    </div>
  );
}
