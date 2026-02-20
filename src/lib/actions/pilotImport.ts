'use server';

import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/db';

const PILOT_FILE = path.join(process.cwd(), 'data', 'pilot', 'SQAAF Pilot Responses UP Feb.xlsx');
const PREFERRED_SHEET = 'Form Responses 1';

// ─── Column helpers ───

function colToIndex(col: string): number {
  let idx = 0;
  for (const ch of col.toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

const HARD_IGNORED = new Set([
  colToIndex('A'),
  colToIndex('B'),
  colToIndex('F'),
  colToIndex('I'),
  colToIndex('J'),
  colToIndex('GA'),
]);

function isEvidenceCol(header: string): boolean {
  return /evidence\s*required/i.test(header);
}

function identifyMeta(header: string): string | null {
  const h = String(header || '');
  if (h.includes('UDISE') && (h.includes('कोड') || h.includes('Code'))) return 'udise';
  if (h.includes('विद्यालय का नाम') || h.includes('Name of School')) return 'schoolName';
  if ((h.includes('ज़िला') || h.includes('ज़िला')) && !h.includes('UDISE')) return 'district';
  if (h.includes('ब्लॉक') && !h.includes('UDISE')) return 'block';
  if (h.includes('विद्यालय का प्रकार') || h.includes('Type of school')) return 'schoolType';
  return null;
}

// ─── Cell value mappers ───

function mapLevel(cell: unknown): string | null {
  if (cell == null) return null;
  const s = String(cell).trim();
  if (!s) return null;
  if (/level\s*3\b/i.test(s) || /स्तर\s*3/.test(s) || s.includes('LEVEL_3')) return 'LEVEL_3';
  if (/level\s*2\b/i.test(s) || /स्तर\s*2/.test(s) || s.includes('LEVEL_2')) return 'LEVEL_2';
  if (/level\s*1\b/i.test(s) || /स्तर\s*1/.test(s) || s.includes('LEVEL_1')) return 'LEVEL_1';
  return null;
}

function mapSchoolCategory(raw: unknown): string {
  const s = String(raw || '').toLowerCase();
  if (s.includes('upper primary') || s.includes('उच्च प्राथमिक')) return 'Upper Primary';
  if (s.includes('secondary') || s.includes('माध्यमिक')) return 'Secondary';
  if (s.includes('primary') || s.includes('प्राथमिक')) return 'Primary';
  return 'Primary';
}

const CATEGORY_TO_CODE: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

function splitBilingual(raw: string): { en: string; hi: string } {
  if (!raw) return { en: '', hi: '' };
  const s = raw.trim();
  for (const sep of ['\n', ' / ']) {
    if (s.includes(sep)) {
      const parts = s.split(sep).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) return { hi: parts[0], en: parts[1] };
    }
  }
  return { en: s, hi: s };
}

// ─── Read Excel ───

function readSheet() {
  if (!fs.existsSync(PILOT_FILE)) throw new Error(`Pilot file not found: ${PILOT_FILE}`);
  const workbook = XLSX.readFile(PILOT_FILE);
  const sheetName = workbook.SheetNames.includes(PREFERRED_SHEET)
    ? PREFERRED_SHEET
    : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet['!ref']) throw new Error('Sheet is empty.');

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const totalCols = range.e.c + 1;

  const getCell = (r: number, c: number): string => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[addr];
    return cell ? String(cell.v ?? '') : '';
  };

  const headers: string[] = [];
  for (let c = 0; c < totalCols; c++) headers.push(getCell(range.s.r, c));

  const dataRows: string[][] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = 0; c < totalCols; c++) row.push(getCell(r, c));
    if (row.some((v) => v.trim())) dataRows.push(row);
  }

  return { sheetName, headers, dataRows, totalCols };
}

function classifyColumns(headers: string[]) {
  const metaIndices = new Map<string, number>();
  const ignoredIndices = new Set<number>();
  const paramColIndices: number[] = [];

  for (let i = 0; i < headers.length; i++) {
    if (HARD_IGNORED.has(i)) { ignoredIndices.add(i); continue; }
    if (isEvidenceCol(headers[i])) { ignoredIndices.add(i); continue; }
    const metaKey = identifyMeta(headers[i]);
    if (metaKey) { metaIndices.set(metaKey, i); ignoredIndices.add(i); continue; }
    paramColIndices.push(i);
  }

  return { metaIndices, ignoredIndices, paramColIndices };
}

// ─── Types ───

export type ValidationResult = {
  success: boolean;
  sheetName: string;
  totalRows: number;
  nFramework: number;
  nExcel: number;
  matched: boolean;
  sampleMapping: { index: number; excelHeader: string; paramCode: string; paramTitleHi: string; paramTitleEn: string }[];
  excelHeadersPreview: string[];
  frameworkParamsPreview: { code: string; titleHi: string; titleEn: string }[];
  error?: string;
};

export type ImportResult = {
  success: boolean;
  rowsProcessed: number;
  schoolsCreated: number;
  districtsCreated: number;
  blocksCreated: number;
  submissionsCreated: number;
  submissionsSubmitted: number;
  submissionsDraft: number;
  submissionsSkipped: number;
  errors: { row: number; reason: string }[];
  warnings: { row: number; reason: string }[];
};

// ─── Load framework parameters in canonical order ───

async function getFrameworkParams() {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) throw new Error('No active cycle.');
  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework || framework.status !== 'PUBLISHED') throw new Error('No published framework.');

  const params = await prisma.parameter.findMany({
    where: { frameworkId: framework.id, isActive: true },
    select: {
      id: true, code: true, titleEn: true, titleHi: true,
      applicability: true, order: true,
      subDomain: {
        select: {
          order: true,
          domain: { select: { order: true } },
        },
      },
    },
    orderBy: [
      { subDomain: { domain: { order: 'asc' } } },
      { subDomain: { order: 'asc' } },
      { order: 'asc' },
    ],
  });

  return { cycle, framework, params };
}

// ─── Validate ───

export async function validatePilotFile(): Promise<ValidationResult> {
  try {
    const { sheetName, headers, dataRows } = readSheet();
    const { paramColIndices } = classifyColumns(headers);
    const { params } = await getFrameworkParams();

    const nExcel = paramColIndices.length;
    const nFramework = params.length;
    const matched = nExcel === nFramework;

    const limit = 20;
    const sampleMapping = Array.from({ length: Math.min(limit, Math.min(nExcel, nFramework)) }, (_, i) => ({
      index: i,
      excelHeader: headers[paramColIndices[i]]?.slice(0, 120) ?? '',
      paramCode: params[i].code,
      paramTitleHi: params[i].titleHi,
      paramTitleEn: params[i].titleEn,
    }));

    return {
      success: true,
      sheetName,
      totalRows: dataRows.length,
      nExcel,
      nFramework,
      matched,
      sampleMapping,
      excelHeadersPreview: paramColIndices.slice(0, limit).map((i) => headers[i]?.slice(0, 120) ?? ''),
      frameworkParamsPreview: params.slice(0, limit).map((p) => ({ code: p.code, titleHi: p.titleHi, titleEn: p.titleEn })),
    };
  } catch (e) {
    return {
      success: false, sheetName: '', totalRows: 0, nExcel: 0, nFramework: 0,
      matched: false, sampleMapping: [], excelHeadersPreview: [], frameworkParamsPreview: [],
      error: (e as Error).message,
    };
  }
}

// ─── Import ───

export async function runPilotImport(): Promise<ImportResult> {
  const result: ImportResult = {
    success: false, rowsProcessed: 0, schoolsCreated: 0,
    districtsCreated: 0, blocksCreated: 0,
    submissionsCreated: 0, submissionsSubmitted: 0, submissionsDraft: 0, submissionsSkipped: 0,
    errors: [], warnings: [],
  };

  try {
    const { headers, dataRows } = readSheet();
    const { metaIndices, paramColIndices } = classifyColumns(headers);
    const { cycle, framework, params } = await getFrameworkParams();

    if (paramColIndices.length !== params.length) {
      result.errors.push({ row: 0, reason: `Column count mismatch: ${paramColIndices.length} Excel vs ${params.length} framework` });
      return result;
    }

    const udiseIdx = metaIndices.get('udise');
    const nameIdx = metaIndices.get('schoolName');
    const distIdx = metaIndices.get('district');
    const blockIdx = metaIndices.get('block');
    const typeIdx = metaIndices.get('schoolType');

    if (udiseIdx == null || nameIdx == null || distIdx == null || blockIdx == null || typeIdx == null) {
      result.errors.push({ row: 0, reason: 'Could not identify all metadata columns.' });
      return result;
    }

    // Pre-load caches
    const existingDistricts = await prisma.district.findMany();
    const distByName = new Map<string, typeof existingDistricts[0]>();
    const distCodes = new Set<string>();
    for (const d of existingDistricts) {
      distByName.set(d.nameEn.toLowerCase(), d);
      distByName.set(d.nameHi.toLowerCase(), d);
      distCodes.add(d.code);
    }
    let distSeq = 0;
    const nextDistCode = () => {
      distSeq++;
      while (distCodes.has(`PD${String(distSeq).padStart(3, '0')}`)) distSeq++;
      const code = `PD${String(distSeq).padStart(3, '0')}`;
      distCodes.add(code);
      return code;
    };

    const existingBlocks = await prisma.block.findMany();
    const blockByKey = new Map<string, typeof existingBlocks[0]>();
    const blockCodes = new Set<string>();
    for (const b of existingBlocks) {
      blockByKey.set(`${b.districtCode}::${b.nameEn.toLowerCase()}`, b);
      blockByKey.set(`${b.districtCode}::${b.nameHi.toLowerCase()}`, b);
      blockCodes.add(b.code);
    }
    const blockSeqByDist = new Map<string, number>();
    const nextBlockCode = (distCode: string) => {
      let seq = (blockSeqByDist.get(distCode) ?? 0) + 1;
      let code = `${distCode}_PB${String(seq).padStart(3, '0')}`;
      while (blockCodes.has(code)) { seq++; code = `${distCode}_PB${String(seq).padStart(3, '0')}`; }
      blockSeqByDist.set(distCode, seq);
      blockCodes.add(code);
      return code;
    };

    const existingSchools = new Map<string, boolean>();
    const schools = await prisma.school.findMany({ select: { udise: true } });
    for (const s of schools) existingSchools.set(s.udise, true);

    const existingSubs = new Map<string, { id: string; status: string }>();
    const subs = await prisma.selfAssessmentSubmission.findMany({
      where: { cycleId: cycle.id },
      select: { id: true, schoolUdise: true, status: true },
    });
    for (const s of subs) existingSubs.set(s.schoolUdise, { id: s.id, status: s.status });

    // Process rows
    for (let ri = 0; ri < dataRows.length; ri++) {
      const row = dataRows[ri];
      const rowNum = ri + 2; // 1-based, +1 for header
      result.rowsProcessed++;

      try {
        const udise = String(row[udiseIdx] ?? '').trim();
        if (!udise || udise.length < 5) {
          result.errors.push({ row: rowNum, reason: `Invalid UDISE: "${udise}"` });
          continue;
        }

        const rawName = String(row[nameIdx] ?? '').trim();
        const rawDist = String(row[distIdx] ?? '').trim();
        const rawBlock = String(row[blockIdx] ?? '').trim();
        const rawType = String(row[typeIdx] ?? '').trim();

        if (!rawDist) { result.errors.push({ row: rowNum, reason: 'Missing district' }); continue; }
        if (!rawBlock) { result.errors.push({ row: rowNum, reason: 'Missing block' }); continue; }

        const category = mapSchoolCategory(rawType);
        const catCode = CATEGORY_TO_CODE[category] ?? 'PRIMARY';
        if (category === 'Primary' && rawType && !rawType.toLowerCase().includes('primary') && !rawType.includes('प्राथमिक')) {
          result.warnings.push({ row: rowNum, reason: `Ambiguous school type "${rawType}", defaulted to Primary` });
        }

        // ─ Ensure district ─
        const distLower = rawDist.toLowerCase();
        let district = distByName.get(distLower);
        if (!district) {
          const bn = splitBilingual(rawDist);
          const code = nextDistCode();
          district = await prisma.district.create({ data: { code, nameEn: bn.en || rawDist, nameHi: bn.hi || rawDist } });
          distByName.set(district.nameEn.toLowerCase(), district);
          distByName.set(district.nameHi.toLowerCase(), district);
          result.districtsCreated++;
        }

        // ─ Ensure block ─
        const blockKey = `${district.code}::${rawBlock.toLowerCase()}`;
        let block = blockByKey.get(blockKey);
        if (!block) {
          const bn = splitBilingual(rawBlock);
          const code = nextBlockCode(district.code);
          block = await prisma.block.create({
            data: { code, districtCode: district.code, nameEn: bn.en || rawBlock, nameHi: bn.hi || rawBlock },
          });
          blockByKey.set(`${district.code}::${block.nameEn.toLowerCase()}`, block);
          blockByKey.set(`${district.code}::${block.nameHi.toLowerCase()}`, block);
          result.blocksCreated++;
        }

        // ─ Ensure school ─
        if (!existingSchools.has(udise)) {
          const sn = splitBilingual(rawName);
          await prisma.school.create({
            data: {
              udise, nameEn: sn.en || rawName || udise, nameHi: sn.hi || rawName || udise,
              category, districtCode: district.code, blockCode: block.code,
            },
          });
          existingSchools.set(udise, true);
          result.schoolsCreated++;
        }

        // ─ Handle existing submission ─
        const existingSub = existingSubs.get(udise);
        if (existingSub?.status === 'SUBMITTED') {
          result.submissionsSkipped++;
          continue;
        }

        // ─ Create/get submission ─
        const submission = existingSub
          ? { id: existingSub.id }
          : await prisma.selfAssessmentSubmission.create({
              data: { cycleId: cycle.id, schoolUdise: udise, frameworkId: framework.id, status: 'DRAFT' },
            });
        if (!existingSub) {
          existingSubs.set(udise, { id: submission.id, status: 'DRAFT' });
          result.submissionsCreated++;
        }

        // ─ Map responses ─
        let applicableCount = 0;
        let answeredCount = 0;
        const responseOps: { parameterId: string; selectedOptionKey: string }[] = [];

        for (let pi = 0; pi < params.length; pi++) {
          const param = params[pi];
          const applicability = param.applicability as string[];
          if (!applicability.includes(catCode)) continue;
          applicableCount++;

          const cellIdx = paramColIndices[pi];
          const level = mapLevel(row[cellIdx]);
          if (level) {
            responseOps.push({ parameterId: param.id, selectedOptionKey: level });
            answeredCount++;
          }
        }

        // Batch upsert responses
        for (const op of responseOps) {
          await prisma.selfAssessmentResponse.upsert({
            where: { submissionId_parameterId: { submissionId: submission.id, parameterId: op.parameterId } },
            create: { submissionId: submission.id, parameterId: op.parameterId, selectedOptionKey: op.selectedOptionKey },
            update: { selectedOptionKey: op.selectedOptionKey },
          });
        }

        // Set submission status
        const allAnswered = answeredCount === applicableCount && applicableCount > 0;
        const now = new Date();
        await prisma.selfAssessmentSubmission.update({
          where: { id: submission.id },
          data: allAnswered
            ? { status: 'SUBMITTED', submittedAt: now, startedAt: now }
            : { status: 'DRAFT', startedAt: now },
        });

        if (allAnswered) result.submissionsSubmitted++;
        else result.submissionsDraft++;

      } catch (rowErr) {
        result.errors.push({ row: rowNum, reason: (rowErr as Error).message });
      }
    }

    result.success = true;
  } catch (e) {
    result.errors.push({ row: 0, reason: (e as Error).message });
  }

  return result;
}
