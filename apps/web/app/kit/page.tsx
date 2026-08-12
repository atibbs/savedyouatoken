import type { Metadata } from 'next';
import Link from 'next/link';
import { GetTheKit } from '@/components/GetTheKit';

export const metadata: Metadata = {
  title: 'The cost-aware agent kit',
  description:
    'A pay-what-you-want kit that makes your coding agent — Claude Code, Cursor, any CLI assistant — audit what its prompts cost and cut the waste. Runs the live tool, so it never goes stale.',
  alternates: { canonical: '/kit' },
};

const INSIDE = [
  ['SKILL.md', 'A Claude Code skill: audit prompt files — including the agent’s own CLAUDE.md, MCP tool definitions and skill descriptions — apply the safe fixes, and re-measure.'],
  ['cursor-rules.md', 'A paste-in rule for Cursor, or a CLAUDE.md block, that keeps an assistant cost-aware and pointed at the live tool.'],
  ['USAGE.md', 'How to run it and read the output — models, request volume, tool definitions, CI budgets.'],
  ['CHEAT-SHEET.md', 'The waste patterns to recognise, one line each, grouped by where the money leaks.'],
] as const;

export default function KitPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b-[1.5px] border-line-strong">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
          <span className="eyebrow inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#171713] bg-acid px-3 py-2 text-[#171713]">
            Pay what you want
          </span>
          <h1 className="display mt-7 max-w-3xl text-[clamp(36px,6.5vw,72px)] text-ink">
            Make your agent audit its own <span className="serif-accent">token bill.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-[17px] leading-relaxed text-muted sm:text-[19px]">
            A small kit that drops the audit into the tools you already work in — Claude Code, Cursor,
            or any CLI-driven assistant. It finds what your prompts, tool schemas and agent config
            actually cost, and cuts the waste.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <GetTheKit />
            <span className="font-mono text-[12px] text-faint">$0 floor · tip if it helped</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h2 className="text-lg font-medium text-ink">What’s inside</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {INSIDE.map(([name, desc]) => (
            <div key={name} className="border-[1.5px] border-line-strong bg-panel p-4">
              <div className="font-mono text-[13px] font-semibold text-ink">{name}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-faint">Plus a short README and an MIT license.</p>

        <div className="mt-10 border-[1.5px] border-line-strong bg-mint p-5 text-[#171713] shadow-hard">
          <h2 className="text-[15px] font-bold">A launcher, not a snapshot</h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed">
            The kit embeds no prices. Everything in it runs the live tool —{' '}
            <code className="font-mono">npx savedyouatoken@latest</code> — so the token counts, model
            prices and findings are always current. A downloaded kit can’t go stale, because it holds
            no numbers to go stale.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-medium text-ink">Prefer to try it first?</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            Paste a prompt into the{' '}
            <Link href="/" className="text-info underline underline-offset-2">
              free analyser
            </Link>
            , or run the same audit over files with the{' '}
            <Link href="/cli" className="text-info underline underline-offset-2">
              CLI
            </Link>
            . The kit is the shortcut that lives inside your agent.
          </p>
        </section>
      </div>
    </>
  );
}
