import { getMyResponseWindow } from '@/lib/actions/schoolResponse';
import { SchoolResponseForm } from '@/components/school/SchoolResponseForm';

const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';
const GOLD_DARK = '#7A5209';

/**
 * The school's response window, section 8 of the brief: a read-only view of the corrections
 * the field visit proposed, and one written response before anything is published.
 */
export default async function ResponseWindowPage() {
  const cases = await getMyResponseWindow();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Verification response
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          When a physical verification proposes correcting your score, it appears here before
          publication, with a window to respond in writing.
        </p>
      </div>

      {cases.length === 0 && (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">No corrections are awaiting your response.</p>
          <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
            If your school is verified and no discrepancy is raised, nothing ever appears on this
            page.
          </p>
        </div>
      )}

      {cases.map((c) => (
        <section key={c.runId} className="space-y-4 rounded-xl border-2 border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
              Proposed corrections ({c.items.length})
            </h2>
            {c.windowOpen ? (
              <span className="rounded-full bg-[#FDF8EC] px-3 py-1 text-xs font-bold" style={{ color: GOLD_DARK }}>
                Respond by {new Date(c.windowClosesAt).toLocaleString('en-IN')}
              </span>
            ) : c.response ? (
              <span className="rounded-full bg-[#E7F5EE] px-3 py-1 text-xs font-bold" style={{ color: GREEN }}>
                Response submitted
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                Window closed
              </span>
            )}
          </div>

          <div className="space-y-3">
            {c.items.map((item) => (
              <div key={item.code} className="rounded-lg border border-gray-200 p-3">
                <p className="font-mono text-xs font-bold" style={{ color: NAVY_DEEP }}>
                  {item.code}
                </p>
                <p className="text-sm font-bold text-gray-900">{item.title}</p>
                <p className="text-xs" style={{ color: INK_MUTED }}>
                  {item.titleHi}
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: RED }}>
                  You reported Level {item.claimedLevel}. The verifier found Level {item.proposedLevel}.
                </p>
                <p className="mt-1 text-sm text-gray-700">{item.basis}</p>
                {item.finalLevel !== null && (
                  <p className="mt-1 text-sm font-bold" style={{ color: NAVY_DEEP }}>
                    Final ruling: Level {item.finalLevel}.
                  </p>
                )}
              </div>
            ))}
          </div>

          {c.response ? (
            <div className="rounded-lg p-3" style={{ backgroundColor: '#E7F5EE' }}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: GREEN }}>
                Your response, {new Date(c.response.submittedAt).toLocaleString('en-IN')}
                {c.response.outcome && ` · outcome: ${c.response.outcome.toLowerCase()}`}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{c.response.body}</p>
            </div>
          ) : c.windowOpen ? (
            <SchoolResponseForm runId={c.runId} />
          ) : (
            <p className="text-sm" style={{ color: INK_MUTED }}>
              The window closed without a response. The supervisor rules on the corrections as
              they stand.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
