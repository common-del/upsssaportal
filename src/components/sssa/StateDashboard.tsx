import Link from 'next/link';
import type {
  BandLink,
  DistrictRow,
  ManagementRow,
  StateDashboard as Data,
} from '@/lib/sssa/stateDashboard';
import { PageHeader, Section, StatCard, StatGrid, Table, Td, Th } from '@/components/sssa/ui';

/**
 * The SSSA landing page.
 *
 * In the order SSSA gave it: how many schools have finished their self assessment, the state
 * average score, the four counts, districts ranked on self assessments finished, management type,
 * then the top and bottom schools in the state.
 *
 * The banner leads on completion rather than on the score because the score is roughly stable
 * week to week and completion is what the Authority is asked about. The ring carries the
 * proportion, which a number alone cannot: 26,563 means nothing without 32,579 beside it, and a
 * reader should not have to divide. The score sits to its right at a smaller size, so the two
 * figures have an order rather than competing at 46px each.
 *
 * One vocabulary, because the first build of this page had four. "Finished" means a self
 * assessment has been sent, whether or not anybody has checked it; the bucket for sent-but-
 * unchecked is "Awaiting verification" and never "Finished"; a grade band is a "SQAAF grade",
 * which is what the register's own filter calls it; and the word for a school carrying a
 * verified score is "verified", not "scored".
 *
 * The schools card is two links rather than two names. It used to print the single highest and
 * single lowest scoring school in the state, which on 32,440 results is one row at each end and
 * almost always a data artefact rather than a school anybody would act on: the old page showed
 * one at 100 out of 100 and one at 0. Filtering the register to the top and bottom grades answers
 * the same question with a population.
 */

const NAVY = '#1B2A6B';
const GOLD = '#F5B731';
const inr = (n: number) => n.toLocaleString('en-IN');
const pct1 = (n: number) => `${n.toFixed(1)}%`;

/** The completion ring. r=44 gives a circumference of 276.46, which the dash array divides. */
const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CompletionRing({ percent }: { percent: number }) {
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * RING_CIRCUMFERENCE;
  return (
    <svg
      width="104"
      height="104"
      viewBox="0 0 104 104"
      role="img"
      aria-label={`${percent}% of self assessments finished`}
      className="shrink-0"
    >
      <circle cx="52" cy="52" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="13" />
      <circle
        cx="52"
        cy="52"
        r={RING_RADIUS}
        fill="none"
        stroke={GOLD}
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${RING_CIRCUMFERENCE}`}
        transform="rotate(-90 52 52)"
      />
      <text
        x="52"
        y="58"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="21"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {percent}%
      </text>
    </svg>
  );
}

/** The one cell that carries the ranking: the share finished, a bar, and the fraction it came
 *  from. Three separate columns said the same thing three times across the row. */
function Finished({ d }: { d: DistrictRow }) {
  const complete = d.finishedPct >= 95;
  const ink = complete ? '#1C7A4A' : '#B8791A';
  return (
    <span className="flex items-center gap-3">
      <span className="inline-block h-2 w-[120px] shrink-0 overflow-hidden rounded-full bg-gray-100">
        <span
          className="block h-2 rounded-full"
          style={{ width: `${Math.min(100, d.finishedPct)}%`, backgroundColor: ink }}
        />
      </span>
      <span className="text-[13px] font-bold tabular-nums" style={{ color: ink }}>
        {pct1(d.finishedPct)}
      </span>
      <span className="text-xs tabular-nums text-gray-500">
        {inr(d.finished)} of {inr(d.schools)}
      </span>
    </span>
  );
}

function DistrictRowCells({ d, rank }: { d: DistrictRow; rank: number }) {
  return (
    <tr className="border-t border-gray-100">
      <Td>
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
            rank === 1 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {rank}
        </span>
      </Td>
      <Td strong>{d.name}</Td>
      <Td>
        <Finished d={d} />
      </Td>
      <Td align="right" bold>
        {d.averageScore === null ? '—' : pct1(d.averageScore)}
      </Td>
      <Td>
        {d.band ? (
          <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            {d.band}
          </span>
        ) : (
          <span className="text-xs text-gray-400">Not verified yet</span>
        )}
      </Td>
    </tr>
  );
}

function Card({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="px-4 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-gray-500">
        {heading}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function Management({ rows, unpopulated }: { rows: ManagementRow[]; unpopulated: boolean }) {
  const spread =
    rows.length > 1 ? Math.round((rows[0].score - rows[rows.length - 1].score) * 10) / 10 : 0;
  return (
    <Card heading="School management type">
      {unpopulated ? (
        <p className="px-4 py-3 text-[13px] leading-relaxed text-gray-500">Not yet imported.</p>
      ) : (
        <>
          {rows.map((m, i) => (
            <div
              key={m.code}
              className={`flex items-start gap-3 px-4 py-3 ${i ? 'border-t border-gray-100' : ''}`}
            >
              <span className="mt-0.5 w-7 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-center text-[10px] font-extrabold text-gray-500">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold leading-snug" style={{ color: NAVY }}>
                  {m.label}
                </span>
                <span className="mt-0.5 block text-xs tabular-nums text-gray-500">
                  {m.score}% · {inr(m.schools)} verified
                </span>
              </span>
            </div>
          ))}
          {/* A numbered list reads as a gap. Across 32,000 schools there is not one, and saying
              so is cheaper than letting the ranking imply otherwise. */}
          {rows.length > 1 && (
            <p className="mt-auto border-t border-gray-100 px-4 py-2.5 text-[11.5px] text-gray-400">
              {spread === 0
                ? 'First and third are level.'
                : `${spread} points separate first from third.`}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function GradeDoor({ title, band, divider }: { title: string; band: BandLink; divider?: boolean }) {
  return (
    <Link
      href={`/app/sssa/schools?sqaaf=${encodeURIComponent(band.label)}`}
      className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 ${
        divider ? 'border-t border-gray-100' : ''
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-snug" style={{ color: NAVY }}>
          {title}
        </span>
        <span className="mt-0.5 block text-xs tabular-nums text-gray-500">
          {band.label} · {inr(band.schools)} {band.schools === 1 ? 'school' : 'schools'}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-lg text-gray-300">
        ›
      </span>
    </Link>
  );
}

export function StateDashboard({ data }: { data: Data }) {
  const { standing } = data;
  const finishedPct = standing.totalSchools
    ? Math.round((standing.finishedSelfAssessment / standing.totalSchools) * 1000) / 10
    : 0;

  // cycleName already reads "SSSA Cycle 2025-26" in the data, so prefixing it here produced
  // "SSSA Cycle SSSA Cycle 2025-26".
  const subtitle = data.cycleName === '—' ? undefined : data.cycleName;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Uttar Pradesh" subtitle={subtitle} />

      <div
        className="flex flex-wrap items-center gap-x-7 gap-y-5 rounded-2xl px-6 py-5 text-white"
        style={{ background: NAVY }}
      >
        <CompletionRing percent={finishedPct} />

        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            Self assessments finished
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[40px] font-bold leading-none tracking-tight tabular-nums">
              {inr(standing.finishedSelfAssessment)}
            </span>
            <span className="text-sm font-semibold tabular-nums text-white/75">
              of {inr(standing.totalSchools)} schools
            </span>
          </div>
          <div className="mt-1.5 text-[12.5px] tabular-nums text-white/70">
            {inr(standing.verified)} verified · {inr(standing.awaitingVerification)} awaiting
            verification
          </div>
        </div>

        <div className="ml-auto border-l border-white/20 pl-7 text-right">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            Average score
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-2.5">
            <span className="text-4xl font-bold leading-none tracking-tight tabular-nums">
              {data.averageScore === null ? '—' : `${data.averageScore}%`}
            </span>
            {data.band && (
              <span
                className="rounded-full px-3.5 py-1 text-[13px] font-bold"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                {data.band}
              </span>
            )}
          </div>
          <div className="mt-1.5 text-[12.5px] tabular-nums text-white/70">
            across the {inr(standing.verified)} verified
          </div>
        </div>
      </div>

      {data.averageScore === null && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No school has been verified yet, so there is no state score and no ranking.
        </div>
      )}

      <Section
        title="Where every school stands"
        note="Four counts that add up to the register, so each one is a set you could go and list."
      >
        <StatGrid>
          <StatCard
            label="Not started"
            value={standing.notStarted}
            sub="no form opened"
            tone={standing.notStarted > 0 ? 'red' : 'muted'}
          />
          <StatCard
            label="In draft"
            value={standing.draft}
            sub="started, not sent"
            tone={standing.draft > 0 ? 'amber' : 'muted'}
          />
          <StatCard
            label="Awaiting verification"
            value={standing.awaitingVerification}
            sub="sent, not yet checked"
          />
          <StatCard
            label="Verified"
            value={standing.verified}
            sub="checked and scored"
            tone="green"
          />
        </StatGrid>
      </Section>

      {data.districts.length > 0 && (
        <Section
          title="District ranking"
          note="On self assessments finished. Districts with fewer than 5 schools are not ranked."
        >
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th>Rank</Th>
                <Th>District</Th>
                <Th>Self assessments finished</Th>
                <Th align="right">Average score</Th>
                <Th>SQAAF grade</Th>
              </tr>
            </thead>
            <tbody>
              {data.districts.map((d, i) => (
                <DistrictRowCells key={d.code} d={d} rank={i + 1} />
              ))}
              {data.districtBottom && (
                <>
                  <tr className="border-t border-gray-100 bg-gray-50/60">
                    <td colSpan={5} className="px-4 py-2 text-xs text-gray-400">
                      {inr(Math.max(0, data.districtsRanked - data.districts.length - 1))} districts
                      between
                    </td>
                  </tr>
                  <DistrictRowCells d={data.districtBottom} rank={data.districtsRanked} />
                </>
              )}
            </tbody>
          </Table>
          <p className="mt-3 text-xs">
            <Link href="/app/sssa/schools" className="font-bold" style={{ color: NAVY }}>
              See all 75 districts in the register →
            </Link>
          </p>
        </Section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Management rows={data.management} unpopulated={data.managementUnpopulated} />

        <Card heading="Schools">
          {data.topBand && data.bottomBand ? (
            <>
              <GradeDoor title="Top schools in the state" band={data.topBand} />
              <GradeDoor title="Bottom schools in the state" band={data.bottomBand} divider />
              <p className="mt-auto border-t border-gray-100 px-4 py-2.5 text-[11.5px] text-gray-400">
                Each opens the register filtered to that SQAAF grade, rather than naming one school
                here.
              </p>
            </>
          ) : (
            <p className="px-4 py-3 text-[13px] leading-relaxed text-gray-500">
              No SQAAF grades are set on this cycle&apos;s framework.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
