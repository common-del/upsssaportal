import { prisma } from '@/lib/db';
import { isManagementCode, MANAGEMENT_LABELS_SHORT } from '@/lib/schoolManagement';

/**
 * One question: has the school completed its profile.
 *
 * A profile is the four things a school fills in that have nothing to do with the
 * assessment cycle — its address, a public contact number, its fee disclosure, and
 * its mandatory documents. Deliberately cycle-independent: a certificate expiring
 * has nothing to do with which assessment window is open, and tying it to a cycle
 * would hide lapses in the gap between cycles, which is exactly when nobody looks.
 *
 * This replaced four separate tallies — expired documents, incomplete sets, no fee
 * disclosure, fully compliant — that were four readings of the same four facts. The
 * facts are now one status per school: completed, pending, or not started.
 *
 * Government schools are not asked to disclose fees; the school-side page is hidden
 * for them. So their profile is three parts, not four. Counting them short for a form
 * they cannot reach would put thousands of schools in breach of nothing.
 */

export type ProfileStatus = 'COMPLETE' | 'PARTIAL' | 'EMPTY';

export type ComplianceRow = {
  udise: string;
  name: string;
  district: string;
  block: string;
  /** Short label, or null where the UDISE extract has not been imported. */
  management: string | null;
  status: ProfileStatus;
  /** Of the parts that apply to this school. */
  missing: number;
  applicable: number;
};

export type ComplianceSummary = {
  totalSchools: number;
  complete: number;
  partial: number;
  empty: number;
  /** Coverage, not compliance. How many schools have ever filed each thing. */
  schoolsWithDocRecords: number;
  schoolsWithFeeRecords: number;
  /**
   * False when so few schools have filed anything that the figures describe the
   * state of the import rather than the state of compliance. Reporting "32,552
   * schools have not completed their profile" when six have ever uploaded a document
   * presents an empty table as mass non-compliance, which is the kind of number a
   * regulator acts on.
   */
  tracked: boolean;
  rows: ComplianceRow[];
  /** Rows matching the filter before the cap, so the page can say what it is not showing. */
  matched: number;
};

/** Below this share of the register carrying records, the page reports coverage
 *  instead of compliance. */
const TRACKED_THRESHOLD = 0.5;

/** The table is a worklist, not an export. Anyone who needs all 32,000 wants a
 *  download, which is a different feature. */
const MAX_ROWS = 100;

/** How many document types every school is expected to hold. */
async function expectedDocumentTypes(): Promise<number> {
  const types = await prisma.mandatoryDocument.findMany({
    distinct: ['documentType'],
    select: { documentType: true },
  });
  // Before any school has uploaded anything there are no rows to learn from, and
  // reporting "0 of 0" would read as compliant. Fall back to a non-zero expectation.
  return types.length || 6;
}

export type ComplianceFilters = {
  district?: string;
  management?: string;
  status?: string;
  q?: string;
};

export async function buildCompliance(filters: ComplianceFilters = {}): Promise<ComplianceSummary> {
  const now = new Date();
  const expected = await expectedDocumentTypes();

  const [schools, docRows, feeRows] = await Promise.all([
    // Narrow select over the whole register. It is ~32,000 rows of six small fields,
    // which is affordable for a page read a few times a day — and the status of each
    // school depends on joins across three tables, so counting it in SQL would mean
    // one query per combination. Revisit if the register grows an order of magnitude.
    prisma.school.findMany({
      select: {
        udise: true,
        nameEn: true,
        management: true,
        addressEn: true,
        publicPhone: true,
        district: { select: { nameEn: true } },
        block: { select: { nameEn: true } },
      },
      orderBy: { nameEn: 'asc' },
    }),
    prisma.mandatoryDocument.findMany({
      select: { schoolUdise: true, status: true, validTill: true },
    }),
    prisma.feeDisclosure.findMany({ select: { schoolUdise: true } }),
  ]);

  const feeFiled = new Set(feeRows.map((f) => f.schoolUdise));

  // UPLOADED and ACKNOWLEDGED count as held; EXPIRED does not, because a lapsed
  // certificate is not evidence of anything current. A document past validTill is
  // treated as lapsed even if the status sweep has not run — that sweep is a
  // background job and this page should not depend on it.
  const heldByUdise = new Map<string, number>();
  const anyDocByUdise = new Set<string>();
  for (const d of docRows) {
    anyDocByUdise.add(d.schoolUdise);
    const lapsed = d.status === 'EXPIRED' || (d.validTill != null && d.validTill < now);
    const held = !lapsed && (d.status === 'UPLOADED' || d.status === 'ACKNOWLEDGED');
    if (held) heldByUdise.set(d.schoolUdise, (heldByUdise.get(d.schoolUdise) ?? 0) + 1);
  }

  let complete = 0;
  let partial = 0;
  let empty = 0;
  const all: ComplianceRow[] = [];

  for (const s of schools) {
    const isGovt = s.management === 'GOVERNMENT';
    const hasAddress = !!s.addressEn?.trim();
    const hasPhone = !!s.publicPhone?.trim();
    const hasFees = feeFiled.has(s.udise);
    const hasDocs = (heldByUdise.get(s.udise) ?? 0) >= expected;

    // Three parts for a government school, four for everyone else.
    const parts = isGovt ? [hasAddress, hasPhone, hasDocs] : [hasAddress, hasPhone, hasFees, hasDocs];
    const done = parts.filter(Boolean).length;
    const missing = parts.length - done;

    // Nothing entered is worth separating from partly filled: one is a school that
    // has not been asked, the other is a school that started and stopped.
    const status: ProfileStatus =
      missing === 0 ? 'COMPLETE' : done === 0 && !anyDocByUdise.has(s.udise) ? 'EMPTY' : 'PARTIAL';

    if (status === 'COMPLETE') complete++;
    else if (status === 'PARTIAL') partial++;
    else empty++;

    all.push({
      udise: s.udise,
      name: s.nameEn,
      district: s.district?.nameEn ?? '—',
      block: s.block?.nameEn ?? '—',
      management: isManagementCode(s.management) ? MANAGEMENT_LABELS_SHORT[s.management] : null,
      status,
      missing,
      applicable: parts.length,
    });
  }

  const q = filters.q?.trim().toLowerCase() ?? '';
  const filtered = all.filter((r) => {
    if (filters.district && r.district !== filters.district) return false;
    if (filters.management && r.management !== filters.management) return false;
    if (filters.status === 'completed' && r.status !== 'COMPLETE') return false;
    if (filters.status === 'pending' && r.status !== 'PARTIAL') return false;
    if (filters.status === 'notstarted' && r.status !== 'EMPTY') return false;
    if (q && !r.name.toLowerCase().includes(q) && !r.udise.includes(filters.q!.trim())) return false;
    return true;
  });

  const total = schools.length;
  const withDocs = anyDocByUdise.size;
  const tracked =
    total > 0 && withDocs / total >= TRACKED_THRESHOLD && feeFiled.size / total >= TRACKED_THRESHOLD;

  return {
    totalSchools: total,
    complete,
    partial,
    empty,
    schoolsWithDocRecords: withDocs,
    schoolsWithFeeRecords: feeFiled.size,
    tracked,
    // Most incomplete first, so the schools with the furthest to go are at the top.
    rows: [...filtered]
      .sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name))
      .slice(0, MAX_ROWS),
    matched: filtered.length,
  };
}
