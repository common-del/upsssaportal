import Link from 'next/link';
import type { BandLink, ManagementRow, StateDashboard as Data } from '@/lib/sssa/stateDashboard';
import { PageHeader, Section, StatCard, StatGrid } from '@/components/sssa/ui';
import { DashboardScopePicker } from '@/components/sssa/DashboardScopePicker';
import { DistrictRankingTable } from '@/components/sssa/DistrictRankingTable';

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

/**
 * One colour per management type, and a bar of how much of the verified register each one is.
 *
 * The card was three lines of navy text on white and read as a list of nothing. The colour is not
 * decoration: the three averages sit 0.3 points apart, so the only figure on this card that
 * genuinely varies is how many schools each type accounts for, and that is what the bar shows.
 */
const MANAGEMENT_COLOUR: Record<string, string> = {
  GOVERNMENT: '#1B2A6B',
  AIDED: '#B8791A',
  PRIVATE: '#1C7A4A',
};

function Management({ rows, unpopulated }: { rows: ManagementRow[]; unpopulated: boolean }) {
  const spread =
    rows.length > 1 ? Math.round((rows[0].score - rows[rows.length - 1].score) * 10) / 10 : 0;
  return (
    <Card heading="School management type">
      {unpopulated ? (
        <p className="px-4 py-3 text-[13px] leading-relaxed text-gray-500">Not yet imported.</p>
      ) : (
        <>
          {rows.map((m, i) => {
            const colour = MANAGEMENT_COLOUR[m.code] ?? NAVY;
            const covered = m.total > 0 ? (m.verified / m.total) * 100 : 0;
            return (
              <div
                key={m.code}
                className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-gray-100' : ''}`}
              >
                <span
                  className="w-7 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-extrabold text-white"
                  style={{ backgroundColor: colour }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-bold leading-snug" style={{ color: colour }}>
                      {m.label}
                    </span>
                    <span className="shrink-0 text-[15px] font-bold tabular-nums" style={{ color: colour }}>
                      {m.score}%
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <span
                      className="block h-1.5 rounded-full"
                      style={{ width: `${covered}%`, backgroundColor: colour, opacity: 0.55 }}
                    />
                  </span>
                  <span className="mt-1 block text-xs tabular-nums text-gray-500">
                    {inr(m.verified)} of {inr(m.total)} verified
                  </span>
                </span>
              </div>
            );
          })}
          {/* A numbered list reads as a gap. Across 32,000 schools there is not one, and saying
              so is cheaper than letting the ranking imply otherwise. */}
          {rows.length > 1 && (
            <p className="mt-auto border-t border-gray-100 px-4 py-2.5 text-[11.5px] text-gray-400">
              Ranked on score. {spread === 0 ? 'First and third are level.' : `${spread} points separate first from third.`}{' '}
              The bar is how much of each type has been verified.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/**
 * A door into the register, sized to carry its own figures rather than to be a link.
 *
 * Two thin rows left the card two thirds empty beside a management card of three, which is what
 * made the pair look lopsided. Each door now holds the grade, the count at reading size and its
 * share of the verified register, which is the context that makes 19,676 mean something, and the
 * two cards come out level.
 *
 * The grade pill takes the register's own band colours, so a reader arriving at the filtered list
 * sees the colour they clicked, and the tinted edge says which end of the scale it opens.
 */
function GradeDoor({
  title,
  band,
  tone,
  ofVerified,
  divider,
}: {
  title: string;
  band: BandLink;
  tone: 'top' | 'bottom';
  ofVerified: number;
  divider?: boolean;
}) {
  const edge = tone === 'top' ? '#1C7A4A' : '#B8791A';
  const pill = tone === 'top' ? 'bg-[#E7F5EE] text-[#14603A]' : 'bg-[#FBF1DE] text-[#7A5209]';
  const share = ofVerified > 0 ? Math.round((band.schools / ofVerified) * 1000) / 10 : 0;
  // Both parameters, because the grade alone is not the answer. Filtering to Utkarsh and
  // listing it by name shows a grade; the door promises the schools at one end of the state,
  // so it carries the order that puts them at the top of page one.
  const sort = tone === 'top' ? 'score_desc' : 'score_asc';
  return (
    <Link
      href={`/app/sssa/schools?sqaaf=${encodeURIComponent(band.label)}&sort=${sort}`}
      className={`flex flex-1 items-center gap-3.5 px-4 py-4 hover:bg-gray-50 ${
        divider ? 'border-t border-gray-100' : ''
      }`}
      style={{ boxShadow: `inset 4px 0 0 ${edge}` }}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2.5">
          <span className="text-[15px] font-bold leading-snug" style={{ color: NAVY }}>
            {title}
          </span>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${pill}`}>
            {band.label}
          </span>
        </span>
        <span className="mt-2 flex items-baseline gap-2.5">
          <span className="text-2xl font-bold leading-none tabular-nums" style={{ color: edge }}>
            {inr(band.schools)}
          </span>
          <span className="text-xs tabular-nums text-gray-500">
            {band.schools === 1 ? 'school' : 'schools'}, {share}% of those verified
          </span>
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-100">
          <span
            className="block h-1.5 rounded-full"
            style={{ width: `${Math.min(100, share)}%`, backgroundColor: edge, opacity: 0.55 }}
          />
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-lg" style={{ color: edge }}>
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
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <PageHeader title={data.selectedDistrictName ?? 'Uttar Pradesh'} subtitle={subtitle} />
        <DashboardScopePicker districts={data.districtOptions} selected={data.selectedDistrict} />
      </div>

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
        note={
          data.selectedDistrictName
            ? `Four counts that add up to the ${data.selectedDistrictName} schools on the register.`
            : 'Four counts that add up to the register, so each one is a set you could go and list.'
        }
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
          note={
            data.districtsExcluded > 0
              ? `On self assessments finished. ${data.districtsExcluded} ${
                  data.districtsExcluded === 1 ? 'district is' : 'districts are'
                } too small to rank.`
              : 'On self assessments finished, whichever district is selected above.'
          }
        >
          <DistrictRankingTable districts={data.districts} />
        </Section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Management rows={data.management} unpopulated={data.managementUnpopulated} />

        <Card heading="Schools">
          {data.topBand && data.bottomBand ? (
            <>
              <GradeDoor
                title="Top schools in the state"
                band={data.topBand}
                tone="top"
                ofVerified={standing.verified}
              />
              <GradeDoor
                title="Bottom schools in the state"
                band={data.bottomBand}
                tone="bottom"
                ofVerified={standing.verified}
                divider
              />
              <p className="border-t border-gray-100 px-4 py-2.5 text-[11.5px] text-gray-400">
                Each opens the register filtered to that SQAAF grade and ordered by score, rather
                than naming one school here.
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
