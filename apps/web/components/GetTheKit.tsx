import { KIT_URL } from '@/lib/site';

/*
  The "Get the kit" call to action. A plain outbound link to the Gumroad product — no
  third-party overlay script, preserving the site's no-third-party-script property. Until
  the product URL is configured it renders a "coming soon" state rather than a dead link.
*/
export function GetTheKit({ className = '' }: { className?: string }) {
  if (!KIT_URL) {
    return (
      <span
        aria-disabled="true"
        className={`inline-flex cursor-not-allowed items-center gap-2 border-[1.5px] border-line-strong bg-raised px-4 py-2.5 font-bold text-faint ${className}`}
      >
        Get the kit — coming soon
      </span>
    );
  }
  return (
    <a
      href={KIT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 border-[1.5px] border-line-strong bg-orange px-4 py-2.5 font-bold text-[#171713] transition-colors hover:bg-acid ${className}`}
    >
      Get the kit — name your price <span aria-hidden>↗</span>
    </a>
  );
}
