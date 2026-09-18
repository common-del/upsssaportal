import Link from 'next/link';
import type {
  BandLink,
  DistrictRow,
  ManagementRow,
  StateDashboard as Data,
} from '@/lib/sssa/stateDashboard';
import { PageHeader, Section, StatCard, StatGrid, Table, Td, Th } from '@/components/sssa/ui';

/**
 * The SSSA landing page, rebuilt on what SSSA asked it to carry.
 *
 * In order: how many schools have finished their self assessment, then the state average score,
 * then the four counts, then districts ranked on self assessment finished, then management type,
 * then two doors into the register for the highest and lowest scoring schools.
 *
 * The banner leads on completion rather than on the score because the score is roughly stable
 * week to week and completion is what the Authority is asked about. Both sit in the same navy
 * strip, so neither needs its own furniture.
 *
 * The schools card is two links rather than two names. It used to print the single highest and
 * single lowest scoring school in the state, which on 32,440 results is one row at each end and
 * almost always a data artefact rather than a school anybody would act on. Filtering the register
 * to the top and bottom bands gives the same question a population-sized answer.
 */

const NAVY = '#1B2A6B';
const GOLD = '#F5B731';
const inr = (n: number) => n.toLocaleString('en-IN');
const pct = (n: number) => `${n.toFixed(1)}%`;

/** The one cell that carries the ranking: the share finished, the fraction it came from, and a
 *  bar so the spread between first and last is readable without parsing numbers. */
function Finished({ d }: { d: DistrictRow }) {
  const complete = d.finishedPct >= 95;
  return (
    <span className="block">
      <span
        className="block text-[15px] font-bold leading-tight tabular-nums"
        style={{ color: complete ? '#1C7A4A' : '#B8791A' }}
      >
        {pct(d.finishedPct)}
      </span>
      <span className="mt-px block text-xs tabular-nums text-gray-500">
        {inr(d.finished)} of {inr(d.schools)} schools
      </span>
      <span className="mt-1.5 block h-1.5 w-[168px] overflow-hidden rounded-full bg-gray-100">
        <span
          className="block h-1.5 rounded-full"
          style={{
            width: `${Math.min(100, d.finishedPct)}%`,
            backgroundColor: complete ? '#1C7A4A' : '#B8791A',
          }}
        />
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
        {d.averageScore === null ? '—' : pct(d.averageScore)}
      </Td>
      <Td>
        {d.band ? (
          <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            {d.band}
          </span>
        ) : (
          <span className="text-xs text-gray-400">Not scored yet</span>
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
                  {m.score}% · {inr(m.schools)} scored
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

function BandDoor({
  tone,
  label,
  band,
  divider,
}: {
  tone: 'top' | 'bottom';
  label: string;
  band: BandLink;
  divider?: boolean;
}) {
  return (
    <Link
      href={`/app/sssa/schools?sqaaf=${encodeURIComponent(band.label)}`}
      className={`flex items-center gap-3 px-4 py-4 hover:bg-gray-50 ${
        divider ? 'border-t border-gray-100' : ''
      }`}
    >
      <span
        className={`w-14 shrink-0 rounded px-1.5 py-1 text-center text-[10px] font-extrabold tracking-wide ${
          tone === 'top' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-snug" style={{ color: NAVY }}>
          {band.label}
        </span>
        <span className="mt-0.5 block text-xs tabular-nums text-gray-500">
          {inr(band.schools)} {band.schools === 1 ? 'school' : 'schools'}
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
        className="flex flex-wrap items-end gap-x-7 gap-y-4 rounded-2xl px-6 py-5 text-white"
        style={{ background: NAVY }}
      >
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            Finished self assessment
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-5xl font-bold leading-none tracking-tight tabular-nums">
              {inr(standing.finishedSelfAssessment)}
            </span>
            <span className="text-[15px] font-semibold tabular-nums text-white/75">
              of {inr(standing.totalSchools)} · {finishedPct}%
            </span>
          </div>
        </div>

        <div aria-hidden className="hidden h-14 w-px bg-white/20 sm:block" />

        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            State average score
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-5xl font-bold leading-none tracking-tight tabular-nums">
              {data.averageScore === null ? '—' : `${data.averageScore}%`}
            </span>
            {data.band && (
              <span
                className="rounded-full px-4 py-1.5 text-[15px] font-bold"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                {data.band}
              </span>
            )}
          </div>
        </div>

        <div className="ml-auto text-right text-xs leading-relaxed tabular-nums text-white/70">
          {inr(standing.verified)} verified and scored
          <br />
          {inr(standing.awaitingVerification)} awaiting verification
        </div>
      </div>

      {data.averageScore === null && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No school has been verified yet, so there is no state score and no ranking.
        </div>
      )}

      <Section
        title="Self assessment"
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
          note={`Ranked on how many schools have finished their self assessment. Districts with fewer than 5 schools are not ranked.`}
        >
          <Table minWidth={720}>
            <thead>
              <tr>
                <Th>Rank</Th>
                <Th>District</Th>
                <Th>Self assessment finished</Th>
                <Th align="right">Avg score</Th>
                <Th>Band</Th>
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
          <p className="mt-3 text-xs text-gray-500">
            <Link href="/app/sssa/schools" className="font-bold" style={{ color: NAVY }}>
              Open the register →
            </Link>
          </p>
        </Section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Management rows={data.management} unpopulated={data.managementUnpopulated} />

        <Card heading="School">
          {data.topBand && data.bottomBand ? (
            <>
              <BandDoor tone="top" label="Highest" band={data.topBand} />
              <BandDoor tone="bottom" label="Lowest" band={data.bottomBand} divider />
              <p className="mt-auto border-t border-gray-100 px-4 py-2.5 text-[11.5px] text-gray-400">
                Opens the register filtered to that band, rather than naming one school here.
              </p>
            </>
          ) : (
            <p className="px-4 py-3 text-[13px] leading-relaxed text-gray-500">
              No grade bands are set on this cycle&apos;s framework.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
