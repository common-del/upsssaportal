import { prisma } from '@/lib/db';

/**
 * Obligations a school owes regardless of the assessment cycle.
 *
 * Mandatory documents and fee disclosure are collected by the portal and, until
 * now, read by nobody at the state — a school could sit with a lapsed document
 * indefinitely and no official page would show it. These are the three queries
 * that close that gap.
 *
 * Deliberately cycle-independent: a document expiring has nothing to do with which
 * assessment window is open, and tying it to a cycle would hide breaches in the
 * gap between cycles, which is exactly when nobody is looking.
 */

export type ComplianceRow = {
  udise: string;
  name: string;
  district: string;
  documentsHeld: number;
  documentsExpected: number;
  expired: number;
  feeDisclosed: boolean;
  /** Days since the oldest current breach began. Null when nothing is in breach. */
  daysInBreach: number | null;
};

export type ComplianceSummary = {
  totalSchools: number;
  expiredDocs: number;
  missingDocs: number;
  noFeeDisclosure: number;
  fullyCompliant: number;
  rows: ComplianceRow[];
};

const MAX_ROWS = 50;

/** How many document types every school is expected to hold. */
async function expectedDocumentTypes(): Promise<number> {
  const types = await prisma.mandatoryDocument.findMany({
    distinct: ['documentType'],
    select: { documentType: true },
  });
  // Before any school has uploaded anything there are no rows to learn from, and
  // reporting "0 of 0" would read as compliant. Fall back to a non-zero expectation
  // so the page says "0 of 6 held" rather than quietly passing everyone.
  return types.length || 6;
}

export async function buildCompliance(): Promise<ComplianceSummary> {
  const now = new Date();
  const [totalSchools, expected] = await Promise.all([
    prisma.school.count(),
    expectedDocumentTypes(),
  ]);

  const [expiredDocs, schoolsWithFee, docRows] = await Promise.all([
    prisma.mandatoryDocument.count({
      where: { status: 'EXPIRED' },
    }),
    prisma.feeDisclosure.count(),
    // Pulled once and grouped in memory. Per-school queries would be tens of
    // thousands of round trips for a page that is read a few times a day.
    prisma.mandatoryDocument.findMany({
      select: {
        schoolUdise: true,
        status: true,
        validTill: true,
        school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
      },
    }),
  ]);

  type Acc = {
    name: string;
    district: string;
    held: number;
    expired: number;
    oldestBreach: Date | null;
  };
  const bySchool = new Map<string, Acc>();

  for (const d of docRows) {
    const cur =
      bySchool.get(d.schoolUdise) ??
      ({
        name: d.school?.nameEn ?? d.schoolUdise,
        district: d.school?.district?.nameEn ?? '—',
        held: 0,
        expired: 0,
        oldestBreach: null,
      } satisfies Acc);

    // UPLOADED and ACKNOWLEDGED both count as held; EXPIRED does not, because a
    // lapsed certificate is not evidence of anything current.
    if (d.status === 'UPLOADED' || d.status === 'ACKNOWLEDGED') cur.held += 1;

    // A document is in breach when its status says so, or when its validity has
    // passed without the status having been swept yet — the sweep is a background
    // job and this page should not depend on it having run.
    const lapsed = d.status === 'EXPIRED' || (d.validTill != null && d.validTill < now);
    if (lapsed) {
      cur.expired += 1;
      const since = d.validTill ?? null;
      if (since && (!cur.oldestBreach || since < cur.oldestBreach)) cur.oldestBreach = since;
    }
    bySchool.set(d.schoolUdise, cur);
  }

  const feeUdises = new Set(
    (await prisma.feeDisclosure.findMany({ select: { schoolUdise: true } })).map((f) => f.schoolUdise),
  );

  const rows: ComplianceRow[] = [...bySchool.entries()]
    .map(([udise, a]) => ({
      udise,
      name: a.name,
      district: a.district,
      documentsHeld: a.held,
      documentsExpected: expected,
      expired: a.expired,
      feeDisclosed: feeUdises.has(udise),
      daysInBreach: a.oldestBreach
        ? Math.max(0, Math.floor((now.getTime() - a.oldestBreach.getTime()) / 86_400_000))
        : null,
    }))
    .filter((r) => r.expired > 0 || r.documentsHeld < r.documentsExpected || !r.feeDisclosed)
    // Longest-standing breach first: a lapse nobody has acted on for four months
    // is a different problem from one that happened last week.
    .sort((a, b) => (b.daysInBreach ?? -1) - (a.daysInBreach ?? -1) || b.expired - a.expired)
    .slice(0, MAX_ROWS);

  const schoolsMissingDocs = [...bySchool.values()].filter((a) => a.held < expected).length;
  // Schools with no MandatoryDocument rows at all never appear in docRows, so they
  // are counted here rather than being silently treated as compliant.
  const schoolsWithNoDocRows = totalSchools - bySchool.size;

  return {
    totalSchools,
    expiredDocs,
    missingDocs: schoolsMissingDocs + schoolsWithNoDocRows,
    noFeeDisclosure: Math.max(0, totalSchools - schoolsWithFee),
    fullyCompliant: Math.max(0, schoolsWithFee - schoolsMissingDocs - schoolsWithNoDocRows),
    rows,
  };
}
