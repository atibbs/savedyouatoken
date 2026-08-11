import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
      <p className="num text-[13px] uppercase tracking-wider text-faint">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Nothing here</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        That page does not exist. It cost you nothing to find out.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 text-[14px]">
        <Link href="/" className="text-info underline underline-offset-2">
          Analyse a prompt
        </Link>
        <Link href="/waste" className="text-info underline underline-offset-2">
          Waste patterns
        </Link>
        <Link href="/models" className="text-info underline underline-offset-2">
          Model prices
        </Link>
      </div>
    </div>
  );
}
