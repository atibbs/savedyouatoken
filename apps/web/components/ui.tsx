import type { ReactNode } from 'react';

export function Panel({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <Tag className={`border-[1.5px] border-line-strong bg-panel ${className}`}>{children}</Tag>
  );
}

export function PanelHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[1.5px] border-line-strong px-4 py-2.5 text-[13px]">
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'ink',
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: 'ink' | 'save' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'save'
      ? 'text-save'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-ink';
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className={`num mt-1 truncate text-xl font-semibold ${toneClass}`}>{value}</div>
      {sub ? <div className="mt-0.5 truncate text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'border-danger/50 bg-danger/10 text-danger',
  medium: 'border-warn/50 bg-warn/10 text-warn',
  low: 'border-line-strong text-muted',
};

export function SeverityTag({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}

export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'save' | 'info' }) {
  const toneClass =
    tone === 'save' ? 'border-save/50 text-save' : tone === 'info' ? 'border-info/50 text-info' : 'border-line-strong text-muted';
  return (
    <span className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${toneClass}`}>
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
  id,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block font-mono text-[10px] uppercase tracking-wider text-faint">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <div className="mt-1 text-[11px] text-faint">{hint}</div> : null}
    </div>
  );
}

export const inputClass =
  'w-full border border-line-strong bg-panel px-2.5 py-1.5 num text-sm text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-acid';

export const buttonClass =
  'inline-flex items-center gap-1.5 border border-line-strong bg-panel px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50';

export const primaryButtonClass =
  'inline-flex items-center gap-1.5 border-[1.5px] border-line-strong bg-orange px-3 py-1.5 text-[13px] font-bold text-[#171713] transition-colors hover:bg-acid disabled:cursor-not-allowed disabled:opacity-50';
