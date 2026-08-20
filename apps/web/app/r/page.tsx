import type { Metadata } from 'next';
import { SharedReport } from './SharedReport';

export const metadata: Metadata = {
  title: 'Shared token audit',
  description: 'A shared prompt cost report. The prompt itself is not included in the link.',
  robots: { index: false, follow: true },
};

export default function SharedReportPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Shared token audit</h1>
      <p className="mt-2 mb-6 text-[14px] text-muted">
        Someone ran a prompt through the analyser and shared the result.
      </p>
      <SharedReport />
    </div>
  );
}
