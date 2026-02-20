import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft, School, PlayCircle, CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getBatchSelfAssessmentScores, getBatchVerificationScores } from '@/lib/scoring';
import { getBatchRatingAggregates } from '@/lib/actions/rating';
import MonitoringClient from '@/components/monitoring/MonitoringClient';
import { UserCheck } from 'lucide-react';

const PAGE_SIZE = 20;

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('monitoring');
  const sp = await searchParams;

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Link href="/app/sssa" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
          <ArrowLeft size={16} /> {t('backToDashboard')}
        </Link>
        <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">{t('noCycle')}</div>
      </div>
    );
  }

  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });

  // Funnel stats
  const [totalSchools, started, submitted, verifierSubmitted] = await Promise.all([
    prisma.school.count(),
    prisma.selfAssessmentSubmission.count({ where: { cycleId: cycle.id, startedAt: { not: null } } }),
    prisma.selfAssessmentSubmission.count({ where: { cycleId: cycle.id, status: 'SUBMITTED' } }),
    prisma.verificationSubmission.count({ where: { cycleId: cycle.id, status: 'SUBMITTED' } }),
  ]);

  // Determine view mode
  const view = sp.view === 'district' ? 'district' : 'schools';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const filterDistrict = sp.district ?? '';
  const filterBlock = sp.block ?? '';
  const filterStatus = sp.status ?? '';
  const filterSa = sp.sa ?? '';
  const searchQ = sp.q ?? '';

  // Fetch districts and blocks for filters
  const [districts, blocks] = await Promise.all([
    prisma.district.findMany({ orderBy: { nameEn: 'asc' }, select: { code: true, nameEn: true, nameHi: true } }),
    filterDistrict
      ? prisma.block.findMany({ where: { districtCode: filterDistrict }, orderBy: { nameEn: 'asc' }, select: { code: true, nameEn: true, nameHi: true } })
      : Promise.resolve([]),
  ]);

  let schoolsData: {
    rows: { udise: string; nameEn: string; nameHi: string; districtCode: string; blockCode: string; category: string; saStatus: string; saScore: number | null; verifierScore: number | null; ratingAvg: number | null; ratingCount: number }[];
    total: number;
  } = { rows: [], total: 0 };

  let districtData: {
    code: string; nameEn: string; nameHi: string; total: number; started: number; submitted: number; avgScore: number | null; avgVerifierScore: number | null; avgRating: number | null;
  }[] = [];

  if (view === 'schools') {
    const where: Prisma.SchoolWhereInput = {};
    if (filterDistrict) where.districtCode = filterDistrict;
    if (filterBlock) where.blockCode = filterBlock;
    if (searchQ) {
      where.OR = [
        { nameEn: { contains: searchQ, mode: 'insensitive' } },
        { nameHi: { contains: searchQ, mode: 'insensitive' } },
        { udise: { contains: searchQ } },
      ];
    }

    const [schoolRows, total] = await Promise.all([
      prisma.school.findMany({
        where,
        orderBy: { nameEn: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { udise: true, nameEn: true, nameHi: true, districtCode: true, blockCode: true, category: true },
      }),
      prisma.school.count({ where }),
    ]);

    const udises = schoolRows.map((s) => s.udise);

    // Batch get submissions for these schools
    const submissions = await prisma.selfAssessmentSubmission.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises } },
      select: { schoolUdise: true, status: true, startedAt: true },
    });
    const subMap = new Map(submissions.map((s) => [s.schoolUdise, s]));

    // Batch scores
    const scores = framework ? await getBatchSelfAssessmentScores(cycle.id, framework.id, udises) : {};
    const vScores = framework ? await getBatchVerificationScores(cycle.id, framework.id, udises) : {};

    // Batch ratings
    const ratings = await getBatchRatingAggregates(udises);

    // Apply status filter post-fetch if needed
    let rows = schoolRows.map((s) => {
      const sub = subMap.get(s.udise);
      let saStatus = 'not_started';
      if (sub?.status === 'SUBMITTED') saStatus = 'submitted';
      else if (sub?.startedAt) saStatus = 'draft';

      const sc = scores[s.udise];
      const vs = vScores[s.udise];
      const rt = ratings[s.udise];

      return {
        ...s,
        saStatus,
        saScore: saStatus === 'submitted' ? (sc?.scorePercent ?? null) : null,
        verifierScore: vs?.scorePercent ?? null,
        ratingAvg: rt?.avg ?? null,
        ratingCount: rt?.count ?? 0,
      };
    });

    if (filterStatus) {
      rows = rows.filter((r) => r.saStatus === filterStatus);
    }
    if (filterSa === 'with') {
      rows = rows.filter((r) => r.saStatus !== 'not_started');
    } else if (filterSa === 'without') {
      rows = rows.filter((r) => r.saStatus === 'not_started');
    }

    schoolsData = { rows, total: (filterStatus || filterSa) ? rows.length : total };
  } else {
    // District view: aggregate
    const allDistricts = await prisma.district.findMany({
      orderBy: { nameEn: 'asc' },
      select: { code: true, nameEn: true, nameHi: true },
    });

    const districtSchoolCounts = await prisma.school.groupBy({
      by: ['districtCode'],
      _count: { _all: true },
    });
    const countMap = new Map(districtSchoolCounts.map((d) => [d.districtCode, d._count._all]));

    const allSubs = await prisma.selfAssessmentSubmission.findMany({
      where: { cycleId: cycle.id },
      select: { schoolUdise: true, status: true, startedAt: true, school: { select: { districtCode: true } } },
    });

    // Batch all school udises for scores
    const allSchoolUdises = allSubs.map((s) => s.schoolUdise);
    const allScores = framework ? await getBatchSelfAssessmentScores(cycle.id, framework.id, allSchoolUdises) : {};
    const allVScores = framework ? await getBatchVerificationScores(cycle.id, framework.id, allSchoolUdises) : {};
    const allRatings = await getBatchRatingAggregates(allSchoolUdises);

    const schoolsByDistrict = await prisma.school.findMany({
      select: { udise: true, districtCode: true },
    });
    const schoolDistrictMap = new Map(schoolsByDistrict.map((s) => [s.udise, s.districtCode]));

    const districtAgg: Record<string, { started: number; submitted: number; scores: number[]; vScores: number[]; ratings: number[] }> = {};
    for (const d of allDistricts) {
      districtAgg[d.code] = { started: 0, submitted: 0, scores: [], vScores: [], ratings: [] };
    }

    for (const sub of allSubs) {
      const dc = sub.school.districtCode;
      if (!districtAgg[dc]) continue;
      if (sub.startedAt) districtAgg[dc].started++;
      if (sub.status === 'SUBMITTED') districtAgg[dc].submitted++;
    }

    for (const [udise, sc] of Object.entries(allScores)) {
      if (sc.scorePercent !== null) {
        const dc = schoolDistrictMap.get(udise);
        if (dc && districtAgg[dc]) districtAgg[dc].scores.push(sc.scorePercent);
      }
    }

    for (const [udise, vs] of Object.entries(allVScores)) {
      if (vs.scorePercent !== null) {
        const dc = schoolDistrictMap.get(udise);
        if (dc && districtAgg[dc]) districtAgg[dc].vScores.push(vs.scorePercent);
      }
    }

    for (const [udise, rt] of Object.entries(allRatings)) {
      if (rt.avg > 0) {
        const dc = schoolDistrictMap.get(udise);
        if (dc && districtAgg[dc]) districtAgg[dc].ratings.push(rt.avg);
      }
    }

    districtData = allDistricts.map((d) => {
      const agg = districtAgg[d.code] ?? { started: 0, submitted: 0, scores: [], vScores: [], ratings: [] };
      return {
        ...d,
        total: countMap.get(d.code) ?? 0,
        started: agg.started,
        submitted: agg.submitted,
        avgScore: agg.scores.length > 0 ? Math.round(agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length) : null,
        avgVerifierScore: agg.vScores.length > 0 ? Math.round(agg.vScores.reduce((a, b) => a + b, 0) / agg.vScores.length) : null,
        avgRating: agg.ratings.length > 0 ? parseFloat((agg.ratings.reduce((a, b) => a + b, 0) / agg.ratings.length).toFixed(1)) : null,
      };
    });
  }

  const startedPct = totalSchools > 0 ? Math.round((started / totalSchools) * 100) : 0;
  const submittedPct = totalSchools > 0 ? Math.round((submitted / totalSchools) * 100) : 0;
  const verifiedPct = totalSchools > 0 ? Math.round((verifierSubmitted / totalSchools) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/app/sssa" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 text-sm text-text-secondary">
        {t('cycle')}: <span className="font-semibold text-navy-900">{cycle.name}</span>
      </p>

      {/* Cycle summary banner */}
      <div className="mt-4 rounded-lg border border-navy-200 bg-navy-50 px-4 py-2.5 text-sm text-navy-800">
        {t('cycleBanner', { total: totalSchools, started, submitted })}
      </div>

      {/* Funnel cards */}
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <StatCard icon={<School size={22} />} bg="bg-navy-50" color="text-navy-700" label={t('totalSchools')} value={totalSchools} />
        <StatCard icon={<PlayCircle size={22} />} bg="bg-amber-50" color="text-amber-600" label={t('started')} value={started} pct={startedPct} />
        <StatCard icon={<CheckCircle2 size={22} />} bg="bg-green-50" color="text-green-600" label={t('submitted')} value={submitted} pct={submittedPct} />
        <StatCard icon={<UserCheck size={22} />} bg="bg-indigo-50" color="text-indigo-600" label={t('verifierSubmitted')} value={verifierSubmitted} pct={verifiedPct} />
      </div>

      {/* Interactive table section */}
      <MonitoringClient
        view={view}
        schoolsData={schoolsData}
        districtData={districtData}
        districts={districts}
        blocks={blocks}
        filterDistrict={filterDistrict}
        filterBlock={filterBlock}
        filterStatus={filterStatus}
        filterSa={filterSa}
        searchQ={searchQ}
        page={page}
        pageSize={PAGE_SIZE}
        totalSchools={schoolsData.total}
      />
    </div>
  );
}

function StatCard({ icon, bg, color, label, value, pct }: {
  icon: React.ReactNode; bg: string; color: string; label: string; value: number; pct?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full ${bg} ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-navy-900">{value}</p>
      <p className="mt-0.5 text-sm text-text-secondary">{label}{pct !== undefined ? ` (${pct}%)` : ''}</p>
    </div>
  );
}
