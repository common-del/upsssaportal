'use client';

import { useMemo, useState } from 'react';
import type { InspectionAppeal } from '@/lib/verification/inspectionAppeals';

/**
 * The Appeals page's list, built for volume, per the approved mock.
 *
 * Waiting appeals are pinned above everything under their own heading, with the wait shown in
 * days, so the only appeals that can still change are never buried under history. The decided
 * pile reads newest first under month headings, ten rows at a time behind a labelled show-more
 * button. Past five appeals a find bar appears: status chips with counts, search by school name
 * or UDISE, a district filter, and a match line so a filtered page never masquerades as the
 * whole record. Below that size the page is just the rows.
 *
 * Everything is read-only: deciding appeals is the SSSA's Decisions page.
 */

const GOLD = '#BF9000';
const GOLD_DARK = '#7A5209';
const GOLD_WASH = '#FDF8EC';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';

const IST = 'Asia/Kolkata';
/** The find bar earns its place only at volume. */
const FIND_BAR_MIN = 6;
const DECIDED_PAGE = 10;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });

const monthLabel = (iso: string) => {
  const d = new Date(iso);
  const month = d.toLocaleDateString('en-IN', { month: 'long', timeZone: IST });
  const year = Number(d.toLocaleDateString('en-IN', { year: 'numeric', timeZone: IST }));
  const thisYear = Number(new Date().toLocaleDateString('en-IN', { year: 'numeric', timeZone: IST }));
  return year === thisYear ? month : `${month} ${year}`;
};

function daysWaiting(filedOn: string) {
  const istDay = (t: number) => Math.floor((t + 5.5 * 3_600_000) / 86_400_000);
  return Math.max(0, istDay(Date.now()) - istDay(new Date(filedOn).getTime()));
}

function waitingChipLabel(filedOn: string) {
  const days = daysWaiting(filedOn);
  if (days === 0) return 'Waiting since today';
  return `Waiting ${days} ${days === 1 ? 'day' : 'days'}`;
}

type Verdict = { label: string; solid: boolean; colour: string };

function verdictOf(appeal: InspectionAppeal): Verdict {
  if (appeal.status === 'SUBMITTED') return { label: waitingChipLabel(appeal.filedOn), solid: true, colour: RED };
  if (appeal.revisedCount === 0) return { label: 'Upheld in full', solid: true, colour: GREEN };
  if (appeal.keptCount === 0) return { label: 'Revised', solid: false, colour: RED };
  return { label: 'Partly revised', solid: true, colour: GOLD_DARK };
}

function Chip({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className="flex-none whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold"
      style={
        verdict.solid
          ? { backgroundColor: verdict.colour, color: 'white' }
          : { backgroundColor: 'white', border: `2px solid ${verdict.colour}`, color: verdict.colour }
      }
    >
      {verdict.label}
    </span>
  );
}

function ZoneLabel({ children, colour = INK_MUTED }: { children: React.ReactNode; colour?: string }) {
  return (
    <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: colour }}>
      {children}
    </p>
  );
}

function metaLine(appeal: InspectionAppeal) {
  const bits = [appeal.districtName, `inspected ${shortDate(appeal.inspectedOn)}`];
  if (appeal.status === 'SUBMITTED') {
    bits.push(`filed ${shortDate(appeal.filedOn)}`);
    bits.push(`${appeal.items.length} contested`);
  } else {
    if (appeal.decidedOn) bits.push(`decided ${shortDate(appeal.decidedOn)}`);
    const outcome = [
      appeal.keptCount > 0 ? `${appeal.keptCount} upheld` : null,
      appeal.revisedCount > 0 ? `${appeal.revisedCount} revised` : null,
    ].filter(Boolean);
    if (outcome.length) bits.push(outcome.join(', '));
  }
  return bits.filter(Boolean).join(' · ');
}

function AppealRow({
  appeal,
  open,
  onToggle,
}: {
  appeal: InspectionAppeal;
  open: boolean;
  onToggle: () => void;
}) {
  const verdict = verdictOf(appeal);
  const pending = appeal.status === 'SUBMITTED';
  return (
    <div className="rounded-xl border-2 bg-white" style={{ borderColor: open ? GOLD : '#E5E7EB' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <Chip verdict={verdict} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold" style={{ color: NAVY_DEEP }}>
            {appeal.schoolName}
          </span>
          <span className="mt-0.5 block text-xs" style={{ color: INK_MUTED }}>
            {metaLine(appeal)}
          </span>
        </span>
        <span
          aria-hidden
          className="flex-none text-lg font-bold"
          style={{ color: open ? GOLD_DARK : INK_MUTED, transform: open ? 'rotate(90deg)' : 'none' }}
        >
          ›
        </span>
      </button>
      {open && (
        <div className="border-t-2 px-4 py-3" style={{ borderColor: GOLD_WASH }}>
          <ul className="space-y-1.5 sm:columns-2 sm:gap-8">
            {appeal.items.map((item) => (
              <li key={item.code} className="break-inside-avoid text-sm">
                <span className="font-mono text-[11px] font-extrabold" style={{ color: GOLD_DARK }}>
                  {item.code}
                </span>{' '}
                <span className="text-gray-800">{item.titleEn}</span>
                {!pending && (
                  <span
                    className="ml-1 font-semibold"
                    style={{
                      color:
                        item.decision === 'KEEP_VERIFIER'
                          ? GREEN
                          : item.decision === 'ACCEPT_SCHOOL'
                            ? RED
                            : INK_MUTED,
                    }}
                  >
                    {item.decision === 'KEEP_VERIFIER'
                      ? '· upheld as you found it'
                      : item.decision === 'ACCEPT_SCHOOL'
                        ? '· revised to the school’s level'
                        : '· not yet ruled'}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {pending && (
            <p className="mt-2.5 text-xs" style={{ color: INK_MUTED }}>
              Nothing is needed from you. The SSSA rules on the school&apos;s justification and your
              recorded findings, including your notes and photographs.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function InspectionAppealsList({ appeals }: { appeals: InspectionAppeal[] }) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WAITING' | 'DECIDED'>('ALL');
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('ALL');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [decidedShown, setDecidedShown] = useState(DECIDED_PAGE);

  const waitingTotal = appeals.filter((a) => a.status === 'SUBMITTED').length;
  const districts = useMemo(
    () => [...new Set(appeals.map((a) => a.districtName).filter(Boolean))].sort(),
    [appeals],
  );
  const showFindBar = appeals.length >= FIND_BAR_MIN;

  const trimmed = query.trim().toLowerCase();
  const filtersActive = statusFilter !== 'ALL' || trimmed !== '' || district !== 'ALL';

  const matching = appeals.filter((a) => {
    if (statusFilter === 'WAITING' && a.status !== 'SUBMITTED') return false;
    if (statusFilter === 'DECIDED' && a.status !== 'DECIDED') return false;
    if (district !== 'ALL' && a.districtName !== district) return false;
    if (trimmed && !a.schoolName.toLowerCase().includes(trimmed) && !a.schoolUdise.includes(trimmed))
      return false;
    return true;
  });

  // Waiting first and never lost: longest wait on top. Decided newest first, grouped by month.
  const waiting = matching
    .filter((a) => a.status === 'SUBMITTED')
    .sort((a, b) => a.filedOn.localeCompare(b.filedOn));
  const decided = matching
    .filter((a) => a.status === 'DECIDED')
    .sort((a, b) => (b.decidedOn ?? '').localeCompare(a.decidedOn ?? ''));
  const decidedVisible = decided.slice(0, decidedShown);
  const decidedRemaining = decided.length - decidedVisible.length;

  const monthGroups: { label: string; rows: InspectionAppeal[] }[] = [];
  for (const appeal of decidedVisible) {
    const label = appeal.decidedOn ? monthLabel(appeal.decidedOn) : 'Decided';
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) last.rows.push(appeal);
    else monthGroups.push({ label, rows: [appeal] });
  }

  const keyOf = (a: InspectionAppeal) => `${a.schoolUdise}:${a.filedOn}`;

  function clearFilters() {
    setStatusFilter('ALL');
    setQuery('');
    setDistrict('ALL');
  }

  const chipStyle = (on: boolean) =>
    on
      ? { backgroundColor: NAVY_DEEP, borderColor: NAVY_DEEP, color: 'white' }
      : { borderColor: '#E5E7EB', backgroundColor: 'white', color: NAVY_DEEP };

  return (
    <div className="flex flex-col gap-3">
      {showFindBar && (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => setStatusFilter('ALL')} className="rounded-full border-2 px-3.5 py-1.5 text-[13px] font-extrabold" style={chipStyle(statusFilter === 'ALL')}>
              All <span className="font-bold opacity-75">{appeals.length.toLocaleString('en-IN')}</span>
            </button>
            <button type="button" onClick={() => setStatusFilter('WAITING')} className="rounded-full border-2 px-3.5 py-1.5 text-[13px] font-extrabold" style={chipStyle(statusFilter === 'WAITING')}>
              Waiting <span className="font-bold opacity-75">{waitingTotal.toLocaleString('en-IN')}</span>
            </button>
            <button type="button" onClick={() => setStatusFilter('DECIDED')} className="rounded-full border-2 px-3.5 py-1.5 text-[13px] font-extrabold" style={chipStyle(statusFilter === 'DECIDED')}>
              Decided <span className="font-bold opacity-75">{(appeals.length - waitingTotal).toLocaleString('en-IN')}</span>
            </button>
            <input
              id="appeal-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="School name or UDISE"
              className="min-w-[200px] flex-1 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: trimmed ? NAVY_DEEP : undefined }}
            />
            <select
              id="appeal-district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold"
              style={{ color: NAVY_DEEP }}
            >
              <option value="ALL">All districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {filtersActive && (
            <p className="text-[12.5px] font-bold" style={{ color: INK_MUTED }}>
              <span style={{ color: NAVY_DEEP }}>
                {matching.length.toLocaleString('en-IN')} of {appeals.length.toLocaleString('en-IN')}
              </span>{' '}
              appeals match
              {trimmed && <> &quot;{query.trim()}&quot;</>}
              {district !== 'ALL' && <> in {district}</>}
              {' · '}
              <button type="button" onClick={clearFilters} className="font-extrabold underline" style={{ color: RED }}>
                Clear filters
              </button>
            </p>
          )}
        </>
      )}

      {matching.length === 0 && (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
          <p className="text-sm font-bold" style={{ color: INK_MUTED }}>
            No appeals match. Clear the filters to see all {appeals.length.toLocaleString('en-IN')}.
          </p>
        </div>
      )}

      {waiting.length > 0 && (
        <>
          <ZoneLabel colour={RED}>Waiting on SSSA · {waiting.length.toLocaleString('en-IN')}</ZoneLabel>
          {waiting.map((appeal) => (
            <AppealRow
              key={keyOf(appeal)}
              appeal={appeal}
              open={openKey === keyOf(appeal)}
              onToggle={() => setOpenKey((k) => (k === keyOf(appeal) ? null : keyOf(appeal)))}
            />
          ))}
        </>
      )}

      {monthGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-3">
          <ZoneLabel>Decided · {group.label}</ZoneLabel>
          {group.rows.map((appeal) => (
            <AppealRow
              key={keyOf(appeal)}
              appeal={appeal}
              open={openKey === keyOf(appeal)}
              onToggle={() => setOpenKey((k) => (k === keyOf(appeal) ? null : keyOf(appeal)))}
            />
          ))}
        </div>
      ))}

      {decidedRemaining > 0 && (
        <button
          type="button"
          onClick={() => setDecidedShown((n) => n + DECIDED_PAGE)}
          className="rounded-lg border-2 bg-white px-4 py-3 text-sm font-extrabold"
          style={{ borderColor: NAVY_DEEP, color: NAVY_DEEP }}
        >
          Show {Math.min(DECIDED_PAGE, decidedRemaining).toLocaleString('en-IN')} more decided
          {decided[decidedVisible.length]?.decidedOn
            ? `, ${monthLabel(decided[decidedVisible.length]!.decidedOn!)} and earlier`
            : ''}
        </button>
      )}
    </div>
  );
}
