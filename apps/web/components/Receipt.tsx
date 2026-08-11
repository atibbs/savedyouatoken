import { formatTokens, formatUsd } from '@savedyouatoken/core';

/*
  The receipt is the canonical shareable output — "send the receipt, not the prompt".
  It is deliberately styled with fixed paper colours (white, ink, acid, orange) rather
  than theme tokens: a receipt should look the same in light mode, dark mode, and in a
  screenshot pasted into Slack. The numbers come from the same analysis the tool ran; the
  prompt itself is never part of it.
*/

export interface ReceiptProps {
  modelName: string;
  inputTokens: number;
  monthlyNow: number;
  /** The single largest honest saving — never a sum of overlapping findings. */
  recoverable: number;
  recoverableTitle?: string;
  /** YYYY-MM-DD */
  createdAt: string;
}

export function Receipt({
  modelName,
  inputTokens,
  monthlyNow,
  recoverable,
  recoverableTitle,
  createdAt,
}: ReceiptProps) {
  const pct = monthlyNow > 0 ? Math.round((recoverable / monthlyNow) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-sm -rotate-1 border-[1.5px] border-[#171713] bg-white text-[#171713] shadow-[10px_10px_0_#ff6534]">
      <div className="flex items-center justify-between border-b border-dashed border-[#171713] px-5 py-3 font-mono text-[10px] tracking-wide">
        <span className="grid h-6 w-6 place-items-center rounded-full border border-[#171713] bg-[#eaff3f] text-[11px] font-semibold leading-none">
          S<span className="text-[#ff6534]">/</span>T
        </span>
        <span className="font-semibold">AUDIT RECEIPT</span>
        <span className="tabular-nums">{createdAt}</span>
      </div>

      <div className="flex flex-col items-center px-6 py-9 text-center">
        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#171713]/55">
          Monthly bill · {modelName}
        </span>
        <strong className="my-2.5 font-mono text-[clamp(40px,9vw,62px)] font-medium leading-none tracking-tight tabular-nums">
          {formatUsd(monthlyNow)}
        </strong>
        <span className="font-mono text-[10px] text-[#171713]/55">
          {formatTokens(inputTokens)} input tokens, every request
        </span>

        {recoverable > 0 ? (
          <>
            <span className="mt-6 -rotate-1 border border-[#171713] bg-[#eaff3f] px-3 py-1.5 font-mono text-[11px] font-medium tabular-nums">
              RECOVERABLE {formatUsd(recoverable)}/MO{pct > 0 ? ` · ${pct}%` : ''}
            </span>
            {recoverableTitle ? (
              <span className="mt-2.5 max-w-[15rem] font-mono text-[9px] leading-relaxed text-[#171713]/55">
                {recoverableTitle}
              </span>
            ) : null}
          </>
        ) : (
          <span className="mt-6 border border-dashed border-[#171713] px-3 py-1.5 font-mono text-[10px] text-[#171713]/70">
            NOTHING MECHANICAL LEFT TO CUT
          </span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-dashed border-[#171713] px-5 py-3 font-mono text-[9px] tracking-wide">
        <span>NO PROMPT WAS UPLOADED</span>
        <span>savedyouatoken.com</span>
      </div>
    </div>
  );
}
