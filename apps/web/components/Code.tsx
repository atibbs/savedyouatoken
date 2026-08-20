export function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      {label ? (
        <div className="border-b border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">
          {label}
        </div>
      ) : null}
      <pre className="scroll-thin overflow-x-auto px-3.5 py-3 font-mono text-[12.5px] leading-relaxed">
        <code className="text-ink">{children}</code>
      </pre>
    </div>
  );
}
