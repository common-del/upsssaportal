import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildVerifierProfile, type VerifierProfile } from '@/lib/sssa/verifierProfile';

const NAVY = '#1B2A6B';
const RED = '#C8372D';
const AMBER = '#B8791A';
const GREEN = '#1C7A4A';

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

function tone(v: number, good: number, bad: number) {
  return v <= good ? GREEN : v >= bad ? RED : AMBER;
}

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 px-3 py-2.5">
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
      <div
        className="mt-0.5 text-xl font-bold tabular-nums tracking-tight"
        style={{ color: color ?? '#111827' }}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-500">{sub}</div>}
    </div>
  );
}

/** A field that has never been captured. Rendering it blank would read as "this
 *  person has no phone" rather than "nobody has recorded one". */
function NotCaptured({ what }: { what: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 text-[12px] text-amber-800">
      {what}
    </span>
  );
}

function Bar({ label, value, width, color }: { label: string; value: string; width: number; color: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-gray-100 py-2.5 first:border-t-0 first:pt-0">
      <span className="w-[136px] shrink-0 text-[12.5px] text-gray-600">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded bg-gray-100">
        <span className="block h-full rounded" style={{ width: `${width}%`, background: color }} />
      </span>
      <span className="w-16 text-right text-[13px] font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function Panel({
  title,
  note,
  children,
  flush,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="px-5 pt-3.5">
        <h2 className="text-[14px] font-bold tracking-tight text-gray-900">{title}</h2>
        {note && <p className="mt-0.5 text-[11.5px] text-gray-500">{note}</p>}
      </div>
      <div className={flush ? 'mt-3' : 'px-5 pb-4 pt-3'}>{children}</div>
    </div>
  );
}

/**
 * A verifier's profile.
 *
 * Reached from wherever their name appears — the queue, the idle list, the
 * appeals-by-verifier table, or the user list — rather than from the sidebar.
 * Finding a person should not require remembering their role first.
 */
export default async function VerifierProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const p: VerifierProfile | null = await buildVerifierProfile(userId);
  if (!p) notFound();

  const capacity = p.capacity ?? 0;
  const loadPct = capacity > 0 ? Math.min(100, Math.round((p.assigned / capacity) * 100)) : 0;
  const appealRate = p.verified > 0 ? Math.round((p.appealed / p.verified) * 100) : 0;
  const upheldRate = p.appealed > 0 ? Math.round((p.upheld / p.appealed) * 100) : 0;
  const harsh = p.avgGap != null && Math.abs(p.avgGap) > 15;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12.5px] text-gray-500">
        <Link href="/app/sssa/users" className="text-[#1B2A6B] underline underline-offset-2">
          Users
        </Link>{' '}
        › <span className="font-semibold text-gray-700">{p.name}</span>
      </p>

      <div className="flex flex-wrap items-start gap-5 rounded-2xl border border-gray-200 bg-white px-6 py-5">
        {p.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photoUrl}
            alt={p.name}
            className="h-[76px] w-[76px] flex-none rounded-xl object-cover"
          />
        ) : (
          <span className="grid h-[76px] w-[76px] flex-none place-items-center rounded-xl border border-gray-200 bg-gray-50 text-xl font-extrabold text-gray-400">
            {initials(p.name)}
          </span>
        )}

        <div className="min-w-[220px] flex-1">
          <h1 className="text-[23px] font-bold tracking-tight text-gray-900">{p.name}</h1>
          <p className="mt-1 text-[13px] text-gray-500">
            {p.username} · joined {fmtDate(p.joined)}
            {p.cyclesWorked > 0 && (
              <> · {p.cyclesWorked} {p.cyclesWorked === 1 ? 'cycle' : 'cycles'} worked</>
            )}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                p.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {p.active ? 'Active' : 'Inactive'}
            </span>
            <span className="rounded-full bg-[#E6E9F2] px-2.5 py-0.5 text-[11px] font-bold text-[#1B2A6B]">
              {p.role === 'VERIFIER' ? 'Verifier' : p.role.replace(/_/g, ' ').toLowerCase()}
            </span>
            {p.districts.map((d) => (
              <span key={d} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">
                {d}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 self-center">
          <Link
            href={`/app/sssa/users/${p.id}/edit`}
            className="rounded-lg border px-3.5 py-2 text-[12.5px] font-bold hover:bg-gray-50"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            Edit
          </Link>
          {p.role === 'VERIFIER' && (
            <Link
              href="/app/sssa/verifiers"
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-bold text-white"
              style={{ background: NAVY }}
            >
              Assign schools
            </Link>
          )}
        </div>
      </div>

      {p.role === 'VERIFIER' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Workload" note="This cycle">
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl font-bold tabular-nums tracking-tight text-gray-900">
                {p.assigned}
              </span>
              <span className="text-[13px] tabular-nums text-gray-500">
                {capacity > 0 ? `of ${capacity} capacity · ${loadPct}%` : 'no capacity set'}
              </span>
            </div>
            {capacity > 0 && (
              <div className="mt-2.5 h-2 overflow-hidden rounded bg-gray-100">
                <div
                  className="h-full rounded"
                  style={{ width: `${loadPct}%`, background: loadPct >= 100 ? RED : NAVY }}
                />
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="Verified" value={p.verified} sub="this cycle" />
              <Stat label="In queue" value={p.queue} sub="not done" />
              <Stat
                label="Oldest wait"
                value={p.oldestWaitDays == null ? '—' : `${p.oldestWaitDays}d`}
                sub="school waiting"
                color={p.oldestWaitDays == null ? '#9AA2B4' : tone(p.oldestWaitDays, 7, 14)}
              />
              <Stat
                label="Days to verify"
                value={p.avgDaysToVerify ?? '—'}
                sub="average"
                color={p.avgDaysToVerify == null ? '#9AA2B4' : tone(p.avgDaysToVerify, 7, 14)}
              />
            </div>
          </Panel>

          <Panel title="Scoring" note="How their marking compares with what schools claimed">
            {p.avgGap == null && p.appealed === 0 ? (
              <p className="text-[13px] text-gray-500">
                Not enough completed verifications yet to say anything useful.
              </p>
            ) : (
              <>
                {p.avgGap != null && (
                  <Bar
                    label="Gap vs self-score"
                    value={p.avgGap > 0 ? `+${p.avgGap}` : `${p.avgGap}`}
                    width={Math.min(100, Math.abs(p.avgGap) * 3)}
                    color={harsh ? RED : NAVY}
                  />
                )}
                <Bar
                  label="Appealed"
                  value={`${appealRate}%`}
                  width={Math.min(100, appealRate * 3)}
                  color={appealRate > 20 ? RED : appealRate > 10 ? AMBER : NAVY}
                />
                {p.appealed > 0 && (
                  <Bar
                    label="Appeals upheld"
                    value={`${upheldRate}%`}
                    width={upheldRate}
                    color={upheldRate > 50 ? RED : NAVY}
                  />
                )}
                {(harsh || appealRate > 20) && (
                  <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: RED }}>
                    Marking {Math.abs(p.avgGap ?? 0)} points{' '}
                    {(p.avgGap ?? 0) < 0 ? 'below' : 'above'} what schools claimed, across{' '}
                    {p.gapSample} results
                    {p.appealed > 0 && (
                      <>
                        , and appealed on {appealRate}% of verifications with {upheldRate}% upheld
                      </>
                    )}
                    . Worth checking whether this is rigour or the rubric being read differently.
                  </p>
                )}
                {p.avgGap == null && p.gapSample > 0 && (
                  <p className="mt-3 text-[12px] text-gray-500">
                    Gap not shown — only {p.gapSample} scored results so far, too few to average.
                  </p>
                )}
              </>
            )}
          </Panel>
        </div>
      )}

      <Panel title="Contact">
        <div className="flex flex-col">
          {[
            ['Mobile', p.mobile, 'Not captured'],
            ['Email', p.email, 'Not captured'],
          ].map(([k, v, empty]) => (
            <div key={k as string} className="flex gap-4 border-t border-gray-100 py-2.5 first:border-t-0 first:pt-0">
              <span className="w-[130px] shrink-0 text-[12px] text-gray-500">{k}</span>
              <span className="text-[13.5px] font-semibold text-gray-900">
                {v ? (v as string) : <NotCaptured what={empty as string} />}
              </span>
            </div>
          ))}
          <div className="flex gap-4 border-t border-gray-100 py-2.5">
            <span className="w-[130px] shrink-0 text-[12px] text-gray-500">Username</span>
            <span className="text-[13.5px] tabular-nums text-gray-700">{p.username}</span>
          </div>
          <div className="flex gap-4 border-t border-gray-100 py-2.5">
            <span className="w-[130px] shrink-0 text-[12px] text-gray-500">Districts</span>
            <span className="text-[13.5px] font-semibold text-gray-900">
              {p.districts.length ? p.districts.join(', ') : <NotCaptured what="None assigned" />}
            </span>
          </div>
        </div>
      </Panel>

      {p.role === 'VERIFIER' && p.schools.length > 0 && (
        <Panel
          title="Assigned schools"
          note={`${p.assigned} this cycle · showing ${p.schools.length}, longest waiting first`}
          flush
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-[9.5px] uppercase tracking-wider text-gray-500">
                  <th className="border-y border-gray-100 px-5 py-2.5 text-left font-bold">School</th>
                  <th className="border-y border-gray-100 px-5 py-2.5 text-left font-bold">Block</th>
                  <th className="border-y border-gray-100 px-5 py-2.5 text-left font-bold">Status</th>
                  <th className="border-y border-gray-100 px-5 py-2.5 text-right font-bold">Waiting</th>
                  <th className="border-y border-gray-100 px-5 py-2.5 text-right font-bold">Score</th>
                </tr>
              </thead>
              <tbody>
                {p.schools.map((s) => (
                  <tr key={s.udise} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-5 py-3 font-semibold" style={{ color: NAVY }}>
                      {s.name}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{s.block}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                          s.status === 'Verified'
                            ? 'bg-green-50 text-green-700'
                            : s.status === 'Waiting'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td
                      className="px-5 py-3 text-right font-bold tabular-nums"
                      style={{ color: s.daysWaiting == null ? '#9AA2B4' : tone(s.daysWaiting, 7, 14) }}
                    >
                      {s.daysWaiting == null ? '—' : `${s.daysWaiting}d`}
                    </td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-gray-900">
                      {s.score == null ? '—' : Math.round(s.score)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
