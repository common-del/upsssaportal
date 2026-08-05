import { Download, FileText } from 'lucide-react';
import { ExplainerFilm } from '@/components/public/ExplainerFilm';
import { SQAAF_GUIDANCE_PDF, SQAAF_STEPS } from '@/lib/help/sqaafSteps';

/** Shared by every role's /help/sqaaf route; the role layout above it has
 * already established the session. */
export async function SqaafHelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">How to fill SQAAF</h1>
      <p className="mt-2 max-w-2xl text-sm text-text-secondary">
        Watch the walkthrough, download the guidance, then work through the steps below.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* No walkthrough film exists yet, so this renders its "coming soon"
            state until a YouTube ID is supplied. */}
        <ExplainerFilm
          variant="light"
          title="Watch: filling your SQAAF assessment"
          description="A walkthrough of the form, domain by domain."
          minutes="6 min"
        />

        <section className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-[#1B2A6B]">Guidance document</h2>
          <p className="mt-1 text-xs text-gray-600">
            The full written guidance, including what evidence each indicator accepts.
          </p>
          <a
            href={SQAAF_GUIDANCE_PDF}
            download
            className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-[#1B2A6B] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            <Download size={16} aria-hidden />
            Download guidance (PDF)
          </a>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
            <FileText size={12} aria-hidden />
            Placeholder file · PDF
          </p>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-[#1B2A6B]">Filling the assessment, step by step</h2>
        <ol className="mt-4 space-y-3.5">
          {SQAAF_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1B2A6B] text-xs font-bold text-white">
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">{step.title}</span>
                <span className="mt-0.5 block text-xs text-gray-600">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
