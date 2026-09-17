import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/authz';
import { AcknowledgeReport } from '@/components/sssa/AcknowledgeReport';

const NAVY = '#1B2A6B';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD_INK = '#7A5209';
const GREEN = '#1E6344';
const RED = '#96271E';

/**
 * One report of inducement or pressure.
 *
 * It sits under Complaints because that is where every objection now lives, and it has its own
 * page because the substance of a report is a paragraph somebody wrote, which a table row cannot
 * hold. The old integrity inbox showed the paragraph and offered one control: acknowledge. This
 * adds the thing that was missing, a way through to the subject's own record, because
 * acknowledging a report of a bribe and then having nowhere to go was the whole weakness of that
 * screen.
 *
 * The reporter is named. These are not anonymous, and the page says so rather than letting
 * somebody assume otherwise while reading about their own supervisor.
 */
export default async function IntegrityReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole('AUDIT_CELL', 'SSSA_ADMIN');
  if (!actor) redirect('/login?tab=official');

  const { id } = await params;
  const report = await prisma.integrityReport.findUnique({
    where: { id },
    select: {
      id: true,
      body: true,
      createdAt: true,
      schoolUdise: true,
      auditAcknowledgedAt: true,
      reportedBy: { select: { name: true, username: true } },
      about: {
        select: { name: true, username: true, verifierProfile: { select: { id: true, cell: true } } },
      },
    },
  });
  if (!report) notFound();

  const school = report.schoolUdise
    ? await prisma.school.findUnique({
        where: { udise: report.schoolUdise },
        select: { udise: true, nameEn: true, block: { select: { nameEn: true } }, district: { select: { nameEn: true } } },
      })
    : null;

  const acknowledged = report.auditAcknowledgedAt !== null;
  const subjectName = report.about ? (report.about.name ?? report.about.username) : null;
  const subjectProfileId = report.about?.verifierProfile?.id ?? null;
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-5">
      <Link href="/app/sssa/disputes" className="text-[13px] font-semibold underline" style={{ color: NAVY }}>
        ‹ All complaints
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ backgroundColor: '#FDF3DC', color: GOLD_INK }}
            >
              Inducement or pressure
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={
                acknowledged
                  ? { backgroundColor: '#E3F0E8', color: GREEN }
                  : { backgroundColor: RED, color: '#FFFFFF' }
              }
            >
              {acknowledged ? `Acknowledged ${formatDate(report.auditAcknowledgedAt!)}` : 'Not acknowledged'}
            </span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
            {subjectName ?? (school ? school.nameEn : 'Nobody named')}
          </h1>
          <p className="text-sm" style={{ color: INK_MUTED }}>
            {subjectName
              ? report.about?.verifierProfile?.cell === 'FIELD'
                ? 'Field verifier'
                : report.about?.verifierProfile?.cell === 'ONLINE'
                  ? 'Desk verifier'
                  : 'Named in the report'
              : 'The report names no person'}
            {school && (
              <>
                {' · '}
                {school.block.nameEn}, {school.district.nameEn}
              </>
            )}
          </p>
        </div>

        {!acknowledged && <AcknowledgeReport id={report.id} />}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">What was reported</p>
        <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-900">{report.body}</p>
      </section>

      <section className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:grid-cols-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Reported by</span>
          <span className="text-[13.5px] font-semibold text-gray-900">
            {report.reportedBy.name ?? report.reportedBy.username}
          </span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Filed on</span>
          <span className="text-[13.5px] font-semibold text-gray-900">{formatDate(report.createdAt)}</span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">School named</span>
          <span className="text-[13.5px] font-semibold text-gray-900">
            {school ? `${school.nameEn} (${school.udise})` : 'none'}
          </span>
        </span>
      </section>

      <section className="rounded-2xl border p-4" style={{ borderColor: '#EBD9AE', backgroundColor: '#FDF8EC' }}>
        <p className="text-sm font-bold" style={{ color: GOLD_INK }}>
          This report is not anonymous
        </p>
        <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: GOLD_INK }}>
          The person who filed it is named above. Reports reach the Authority directly rather than
          a supervisor, because the supervisor may be the subject, and only the Authority can open
          this page.
        </p>
      </section>

      {/* The step the old inbox was missing. Acknowledging a report of a bribe and then having
          nowhere to go is not a process. */}
      {subjectProfileId && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5">
          <p className="max-w-[56ch] text-[13.5px] leading-relaxed" style={{ color: INK_MUTED }}>
            Acting on this means their own record: the work they have done, what of it has been
            sampled and read, and where they stand against the removal rules.
          </p>
          <Link
            href={`/app/sssa/workforce/${subjectProfileId}`}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-5 py-3 text-sm font-bold text-white"
            style={{ backgroundColor: NAVY }}
          >
            Open {subjectName}&apos;s record
          </Link>
        </section>
      )}
    </div>
  );
}
