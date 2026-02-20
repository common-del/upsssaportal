/**
 * One-time seed script: import pilot school responses into the production DB.
 *
 * Run:  npx tsx scripts/import-pilot.ts
 *
 * What it does:
 *   1. Reads the pilot Excel file (data/pilot/SQAAF Pilot Responses UP Feb.xlsx)
 *   2. Creates Districts, Blocks, Schools that don't exist yet
 *   3. Creates SelfAssessmentSubmission (SUBMITTED) + Response rows
 *   4. Computes Result rows (scores + grade bands) using the framework rubric
 *   5. Cleans up stale Result rows for schools without submissions
 *
 * Handles known discrepancy: the pilot Excel has 1 combined PTR column while
 * the framework has 3 separate PTR parameters (PS/UPS/Secondary). The script
 * maps the single Excel column to the correct PTR parameter based on school category.
 *
 * Idempotent — safe to re-run. Skips schools already SUBMITTED.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const PILOT_FILE = path.resolve(__dirname, '..', 'data', 'pilot', 'SQAAF Pilot Responses UP Feb.xlsx');
const PREFERRED_SHEET = 'Form Responses 1';

// ─── Column helpers ───

function colToIndex(col: string): number {
  let idx = 0;
  for (const ch of col.toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

const HARD_IGNORED = new Set([
  colToIndex('A'), colToIndex('B'), colToIndex('F'),
  colToIndex('I'), colToIndex('J'), colToIndex('GA'),
]);

function isEvidenceCol(h: string) {
  const t = h.trim();
  return /evidence\s*required/i.test(t) || /^evidence\b/i.test(t);
}

function identifyMeta(header: string): string | null {
  const h = String(header || '');
  if (h.includes('UDISE') && (h.includes('कोड') || h.includes('Code'))) return 'udise';
  if (h.includes('विद्यालय का नाम') || h.includes('Name of School')) return 'schoolName';
  if (h.includes('ज़िला') && !h.includes('UDISE')) return 'district';
  if (h.includes('ब्लॉक') && !h.includes('UDISE')) return 'block';
  if (h.includes('विद्यालय का प्रकार') || h.includes('Type of school')) return 'schoolType';
  return null;
}

// Normalize text for fuzzy matching: lowercase, collapse whitespace, strip punctuation
function norm(s: string) { return s.toLowerCase().replace(/[\s|।,.;:!?()\[\]{}'"–—]+/g, ' ').trim(); }

type OptInfo = { key: string; labelEn: string; labelHi: string };

function matchOption(cell: unknown, options: OptInfo[]): string | null {
  if (cell == null) return null;
  const raw = String(cell).trim();
  if (!raw) return null;
  const cn = norm(raw);
  if (!cn) return null;

  // Strategy 1: exact normalized match
  for (const o of options) {
    if (norm(o.labelEn) === cn || norm(o.labelHi) === cn) return o.key;
  }

  // Strategy 2: cell contains the option label (or vice versa)
  // Score by how much of the option label is covered
  let best: { key: string; score: number } | null = null;
  for (const o of options) {
    const ne = norm(o.labelEn);
    const nh = norm(o.labelHi);
    // Check both directions
    for (const label of [ne, nh]) {
      if (!label || label.length < 10) continue;
      if (cn.includes(label) || label.includes(cn)) {
        const score = Math.min(cn.length, label.length) / Math.max(cn.length, label.length);
        if (!best || score > best.score) best = { key: o.key, score };
      }
    }
  }
  if (best && best.score > 0.3) return best.key;

  // Strategy 3: check if first 50 chars of the cell match the start of any option label
  const prefix = cn.slice(0, 50);
  for (const o of options) {
    if (norm(o.labelEn).startsWith(prefix) || norm(o.labelHi).startsWith(prefix)) return o.key;
    if (prefix.startsWith(norm(o.labelEn).slice(0, 50)) || prefix.startsWith(norm(o.labelHi).slice(0, 50))) return o.key;
  }

  // Strategy 4: fallback — "Level X" / "स्तर X" patterns
  if (/level\s*3\b/i.test(raw) || /स्तर\s*3/.test(raw)) return 'LEVEL_3';
  if (/level\s*2\b/i.test(raw) || /स्तर\s*2/.test(raw)) return 'LEVEL_2';
  if (/level\s*1\b/i.test(raw) || /स्तर\s*1/.test(raw)) return 'LEVEL_1';

  // Strategy 5: if cell has substantial text (>20 chars), try comparing word-level overlap
  if (cn.length > 20) {
    const cellWords = new Set(cn.split(/\s+/).filter((w) => w.length > 3));
    let bestOpt: { key: string; overlap: number } | null = null;
    for (const o of options) {
      for (const label of [norm(o.labelEn), norm(o.labelHi)]) {
        if (!label) continue;
        const labelWords = label.split(/\s+/).filter((w) => w.length > 3);
        const overlap = labelWords.filter((w) => cellWords.has(w)).length;
        const ratio = labelWords.length > 0 ? overlap / labelWords.length : 0;
        if (ratio > 0.5 && (!bestOpt || overlap > bestOpt.overlap)) {
          bestOpt = { key: o.key, overlap };
        }
      }
    }
    if (bestOpt) return bestOpt.key;
  }

  return null;
}

const NA_PATTERN = /not\s*applicable|लागू\s*नहीं|\bN[\.\s]*A\b/i;
function isNA(cell: unknown): boolean {
  if (cell == null) return false;
  return NA_PATTERN.test(String(cell).trim());
}

function mapCategory(raw: unknown): string {
  const s = String(raw || '').toLowerCase();
  if (s.includes('upper primary') || s.includes('उच्च प्राथमिक')) return 'Upper Primary';
  if (s.includes('secondary') || s.includes('माध्यमिक')) return 'Secondary';
  if (s.includes('primary') || s.includes('प्राथमिक')) return 'Primary';
  return 'Primary';
}

const CAT_CODE: Record<string, string> = {
  Primary: 'PRIMARY', 'Upper Primary': 'UPPER_PRIMARY', Secondary: 'SECONDARY',
};

function splitBilingual(raw: string) {
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

// Convert framework param code P2_1_03 → "2.1.3"
function codeToNumber(code: string): string | null {
  const m = code.match(/^P(\d+)_(\d+)_(\d+)$/);
  return m ? `${parseInt(m[1])}.${parseInt(m[2])}.${parseInt(m[3])}` : null;
}

// Extract leading number from Excel header "1.1.1 कक्षा कक्ष..." → "1.1.1"
function extractNumber(header: string): string | null {
  const m = header.trim().match(/^(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

// ─── Read Excel ───

function readSheet() {
  if (!fs.existsSync(PILOT_FILE)) throw new Error(`File not found: ${PILOT_FILE}`);
  const wb = XLSX.readFile(PILOT_FILE);
  const sheetName = wb.SheetNames.includes(PREFERRED_SHEET) ? PREFERRED_SHEET : wb.SheetNames[0];
  console.log(`Using sheet: "${sheetName}"`);
  const sheet = wb.Sheets[sheetName];
  if (!sheet?.['!ref']) throw new Error('Sheet is empty.');

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const totalCols = range.e.c + 1;
  const cell = (r: number, c: number) => {
    const a = XLSX.utils.encode_cell({ r, c });
    const v = sheet[a];
    return v ? String(v.v ?? '') : '';
  };

  const headers: string[] = [];
  for (let c = 0; c < totalCols; c++) headers.push(cell(range.s.r, c));

  const rows: string[][] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = 0; c < totalCols; c++) row.push(cell(r, c));
    if (row.some((v) => v.trim())) rows.push(row);
  }
  return { headers, rows };
}

function classifyColumns(headers: string[]) {
  const meta = new Map<string, number>();
  const paramCols: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (HARD_IGNORED.has(i) || isEvidenceCol(headers[i])) continue;
    const mk = identifyMeta(headers[i]);
    if (mk) { meta.set(mk, i); continue; }
    paramCols.push(i);
  }
  return { meta, paramCols };
}

// ─── Score computation (mirrors finalization.ts) ───

async function computeResult(
  cycleId: string, schoolUdise: string, frameworkId: string,
  rubricMap: Map<string, number>, domainWeightMap: Map<string, number>,
  allParams: { id: string; applicability: unknown; subDomain: { domainId: string }; options?: unknown }[],
  gradeBands: { key: string; minPercent: number; maxPercent: number }[],
) {
  const school = await prisma.school.findUnique({ where: { udise: schoolUdise }, select: { category: true } });
  const catCode = CAT_CODE[school?.category ?? 'Primary'] ?? 'PRIMARY';
  const applicable = allParams.filter((p) => (p.applicability as string[]).includes(catCode));

  const sub = await prisma.selfAssessmentSubmission.findUnique({
    where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
    include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
  });
  if (!sub || sub.status !== 'SUBMITTED') return;

  const responseMap = new Map(sub.responses.map((r) => [r.parameterId, r.selectedOptionKey]));

  const groups = new Map<string, { achieved: number; possible: number }>();
  for (const p of applicable) {
    const did = p.subDomain.domainId;
    if (!groups.has(did)) groups.set(did, { achieved: 0, possible: 0 });
    const g = groups.get(did)!;
    g.possible += Math.max(
      rubricMap.get(`${p.id}:LEVEL_1`) ?? 0,
      rubricMap.get(`${p.id}:LEVEL_2`) ?? 0,
      rubricMap.get(`${p.id}:LEVEL_3`) ?? 0,
    );
    const k = responseMap.get(p.id);
    if (k) g.achieved += rubricMap.get(`${p.id}:${k}`) ?? 0;
  }
  let ws = 0, tw = 0;
  for (const [did, g] of groups) {
    const w = domainWeightMap.get(did) ?? 0;
    if (w > 0 && g.possible > 0) { ws += (g.achieved / g.possible) * w; tw += w; }
  }
  const selfScore = tw > 0 ? Math.round((ws / tw) * 100 * 10) / 10 : null;
  const finalScore = selfScore;

  let gradeBandCode: string | null = null;
  if (finalScore != null) {
    for (let i = 0; i < gradeBands.length; i++) {
      const b = gradeBands[i];
      const last = i === gradeBands.length - 1;
      if (finalScore >= b.minPercent && (last ? finalScore <= b.maxPercent : finalScore < b.maxPercent)) {
        gradeBandCode = b.key; break;
      }
    }
  }

  await prisma.result.upsert({
    where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
    create: { cycleId, schoolUdise, frameworkId, selfScorePercent: selfScore, verifierScorePercent: null, finalScorePercent: finalScore, gradeBandCode },
    update: { selfScorePercent: selfScore, verifierScorePercent: null, finalScorePercent: finalScore, gradeBandCode },
  });
  return { selfScore, finalScore, gradeBandCode };
}

// ─── Build mapping: framework param index → Excel param column index ───

function buildMapping(
  paramCols: number[],
  headers: string[],
  params: { code: string; titleEn: string | null }[],
) {
  // fwToExcel[frameworkIndex] = index into paramCols array
  const fwToExcel = new Map<number, number>();

  // Pass 1: direct number match. E.g. Excel "1.1.1 ..." → P1_1_01
  const excelNumbers = paramCols.map((ci) => extractNumber(headers[ci]));
  for (let fi = 0; fi < params.length; fi++) {
    const fwNum = codeToNumber(params[fi].code);
    if (!fwNum) continue;
    const ei = excelNumbers.indexOf(fwNum);
    if (ei !== -1) fwToExcel.set(fi, ei);
  }

  // Pass 2: for unmapped params, try title-based matching against Excel headers.
  // This handles the PTR case where 3 framework params share 1 Excel column.
  for (let fi = 0; fi < params.length; fi++) {
    if (fwToExcel.has(fi)) continue;
    const title = (params[fi].titleEn ?? '').toLowerCase();
    if (title.length < 5) continue;

    // Use distinguishing keywords from the title
    const keywords = title.split(/\s+/).filter((w) => w.length > 3);
    for (let ei = 0; ei < paramCols.length; ei++) {
      const h = headers[paramCols[ei]].toLowerCase();
      // Require at least 3 keyword matches
      const hits = keywords.filter((kw) => h.includes(kw)).length;
      if (hits >= Math.min(3, keywords.length)) {
        fwToExcel.set(fi, ei);
        break;
      }
    }
  }

  return fwToExcel;
}

// ─── Main ───

async function main() {
  console.log('\n=== Pilot Data Import ===\n');

  // 1. Read Excel
  const { headers, rows } = readSheet();
  const { meta, paramCols } = classifyColumns(headers);
  console.log(`Excel: ${rows.length} data rows, ${paramCols.length} parameter columns`);

  // 2. Load cycle + framework + parameters
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) throw new Error('No active cycle.');
  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework || framework.status !== 'PUBLISHED') throw new Error('No published framework.');

  const params = await prisma.parameter.findMany({
    where: { frameworkId: framework.id, isActive: true },
    select: {
      id: true, code: true, titleEn: true, titleHi: true, applicability: true, order: true,
      subDomain: { select: { order: true, domainId: true, domain: { select: { order: true } } } },
      options: { where: { isActive: true }, select: { key: true, labelEn: true, labelHi: true }, orderBy: { order: 'asc' } },
    },
    orderBy: [
      { subDomain: { domain: { order: 'asc' } } },
      { subDomain: { order: 'asc' } },
      { order: 'asc' },
    ],
  });
  console.log(`Framework "${framework.id}": ${params.length} parameters`);

  // 3. Build content-aware mapping
  const fwToExcel = buildMapping(paramCols, headers, params);

  const mapped = fwToExcel.size;
  const unmapped = params.length - mapped;
  console.log(`Mapping: ${mapped}/${params.length} framework params mapped to Excel columns (${unmapped} unmapped).`);

  if (unmapped > 0) {
    console.log('\nUnmapped framework params (will be treated as unanswered):');
    for (let fi = 0; fi < params.length; fi++) {
      if (!fwToExcel.has(fi)) console.log(`  ${params[fi].code} — ${params[fi].titleEn}`);
    }
  }

  // Show a few mapping samples
  console.log('\nSample mapping (first 5):');
  for (let fi = 0; fi < Math.min(5, params.length); fi++) {
    const ei = fwToExcel.get(fi);
    const exH = ei != null ? headers[paramCols[ei]]?.replace(/\n/g, ' ').trim().slice(0, 60) : '(unmapped)';
    console.log(`  ${params[fi].code} → ${exH}`);
  }
  console.log('');

  const udiseIdx = meta.get('udise')!;
  const nameIdx = meta.get('schoolName')!;
  const distIdx = meta.get('district')!;
  const blockIdx = meta.get('block')!;
  const typeIdx = meta.get('schoolType')!;

  if ([udiseIdx, nameIdx, distIdx, blockIdx, typeIdx].some((v) => v == null)) {
    throw new Error('Could not identify all metadata columns in the Excel.');
  }

  // 4. Caches
  const existDist = await prisma.district.findMany();
  const distByName = new Map<string, (typeof existDist)[0]>();
  const distCodes = new Set<string>();
  for (const d of existDist) {
    distByName.set(d.nameEn.toLowerCase(), d);
    distByName.set(d.nameHi.toLowerCase(), d);
    distCodes.add(d.code);
  }
  let distSeq = 0;
  const nextDist = () => {
    distSeq++;
    while (distCodes.has(`PD${String(distSeq).padStart(3, '0')}`)) distSeq++;
    const c = `PD${String(distSeq).padStart(3, '0')}`;
    distCodes.add(c);
    return c;
  };

  const existBlk = await prisma.block.findMany();
  const blkByKey = new Map<string, (typeof existBlk)[0]>();
  const blkCodes = new Set<string>();
  for (const b of existBlk) {
    blkByKey.set(`${b.districtCode}::${b.nameEn.toLowerCase()}`, b);
    blkByKey.set(`${b.districtCode}::${b.nameHi.toLowerCase()}`, b);
    blkCodes.add(b.code);
  }
  const blkSeq = new Map<string, number>();
  const nextBlk = (dc: string) => {
    let s = (blkSeq.get(dc) ?? 0) + 1;
    let c = `${dc}_PB${String(s).padStart(3, '0')}`;
    while (blkCodes.has(c)) { s++; c = `${dc}_PB${String(s).padStart(3, '0')}`; }
    blkSeq.set(dc, s);
    blkCodes.add(c);
    return c;
  };

  const existSchools = new Set((await prisma.school.findMany({ select: { udise: true } })).map((s) => s.udise));
  const existSubs = new Map(
    (await prisma.selfAssessmentSubmission.findMany({
      where: { cycleId: cycle.id }, select: { id: true, schoolUdise: true, status: true },
    })).map((s) => [s.schoolUdise, s]),
  );

  // 5. Deduplicate rows — keep last occurrence per UDISE
  const rowByUdise = new Map<string, { ri: number; row: string[] }>();
  for (let ri = 0; ri < rows.length; ri++) {
    const udise = String(rows[ri][udiseIdx] ?? '').trim();
    if (udise && udise.length >= 5) rowByUdise.set(udise, { ri, row: rows[ri] });
  }
  console.log(`Unique schools in Excel: ${rowByUdise.size} (from ${rows.length} rows)`);

  const stats = { processed: 0, schoolsCreated: 0, districtsCreated: 0, blocksCreated: 0, subsCreated: 0, skipped: 0, draft: 0, submitted: 0, errors: 0 };

  for (const [udise, { ri, row }] of rowByUdise) {
    stats.processed++;
    const rawName = String(row[nameIdx] ?? '').trim();
    const rawDist = String(row[distIdx] ?? '').trim();
    const rawBlock = String(row[blockIdx] ?? '').trim();
    const rawType = String(row[typeIdx] ?? '').trim();
    if (!rawDist || !rawBlock) { console.warn(`  Row ${ri + 2}: missing district/block`); stats.errors++; continue; }

    const category = mapCategory(rawType);
    const catCode = CAT_CODE[category] ?? 'PRIMARY';

    // District
    let district = distByName.get(rawDist.toLowerCase());
    if (!district) {
      const bn = splitBilingual(rawDist);
      const code = nextDist();
      district = await prisma.district.create({ data: { code, nameEn: bn.en || rawDist, nameHi: bn.hi || rawDist } });
      distByName.set(district.nameEn.toLowerCase(), district);
      distByName.set(district.nameHi.toLowerCase(), district);
      stats.districtsCreated++;
    }

    // Block
    let block = blkByKey.get(`${district.code}::${rawBlock.toLowerCase()}`);
    if (!block) {
      const bn = splitBilingual(rawBlock);
      const code = nextBlk(district.code);
      block = await prisma.block.create({ data: { code, districtCode: district.code, nameEn: bn.en || rawBlock, nameHi: bn.hi || rawBlock } });
      blkByKey.set(`${district.code}::${block.nameEn.toLowerCase()}`, block);
      blkByKey.set(`${district.code}::${block.nameHi.toLowerCase()}`, block);
      stats.blocksCreated++;
    }

    // School
    if (!existSchools.has(udise)) {
      const sn = splitBilingual(rawName);
      await prisma.school.create({
        data: { udise, nameEn: sn.en || rawName || udise, nameHi: sn.hi || rawName || udise, category, districtCode: district.code, blockCode: block.code },
      });
      existSchools.add(udise);
      stats.schoolsCreated++;
    }

    // Submission — skip if already SUBMITTED
    const existing = existSubs.get(udise);
    if (existing?.status === 'SUBMITTED') { stats.skipped++; continue; }

    const sub = existing
      ? existing
      : await prisma.selfAssessmentSubmission.create({
          data: { cycleId: cycle.id, schoolUdise: udise, frameworkId: framework.id, status: 'DRAFT' },
        });
    if (!existing) {
      existSubs.set(udise, { id: sub.id, schoolUdise: udise, status: 'DRAFT' });
      stats.subsCreated++;
    }

    // Build all responses in memory, then batch-write
    const responsesToCreate: { submissionId: string; parameterId: string; selectedOptionKey: string }[] = [];
    let applicable = 0;

    for (let fi = 0; fi < params.length; fi++) {
      const p = params[fi];
      if (!(p.applicability as string[]).includes(catCode)) continue;

      const ei = fwToExcel.get(fi);
      const cellVal = ei != null ? row[paramCols[ei]] : undefined;

      // "Not Applicable" cells don't count towards applicable
      if (isNA(cellVal)) continue;
      applicable++;

      if (ei == null) continue;

      const level = matchOption(cellVal, p.options);
      if (level) {
        responsesToCreate.push({ submissionId: sub.id, parameterId: p.id, selectedOptionKey: level });
      }
    }

    // Batch write: delete existing + create all in a single transaction
    const now = new Date();
    const allAnswered = responsesToCreate.length === applicable && applicable > 0;

    await prisma.$transaction([
      prisma.selfAssessmentResponse.deleteMany({ where: { submissionId: sub.id } }),
      prisma.selfAssessmentResponse.createMany({ data: responsesToCreate }),
      prisma.selfAssessmentSubmission.update({
        where: { id: sub.id },
        data: allAnswered
          ? { status: 'SUBMITTED', submittedAt: now, startedAt: now }
          : { status: 'DRAFT', startedAt: now },
      }),
    ]);

    if (allAnswered) stats.submitted++; else stats.draft++;
    console.log(`  ${udise} ${rawName.slice(0, 40).padEnd(40)} ${category.padEnd(14)} ${responsesToCreate.length}/${applicable} → ${allAnswered ? 'SUBMITTED' : 'DRAFT'}`);
  }

  console.log(`\n--- Import Summary ---`);
  console.log(`  Rows processed : ${stats.processed}`);
  console.log(`  Districts created: ${stats.districtsCreated}`);
  console.log(`  Blocks created   : ${stats.blocksCreated}`);
  console.log(`  Schools created  : ${stats.schoolsCreated}`);
  console.log(`  Submissions new  : ${stats.subsCreated}`);
  console.log(`  → Submitted      : ${stats.submitted}`);
  console.log(`  → Draft          : ${stats.draft}`);
  console.log(`  Skipped (exists) : ${stats.skipped}`);
  console.log(`  Errors           : ${stats.errors}`);

  // 6. Compute results for all submitted schools
  console.log('\nComputing results…');

  const rubrics = await prisma.rubricMapping.findMany({ where: { frameworkId: framework.id } });
  const rubricMap = new Map<string, number>();
  for (const r of rubrics) rubricMap.set(`${r.parameterId}:${r.optionKey}`, r.score);

  const domains = await prisma.sqaafDomain.findMany({ where: { frameworkId: framework.id, isActive: true } });
  const domainWeightMap = new Map<string, number>();
  for (const d of domains) domainWeightMap.set(d.id, d.weightPercent ?? 0);

  const gradeBands = await prisma.gradeBand.findMany({ where: { frameworkId: framework.id }, orderBy: { order: 'asc' } });

  const submittedSubs = await prisma.selfAssessmentSubmission.findMany({
    where: { cycleId: cycle.id, status: 'SUBMITTED' },
    select: { schoolUdise: true },
  });

  let computed = 0;
  for (const s of submittedSubs) {
    const r = await computeResult(cycle.id, s.schoolUdise, framework.id, rubricMap, domainWeightMap, params, gradeBands);
    if (r) { computed++; console.log(`  ${s.schoolUdise} → ${r.finalScore}% [${r.gradeBandCode}]`); }
  }
  console.log(`  Computed ${computed} results.`);

  // 7. Clean up stale results for schools without submissions
  const submittedUdises = new Set(submittedSubs.map((s) => s.schoolUdise));
  const allResults = await prisma.result.findMany({ where: { cycleId: cycle.id }, select: { id: true, schoolUdise: true } });
  const stale = allResults.filter((r) => !submittedUdises.has(r.schoolUdise));
  if (stale.length > 0) {
    await prisma.result.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
    console.log(`\nCleaned up ${stale.length} stale result rows (schools without submissions).`);
  }

  console.log('\n✅ Done.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
