import type { Metadata } from 'next';
import Link from 'next/link';
import localFont from 'next/font/local';
import { PRICES_VERIFIED_ON } from '@savedyouatoken/core';
import { SITE_NAME, SITE_URL, TAGLINE, RESOURCE_NAV } from '@/lib/site';
import { PRODUCT_NAV } from '@/lib/products';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GetTheKit } from '@/components/GetTheKit';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

/* Fonts are vendored into app/fonts (latin subset) and self-hosted, so the build is
   reproducible offline and there is no runtime request to a third-party font host. */
const manrope = localFont({
  variable: '--f-sans',
  display: 'swap',
  src: [
    { path: './fonts/manrope-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/manrope-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/manrope-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/manrope-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/manrope-800.woff2', weight: '800', style: 'normal' },
  ],
});
const dmMono = localFont({
  variable: '--f-mono',
  display: 'swap',
  src: [
    { path: './fonts/dmmono-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/dmmono-500.woff2', weight: '500', style: 'normal' },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'savedyouatoken — audit your LLM prompt costs',
    template: '%s — savedyouatoken',
  },
  description: TAGLINE,
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'technology',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'savedyouatoken — audit your LLM prompt costs',
    description: TAGLINE,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'savedyouatoken — audit your LLM prompt costs',
    description: TAGLINE,
  },
  robots: { index: true, follow: true },
};

/** Set the theme before first paint so a dark-mode user never sees a white flash. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('syat-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${dmMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:border-2 focus:border-line-strong focus:bg-acid focus:px-3 focus:py-2 focus:text-sm focus:text-ink"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-40 border-b-[1.5px] border-line-strong bg-canvas/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="group flex items-center gap-2.5 shrink-0" aria-label={`${SITE_NAME} home`}>
              <span className="grid h-9 w-9 -rotate-[8deg] place-items-center rounded-full border-[1.5px] border-[#171713] bg-acid font-mono text-[13px] font-semibold leading-none text-[#171713]">
                <span className="whitespace-nowrap">
                  S<span className="text-orange">/</span>T
                </span>
              </span>
              <span className="hidden text-[16px] font-extrabold tracking-tight text-ink sm:inline">
                Saved You a Token
              </span>
            </Link>

            <nav aria-label="Main" className="ml-auto flex items-center gap-0.5 sm:gap-1">
              {PRODUCT_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.job}
                  aria-label={`${item.name}: ${item.job}`}
                  className={`whitespace-nowrap rounded px-1.5 py-1 text-[12px] font-bold text-muted transition-colors hover:text-ink hover:underline hover:underline-offset-4 sm:px-2 sm:text-[13px] ${
                    item.id === 'web' ? 'hidden md:inline-block' : item.id === 'kit' ? 'hidden lg:inline-block' : ''
                  }`}
                >
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.navLabel}</span>
                </Link>
              ))}
              <div className="ml-1 flex shrink-0 items-center gap-2">
                <ThemeToggle />
              </div>
            </nav>
          </div>
        </header>

        <main id="main">{children}</main>

        <footer className="mt-24 border-t-[1.5px] border-[#171713] bg-orange text-[#171713]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-8">
              <div className="min-w-52">
                <div className="text-[clamp(30px,5vw,56px)] font-extrabold leading-none tracking-tight">
                  Saved You <br /> a Token
                  <span className="ml-2 align-top font-mono text-[12px]">.com</span>
                </div>
                <nav aria-label="Products" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-bold">
                  {PRODUCT_NAV.map((item) => (
                    <Link key={item.href} href={item.href} className="hover:underline hover:underline-offset-4">
                      {item.navLabel}
                    </Link>
                  ))}
                </nav>
                <nav aria-label="Resources" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px] font-medium">
                  {RESOURCE_NAV.map((item) => (
                    <Link key={item.href} href={item.href} className="hover:underline hover:underline-offset-4">
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <nav aria-label="Open source" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px] font-medium">
                  <a href="https://github.com/atibbs/savedyouatoken" target="_blank" rel="noopener noreferrer" className="hover:underline hover:underline-offset-4">
                    Source
                  </a>
                  <a href="https://github.com/atibbs/savedyouatoken/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="hover:underline hover:underline-offset-4">
                    License
                  </a>
                  <a href="https://github.com/atibbs/savedyouatoken/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="hover:underline hover:underline-offset-4">
                    Contributing
                  </a>
                  <a href="https://github.com/atibbs/savedyouatoken/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer" className="hover:underline hover:underline-offset-4">
                    Security
                  </a>
                </nav>
              </div>
              <div className="flex flex-col items-start gap-4 sm:items-end">
                <GetTheKit tone="onOrange" />
              </div>
            </div>
            <p className="mt-12 border-t-[1.5px] border-[#171713] pt-6 font-mono text-[11px] leading-relaxed text-[#171713]/80">
              Prices maintained by hand and last verified {PRICES_VERIFIED_ON}. Token counts for
              Claude and Gemini are estimates — see{' '}
              <Link href="/methodology" className="underline">
                how the numbers are produced
              </Link>
              . Always confirm against your provider&rsquo;s own billing before making a decision
              that matters.
            </p>
          </div>
        </footer>
        {/* First-party, cookieless pageview analytics (Vercel Web Analytics). Loads same-origin
            from /_vercel/insights, sets no cookies, and never sees prompt or tool text. */}
        <Analytics />
      </body>
    </html>
  );
}
