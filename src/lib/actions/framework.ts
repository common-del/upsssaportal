'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import path from 'path';
import fs from 'fs';
import { validateFramework } from '@/lib/validators/framework';

/* ────────────────────────────────────────────────────────────
   Cycle management
   ──────────────────────────────────────────────────────────── */
export async function createCycle(name: string): Promise<{ success: boolean; message: string; clonedFrom?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, message: 'Cycle name is required.' };

  const existing = await prisma.cycle.findUnique({ where: { name: trimmed } });
  if (existing) return { success: false, message: 'A cycle with this name already exists.' };

  const newCycle = await prisma.cycle.create({ data: { name: trimmed, isActive: false } });

  // Find the latest published framework to clone from
  const sourceFramework = await prisma.framework.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    include: {
      cycle: { select: { name: true } },
      domains: { orderBy: { order: 'asc' } },
      subDomains: { orderBy: { order: 'asc' } },
      parameters: {
        orderBy: { order: 'asc' },
        include: { options: { orderBy: { order: 'asc' } } },
      },
      rubricMappings: true,
      levels: { orderBy: { order: 'asc' } },
      gradeBands: { orderBy: { order: 'asc' } },
    },
  });

  if (!sourceFramework) {
    revalidatePath('/app/sssa/frameworks');
    return { success: true, message: '' };
  }

  await cloneFrameworkIntoCycle(sourceFramework, newCycle.id);
  revalidatePath('/app/sssa/frameworks');
  return { success: true, message: '', clonedFrom: sourceFramework.cycle.name };
}

async function cloneFrameworkIntoCycle(
  source: NonNullable<Awaited<ReturnType<typeof prisma.framework.findFirst<{
    include: {
      cycle: { select: { name: true } };
      domains: true;
      subDomains: true;
      parameters: { include: { options: true } };
      rubricMappings: true;
      levels: true;
      gradeBands: true;
    };
  }>>>>,
  newCycleId: string,
) {
  const newFw = await prisma.framework.create({
    data: {
      cycleId: newCycleId,
      status: 'DRAFT',
      version: source.version + 1,
    },
  });
  const fwId = newFw.id;

  // Map old IDs to new IDs for relational integrity
  const domainIdMap = new Map<string, string>();
  const subDomainIdMap = new Map<string, string>();
  const parameterIdMap = new Map<string, string>();

  // Clone domains
  for (const d of source.domains) {
    const newDomain = await prisma.sqaafDomain.create({
      data: {
        frameworkId: fwId,
        code: d.code,
        titleEn: d.titleEn,
        titleHi: d.titleHi,
        order: d.order,
        weightPercent: d.weightPercent,
        isActive: d.isActive,
      },
    });
    domainIdMap.set(d.id, newDomain.id);
  }

  // Clone subdomains
  for (const sd of source.subDomains) {
    const newDomainId = domainIdMap.get(sd.domainId);
    if (!newDomainId) continue;
    const newSub = await prisma.subDomain.create({
      data: {
        frameworkId: fwId,
        domainId: newDomainId,
        code: sd.code,
        titleEn: sd.titleEn,
        titleHi: sd.titleHi,
        order: sd.order,
        isActive: sd.isActive,
      },
    });
    subDomainIdMap.set(sd.id, newSub.id);
  }

  // Clone parameters with options
  for (const p of source.parameters) {
    const newSubId = subDomainIdMap.get(p.subDomainId);
    if (!newSubId) continue;
    const newParam = await prisma.parameter.create({
      data: {
        frameworkId: fwId,
        subDomainId: newSubId,
        code: p.code,
        titleEn: p.titleEn,
        titleHi: p.titleHi,
        order: p.order,
        applicability: p.applicability as string[],
        inputType: p.inputType,
        evidenceRequired: p.evidenceRequired,
        dataSources: p.dataSources as string[],
        isActive: p.isActive,
      },
    });
    parameterIdMap.set(p.id, newParam.id);

    // Clone options
    for (const opt of p.options) {
      await prisma.parameterOption.create({
        data: {
          parameterId: newParam.id,
          key: opt.key,
          labelEn: opt.labelEn,
          labelHi: opt.labelHi,
          order: opt.order,
          isActive: opt.isActive,
        },
      });
    }
  }

  // Clone rubric mappings
  for (const rm of source.rubricMappings) {
    const newParamId = parameterIdMap.get(rm.parameterId);
    if (!newParamId) continue;
    await prisma.rubricMapping.create({
      data: {
        frameworkId: fwId,
        parameterId: newParamId,
        optionKey: rm.optionKey,
        score: rm.score,
      },
    });
  }

  // Clone framework levels
  for (const lv of source.levels) {
    await prisma.frameworkLevel.create({
      data: {
        frameworkId: fwId,
        key: lv.key,
        labelEn: lv.labelEn,
        labelHi: lv.labelHi,
        order: lv.order,
      },
    });
  }

  // Clone grade bands
  for (const gb of source.gradeBands) {
    await prisma.gradeBand.create({
      data: {
        frameworkId: fwId,
        key: gb.key,
        labelEn: gb.labelEn,
        labelHi: gb.labelHi,
        minPercent: gb.minPercent,
        maxPercent: gb.maxPercent,
        order: gb.order,
      },
    });
  }
}

export async function toggleActiveCycle(cycleId: string) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return;

  if (cycle.isActive) {
    await prisma.cycle.update({ where: { id: cycleId }, data: { isActive: false } });
  } else {
    // Deactivate all, then activate this one
    await prisma.cycle.updateMany({ data: { isActive: false } });
    await prisma.cycle.update({ where: { id: cycleId }, data: { isActive: true } });
  }
  revalidatePath('/app/sssa/frameworks');
}

export async function deleteCycle(cycleId: string) {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: { frameworks: { select: { id: true } }, _count: { select: { ratings: true } } },
  });
  if (!cycle) return { success: false, message: 'Cycle not found.' };
  if (cycle._count.ratings > 0)
    return { success: false, message: 'Cannot delete a cycle that has parent ratings.' };

  await prisma.framework.deleteMany({ where: { cycleId } });
  await prisma.cycle.delete({ where: { id: cycleId } });
  revalidatePath('/app/sssa/frameworks');
  return { success: true, message: '' };
}

export async function unpublishFramework(frameworkId: string) {
  const fw = await prisma.framework.findUnique({ where: { id: frameworkId } });
  if (!fw || fw.status !== 'PUBLISHED') return;
  await prisma.framework.update({
    where: { id: frameworkId },
    data: { status: 'DRAFT', publishedAt: null, publishedBy: null },
  });
  revalidatePath('/app/sssa/frameworks');
  revalidatePath(`/app/sssa/frameworks/${frameworkId}`);
}

/* ────────────────────────────────────────────────────────────
   Applicability mapping from Excel values to DB codes
   ──────────────────────────────────────────────────────────── */
const APPLICABILITY_MAP: Record<string, string[]> = {
  All: ['PRIMARY', 'UPPER_PRIMARY', 'SECONDARY'],
  PS: ['PRIMARY'],
  UPS: ['UPPER_PRIMARY'],
  'UPS/Secondary': ['UPPER_PRIMARY', 'SECONDARY'],
  Secondary: ['SECONDARY'],
};

/* ────────────────────────────────────────────────────────────
   Bilingual text splitter: Hindi first, then English
   ──────────────────────────────────────────────────────────── */
function splitBilingual(text: string): { hi: string; en: string } {
  if (!text || !text.trim()) return { hi: '', en: '' };
  const trimmed = text.trim();

  // Pattern 1: Newline separator – Hindi above, English below
  if (trimmed.includes('\n')) {
    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      return { hi: lines[0], en: lines.slice(1).join(' ').replace(/^\(/, '').replace(/\)$/, '') };
    }
    return { hi: lines[0] || '', en: lines[0] || '' };
  }

  // Pattern 2: English in parentheses at end – "Hindi text (English text)"
  const parenMatch = trimmed.match(/^(.+?)\s*\(([A-Za-z][\s\S]+)\)$/);
  if (parenMatch) {
    return { hi: parenMatch[1].trim(), en: parenMatch[2].trim() };
  }

  return { hi: trimmed, en: trimmed };
}

/* ────────────────────────────────────────────────────────────
   Import SQAAF from Excel
   ──────────────────────────────────────────────────────────── */
export async function importSqaafFromExcel(targetCycleId?: string): Promise<{ success: boolean; message: string }> {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const XLSX = require('xlsx') as typeof import('xlsx');
    const filePath = path.join(process.cwd(), 'data', 'sqaaf', 'SQAAF Draft 1 UP.xlsx');
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets['SQAAF (combined)'];
    if (!ws) return { success: false, message: 'Sheet "SQAAF (combined)" not found.' };

    const rows: (string | number)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Resolve cycle: use provided cycleId, or fall back to active, or create default
    let cycle = targetCycleId
      ? await prisma.cycle.findUnique({ where: { id: targetCycleId } })
      : await prisma.cycle.findFirst({ where: { isActive: true } });
    if (!cycle) {
      cycle = await prisma.cycle.upsert({
        where: { name: '2025-26' },
        update: { isActive: true },
        create: { name: '2025-26', isActive: true },
      });
    }

    // Find or create DRAFT framework for this cycle
    let framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
    if (framework && framework.status === 'PUBLISHED') {
      return { success: false, message: 'Framework is already published. Cannot re-import.' };
    }
    if (!framework) {
      framework = await prisma.framework.create({
        data: { cycleId: cycle.id, status: 'DRAFT', version: 1 },
      });
    }

    const fwId = framework.id;

    // Parse rows
    let domainIdx = 0;
    let currentDomainId = '';
    let subDomainIdx = 0;
    let currentSubDomainId = '';
    let paramIdx = 0;

    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      const col0 = String(row[0] || '').trim();
      const col1 = String(row[1] || '').trim();
      if (!col0 && !col1) continue;

      // ── DOMAIN row ──
      if (col0.startsWith('DOMAIN')) {
        domainIdx++;
        subDomainIdx = 0;
        paramIdx = 0;
        const code = `D${domainIdx}`;
        const domain = await prisma.sqaafDomain.upsert({
          where: { frameworkId_code: { frameworkId: fwId, code } },
          update: { titleEn: col1, order: domainIdx },
          create: { frameworkId: fwId, code, titleEn: col1, titleHi: col1, order: domainIdx, isActive: true },
        });
        currentDomainId = domain.id;
        continue;
      }

      // ── SUBDOMAIN row (e.g. "1.1", "2.3") ──
      if (/^[0-9]+\.[0-9]+$/.test(col0) && !currentDomainId) continue;
      if (/^[0-9]+\.[0-9]+$/.test(col0)) {
        subDomainIdx++;
        paramIdx = 0;
        const code = `SD${domainIdx}_${subDomainIdx}`;
        const sub = await prisma.subDomain.upsert({
          where: { frameworkId_code: { frameworkId: fwId, code } },
          update: { titleEn: col1, order: subDomainIdx },
          create: {
            frameworkId: fwId,
            domainId: currentDomainId,
            code,
            titleEn: col1,
            titleHi: col1,
            order: subDomainIdx,
            isActive: true,
          },
        });
        currentSubDomainId = sub.id;
        continue;
      }

      // ── PARAMETER row (e.g. "1.1.1", "3.2.10") ──
      if (/^[0-9]+\.[0-9]+\.[0-9]+/.test(col0) && currentSubDomainId) {
        paramIdx++;
        const code = `P${domainIdx}_${subDomainIdx}_${String(paramIdx).padStart(2, '0')}`;

        // Clean title (may contain newlines for multi-line titles)
        const titleClean = col1.replace(/\n/g, ' ').trim();

        // Parse level texts
        const l1 = splitBilingual(String(row[2] || ''));
        const l2 = splitBilingual(String(row[3] || ''));
        const l3 = splitBilingual(String(row[4] || ''));

        // Applicability
        const appRaw = String(row[5] || 'All').trim();
        const applicability = APPLICABILITY_MAP[appRaw] || APPLICABILITY_MAP['All'];

        const param = await prisma.parameter.upsert({
          where: { frameworkId_code: { frameworkId: fwId, code } },
          update: { titleEn: titleClean, order: paramIdx, applicability },
          create: {
            frameworkId: fwId,
            subDomainId: currentSubDomainId,
            code,
            titleEn: titleClean,
            titleHi: titleClean,
            order: paramIdx,
            applicability,
            inputType: 'SINGLE_SELECT',
            evidenceRequired: false,
            dataSources: ['Manual'],
            isActive: true,
          },
        });

        // Upsert 3 options (LEVEL_1, LEVEL_2, LEVEL_3)
        const levels = [
          { key: 'LEVEL_1', data: l1, order: 1 },
          { key: 'LEVEL_2', data: l2, order: 2 },
          { key: 'LEVEL_3', data: l3, order: 3 },
        ];

        for (const lv of levels) {
          await prisma.parameterOption.upsert({
            where: { parameterId_key: { parameterId: param.id, key: lv.key } },
            update: { labelEn: lv.data.en, labelHi: lv.data.hi, order: lv.order },
            create: {
              parameterId: param.id,
              key: lv.key,
              labelEn: lv.data.en,
              labelHi: lv.data.hi,
              order: lv.order,
              isActive: true,
            },
          });
        }

        // Rubric defaults: LEVEL_1=1, LEVEL_2=2, LEVEL_3=3
        for (const [key, score] of [['LEVEL_1', 1], ['LEVEL_2', 2], ['LEVEL_3', 3]] as const) {
          await prisma.rubricMapping.upsert({
            where: {
              frameworkId_parameterId_optionKey: { frameworkId: fwId, parameterId: param.id, optionKey: key },
            },
            update: {},
            create: { frameworkId: fwId, parameterId: param.id, optionKey: key, score },
          });
        }
      }
    }

    // Seed framework levels
    const defaultLevels = [
      { key: 'LEVEL_1', labelEn: 'Level 1', labelHi: 'स्तर 1', order: 1 },
      { key: 'LEVEL_2', labelEn: 'Level 2', labelHi: 'स्तर 2', order: 2 },
      { key: 'LEVEL_3', labelEn: 'Level 3', labelHi: 'स्तर 3', order: 3 },
    ];
    for (const lv of defaultLevels) {
      await prisma.frameworkLevel.upsert({
        where: { frameworkId_key: { frameworkId: fwId, key: lv.key } },
        update: {},
        create: { frameworkId: fwId, ...lv },
      });
    }

    // Seed default grade bands (Uday, Unnat, Utkarsh)
    const defaultBands = [
      { key: 'UDAY', labelEn: 'Uday', labelHi: 'उदय', minPercent: 0, maxPercent: 40, order: 1 },
      { key: 'UNNAT', labelEn: 'Unnat', labelHi: 'उन्नत', minPercent: 40, maxPercent: 70, order: 2 },
      { key: 'UTKARSH', labelEn: 'Utkarsh', labelHi: 'उत्कर्ष', minPercent: 70, maxPercent: 100, order: 3 },
    ];
    for (const band of defaultBands) {
      await prisma.gradeBand.upsert({
        where: { frameworkId_key: { frameworkId: fwId, key: band.key } },
        update: {},
        create: { frameworkId: fwId, ...band },
      });
    }

    revalidatePath('/app/sssa/frameworks');
    const paramCount = await prisma.parameter.count({ where: { frameworkId: fwId } });
    return { success: true, message: `Imported ${paramCount} parameters across 5 domains.` };
  } catch (err) {
    console.error('Import error:', err);
    return { success: false, message: String(err) };
  }
}

/* ────────────────────────────────────────────────────────────
   Get framework with full tree
   ──────────────────────────────────────────────────────────── */
export async function getFrameworkFull(frameworkId: string) {
  return prisma.framework.findUnique({
    where: { id: frameworkId },
    include: {
      cycle: true,
      domains: {
        orderBy: { order: 'asc' },
        include: {
          subDomains: {
            orderBy: { order: 'asc' },
            include: {
              parameters: {
                orderBy: { order: 'asc' },
                include: {
                  options: { orderBy: { order: 'asc' } },
                  rubricMappings: true,
                },
              },
            },
          },
        },
      },
      levels: { orderBy: { order: 'asc' } },
      gradeBands: { orderBy: { order: 'asc' } },
    },
  });
}

/* ────────────────────────────────────────────────────────────
   Update domain weight
   ──────────────────────────────────────────────────────────── */
export async function updateDomainWeight(domainId: string, weightPercent: number) {
  const domain = await prisma.sqaafDomain.findUnique({ where: { id: domainId }, include: { framework: true } });
  if (!domain || domain.framework.status === 'PUBLISHED') return;
  await prisma.sqaafDomain.update({ where: { id: domainId }, data: { weightPercent } });
  revalidatePath(`/app/sssa/frameworks/${domain.frameworkId}`);
}

/* ────────────────────────────────────────────────────────────
   Update framework level labels
   ──────────────────────────────────────────────────────────── */
export async function updateFrameworkLevel(levelId: string, labelEn: string, labelHi: string) {
  const level = await prisma.frameworkLevel.findUnique({ where: { id: levelId }, include: { framework: true } });
  if (!level || level.framework.status === 'PUBLISHED') return;
  await prisma.frameworkLevel.update({ where: { id: levelId }, data: { labelEn, labelHi } });
  revalidatePath(`/app/sssa/frameworks/${level.frameworkId}`);
}

/* ────────────────────────────────────────────────────────────
   Update grade band
   ──────────────────────────────────────────────────────────── */
export async function updateGradeBand(
  bandId: string,
  data: { labelEn: string; labelHi: string; minPercent: number; maxPercent: number },
) {
  const band = await prisma.gradeBand.findUnique({ where: { id: bandId }, include: { framework: true } });
  if (!band || band.framework.status === 'PUBLISHED') return;
  await prisma.gradeBand.update({ where: { id: bandId }, data });
  revalidatePath(`/app/sssa/frameworks/${band.frameworkId}`);
}

/* ────────────────────────────────────────────────────────────
   Toggle parameter active/inactive
   ──────────────────────────────────────────────────────────── */
export async function toggleParameter(parameterId: string) {
  const param = await prisma.parameter.findUnique({ where: { id: parameterId }, include: { framework: true } });
  if (!param || param.framework.status === 'PUBLISHED') return;
  await prisma.parameter.update({ where: { id: parameterId }, data: { isActive: !param.isActive } });
  revalidatePath(`/app/sssa/frameworks/${param.frameworkId}`);
}

/* ────────────────────────────────────────────────────────────
   Delete parameter (DRAFT only)
   ──────────────────────────────────────────────────────────── */
export async function deleteParameter(parameterId: string) {
  const param = await prisma.parameter.findUnique({ where: { id: parameterId }, include: { framework: true } });
  if (!param || param.framework.status === 'PUBLISHED') return;
  await prisma.parameter.delete({ where: { id: parameterId } });
  revalidatePath(`/app/sssa/frameworks/${param.frameworkId}`);
}

/* ────────────────────────────────────────────────────────────
   Update parameter details
   ──────────────────────────────────────────────────────────── */
export async function updateParameter(
  parameterId: string,
  data: {
    titleEn?: string;
    titleHi?: string;
    applicability?: string[];
    evidenceRequired?: boolean;
    dataSources?: string[];
  },
) {
  const param = await prisma.parameter.findUnique({ where: { id: parameterId }, include: { framework: true } });
  if (!param || param.framework.status === 'PUBLISHED') return;
  await prisma.parameter.update({ where: { id: parameterId }, data });
  revalidatePath(`/app/sssa/frameworks/${param.frameworkId}`);
}

/* ────────────────────────────────────────────────────────────
   Update option (level descriptor) labels
   ──────────────────────────────────────────────────────────── */
export async function updateOptionLabels(
  optionId: string,
  data: { labelEn: string; labelHi: string },
) {
  const opt = await prisma.parameterOption.findUnique({
    where: { id: optionId },
    include: { parameter: { include: { framework: true } } },
  });
  if (!opt || opt.parameter.framework.status === 'PUBLISHED') return;
  await prisma.parameterOption.update({ where: { id: optionId }, data });
  revalidatePath(`/app/sssa/frameworks/${opt.parameter.framework.id}`);
}

/* ────────────────────────────────────────────────────────────
   Update rubric score for a parameter option
   ──────────────────────────────────────────────────────────── */
export async function updateRubricScore(mappingId: string, score: number) {
  const mapping = await prisma.rubricMapping.findUnique({
    where: { id: mappingId },
    include: { framework: true },
  });
  if (!mapping || mapping.framework.status === 'PUBLISHED') return;
  await prisma.rubricMapping.update({ where: { id: mappingId }, data: { score } });
  revalidatePath(`/app/sssa/frameworks/${mapping.frameworkId}`);
}

/* ────────────────────────────────────────────────────────────
   Reorder parameter within subdomain
   ──────────────────────────────────────────────────────────── */
export async function reorderParameters(subDomainId: string, orderedIds: string[]) {
  const sub = await prisma.subDomain.findUnique({ where: { id: subDomainId }, include: { framework: true } });
  if (!sub || sub.framework.status === 'PUBLISHED') return;

  for (let i = 0; i < orderedIds.length; i++) {
    await prisma.parameter.update({
      where: { id: orderedIds[i] },
      data: { order: i + 1 },
    });
  }
  revalidatePath(`/app/sssa/frameworks/${sub.frameworkId}`);
}

/* ────────────────────────────────────────────────────────────
   Publish framework (atomic lock)
   ──────────────────────────────────────────────────────────── */
export async function publishFramework(frameworkId: string, userId: string) {
  const fw = await getFrameworkFull(frameworkId);
  if (!fw) return { success: false, errors: [{ code: 'NOT_FOUND', message: 'Framework not found.' }] };

  const errors = validateFramework(fw);
  if (errors.length > 0) return { success: false, errors };

  await prisma.framework.update({
    where: { id: frameworkId },
    data: { status: 'PUBLISHED', publishedAt: new Date(), publishedBy: userId },
  });

  revalidatePath(`/app/sssa/frameworks/${frameworkId}`);
  revalidatePath('/app/sssa/frameworks');
  return { success: true, errors: [] };
}
