import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock } from '@/components/Code';
import { Panel } from '@/components/ui';
import { GetTheKit } from '@/components/GetTheKit';

export const metadata: Metadata = {
  title: 'CLI — audit prompts locally and enforce a token budget in CI',
  description:
    'Run the same analysis over prompt files on disk. Nothing leaves your machine, and a breached token budget fails the build.',
  alternates: { canonical: '/cli' },
};

export default function CliPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Command line</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        The same audit as the website, run over files on your machine. Two reasons to use it: your
        prompts stay local, and a token budget can fail your build.
      </p>

      <div className="mt-8">
        <CodeBlock label="Analyse a prompt">
          {`npx savedyouatoken prompts/support-triage.txt \\
  --model claude-sonnet-5 \\
  --requests 20000 \\
  --output-tokens 350`}
        </CodeBlock>
      </div>

      <div className="mt-4">
        <CodeBlock label="Output">
          {`support-triage.txt
  1,518 input tokens · $0.0065/request · $795.21/month on Claude Sonnet 5
  token count estimated for the Claude (Opus 4.7 and later) tokenizer

  high   Per-request values above your static content $235.58/mo
         1,445 tokens of static content sit below a {{template}} variable,
         so they can never be cached.
  high   More examples than the model needs $125.80/mo
         7 examples, about 864 tokens (123 each).
  medium JSON indented for a human reader $33.09/mo
         7 JSON blocks indented for readability. Minifying is lossless.

  Safe rewrite: −253 tokens (16.7%), worth $61.56 a month.
  Biggest opportunity: Per-request values above your static content.`}
        </CodeBlock>
      </div>

      <h2 className="mt-12 text-lg font-medium text-ink">Token budgets in CI</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Prompts grow in pull requests, one reasonable paragraph at a time. A budget catches that when
        it happens, not on next month&rsquo;s invoice. The command fails when a budget is breached.
      </p>

      <div className="mt-4">
        <CodeBlock label="Fail the build over budget">
          {`npx savedyouatoken prompts/*.txt \\
  --model claude-sonnet-5 \\
  --requests 20000 \\
  --max-tokens 4000 \\
  --max-monthly 500`}
        </CodeBlock>
      </div>

      <div className="mt-4">
        <CodeBlock label=".github/workflows/prompt-budget.yml">
          {`name: Prompt budget
on: pull_request

jobs:
  tokens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx savedyouatoken prompts/*.txt --max-tokens 4000`}
        </CodeBlock>
      </div>

      <h2 className="mt-12 text-lg font-medium text-ink">Options</h2>
      <div className="mt-3 overflow-x-auto scroll-thin rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[34rem] text-[13px]">
          <tbody className="divide-y divide-line">
            {[
              ['-m, --model <id>', 'Model to price against. `savedyouatoken models` lists them.'],
              ['-r, --requests <n>', 'Requests per day, used for every monthly projection.'],
              ['-o, --output-tokens <n>', 'Average response length. Output often dominates the bill.'],
              ['-c, --cache-hit-rate <n>', 'Percentage of requests hitting a warm prompt cache.'],
              ['-t, --tools <file>', 'JSON file of tool definitions, priced alongside the prompt.'],
              ['--max-tokens <n>', 'Exit 1 if any prompt exceeds this token count.'],
              ['--max-monthly <usd>', 'Exit 1 if projected monthly cost exceeds this.'],
              ['--aggressive', 'Also remove instructions duplicated elsewhere in the prompt.'],
              ['--fix', 'Write the rewritten prompt back to the file.'],
              ['--json', 'Machine-readable output, for your own tooling.'],
            ].map(([flag, description]) => (
              <tr key={flag}>
                <th scope="row" className="whitespace-nowrap px-4 py-2 text-left font-mono text-[12px] font-normal text-ink">
                  {flag}
                </th>
                <td className="px-4 py-2 text-muted">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Panel className="mt-10 px-4 py-4">
        <h2 className="text-[15px] font-medium text-ink">On --fix</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          It overwrites the file with the rewritten prompt. Run it on a clean working tree and read
          the diff before committing. The edits are mechanical and keep the meaning, but a prompt is
          code — review it like any other change.
        </p>
      </Panel>

      <section className="mt-12 border-[1.5px] border-line-strong bg-panel p-5 shadow-hard sm:p-6">
        <h2 className="text-[15px] font-bold text-ink">Run this from inside your agent</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
          The <Link href="/kit" className="text-info underline underline-offset-2">cost-aware agent kit</Link>{' '}
          is a small, pay-what-you-want download that wires this CLI into Claude Code, Cursor, or any
          assistant — so your agent audits its own prompts and cuts the waste. It runs the live tool,
          so it never goes stale.
        </p>
        <div className="mt-4">
          <GetTheKit />
        </div>
      </section>

      <p className="mt-8 text-[13px] text-muted">
        Prefer a browser?{' '}
        <Link href="/" className="text-info underline underline-offset-2">
          The web analyser
        </Link>{' '}
        runs the identical engine and is equally offline — the analysis happens in the page, not on
        a server.
      </p>
    </div>
  );
}
