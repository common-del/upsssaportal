'use server';

import { prisma } from '@/lib/db';
import { del } from '@vercel/blob';
import { revalidatePath } from 'next/cache';

const MAX_FILES_PER_PARAM = 3;

type EvidenceFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  blobUrl: string;
};

// ─── Create evidence after client upload ───

export async function createEvidence(
  userId: string,
  blobUrl: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  kind: 'SELF_RESPONSE' | 'VERIFICATION_RESPONSE' | 'APPEAL_ITEM',
  opts: {
    saSubmissionId?: string;
    vSubmissionId?: string;
    parameterId?: string;
    appealItemId?: string;
  },
): Promise<{ success: boolean; error?: string; file?: EvidenceFile }> {
  // Validate file constraints
  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowed.includes(fileType)) return { success: false, error: 'Invalid file type.' };
  if (fileSize > 10 * 1024 * 1024) return { success: false, error: 'File too large (max 10MB).' };

  // Count existing files for this param/item
  const where = buildWhere(kind, opts);
  const existingCount = await prisma.evidenceLink.count({ where });
  if (existingCount >= MAX_FILES_PER_PARAM) {
    return { success: false, error: `Maximum ${MAX_FILES_PER_PARAM} files allowed.` };
  }

  // Verify ownership/access
  const accessCheck = await checkUploadAccess(userId, kind, opts);
  if (!accessCheck.ok) return { success: false, error: accessCheck.error };

  const asset = await prisma.evidenceAsset.create({
    data: { blobUrl, fileName, fileType, fileSize, uploadedByUserId: userId },
  });

  await prisma.evidenceLink.create({
    data: {
      assetId: asset.id,
      kind,
      saSubmissionId: kind === 'SELF_RESPONSE' ? opts.saSubmissionId : undefined,
      vSubmissionId: kind === 'VERIFICATION_RESPONSE' ? opts.vSubmissionId : undefined,
      parameterId: kind !== 'APPEAL_ITEM' ? opts.parameterId : undefined,
      appealItemId: kind === 'APPEAL_ITEM' ? opts.appealItemId : undefined,
    },
  });

  return {
    success: true,
    file: { id: asset.id, fileName, fileType, fileSize, blobUrl },
  };
}

// ─── Delete evidence ───

export async function deleteEvidence(
  userId: string,
  assetId: string,
): Promise<{ success: boolean; error?: string }> {
  const asset = await prisma.evidenceAsset.findUnique({
    where: { id: assetId },
    include: { links: true },
  });
  if (!asset) return { success: false, error: 'Not found.' };
  if (asset.uploadedByUserId !== userId) return { success: false, error: 'Access denied.' };

  try { await del(asset.blobUrl); } catch { /* blob may already be deleted */ }

  await prisma.evidenceAsset.delete({ where: { id: assetId } });

  revalidatePath('/app/school/self-assessment');
  revalidatePath('/app/verifier');
  revalidatePath('/app/school/appeals');
  return { success: true };
}

// ─── Get evidence for a self-assessment parameter ───

export async function getEvidenceForSAParam(
  saSubmissionId: string,
  parameterId: string,
): Promise<EvidenceFile[]> {
  const links = await prisma.evidenceLink.findMany({
    where: { kind: 'SELF_RESPONSE', saSubmissionId, parameterId },
    include: { asset: true },
    orderBy: { asset: { createdAt: 'asc' } },
  });
  return links.map((l) => ({
    id: l.asset.id,
    fileName: l.asset.fileName,
    fileType: l.asset.fileType,
    fileSize: l.asset.fileSize,
    blobUrl: l.asset.blobUrl,
  }));
}

// ─── Get evidence for a verification parameter ───

export async function getEvidenceForVParam(
  vSubmissionId: string,
  parameterId: string,
): Promise<EvidenceFile[]> {
  const links = await prisma.evidenceLink.findMany({
    where: { kind: 'VERIFICATION_RESPONSE', vSubmissionId, parameterId },
    include: { asset: true },
    orderBy: { asset: { createdAt: 'asc' } },
  });
  return links.map((l) => ({
    id: l.asset.id,
    fileName: l.asset.fileName,
    fileType: l.asset.fileType,
    fileSize: l.asset.fileSize,
    blobUrl: l.asset.blobUrl,
  }));
}

// ─── Get evidence for an appeal item ───

export async function getEvidenceForAppealItem(
  appealItemId: string,
): Promise<EvidenceFile[]> {
  const links = await prisma.evidenceLink.findMany({
    where: { kind: 'APPEAL_ITEM', appealItemId },
    include: { asset: true },
    orderBy: { asset: { createdAt: 'asc' } },
  });
  return links.map((l) => ({
    id: l.asset.id,
    fileName: l.asset.fileName,
    fileType: l.asset.fileType,
    fileSize: l.asset.fileSize,
    blobUrl: l.asset.blobUrl,
  }));
}

// ─── Batch get evidence counts for submit validation ───

export async function getEvidenceCountsForSubmission(
  kind: 'SELF_RESPONSE' | 'VERIFICATION_RESPONSE',
  submissionId: string,
): Promise<Record<string, number>> {
  const field = kind === 'SELF_RESPONSE' ? 'saSubmissionId' : 'vSubmissionId';
  const links = await prisma.evidenceLink.findMany({
    where: { kind, [field]: submissionId },
    select: { parameterId: true },
  });
  const counts: Record<string, number> = {};
  for (const l of links) {
    if (l.parameterId) counts[l.parameterId] = (counts[l.parameterId] ?? 0) + 1;
  }
  return counts;
}

export async function getEvidenceCountsForAppeal(
  appealId: string,
): Promise<Record<string, number>> {
  const links = await prisma.evidenceLink.findMany({
    where: { kind: 'APPEAL_ITEM', appealItem: { appealId } },
    select: { appealItemId: true },
  });
  const counts: Record<string, number> = {};
  for (const l of links) {
    if (l.appealItemId) counts[l.appealItemId] = (counts[l.appealItemId] ?? 0) + 1;
  }
  return counts;
}

// ─── Helpers ───

function buildWhere(
  kind: string,
  opts: { saSubmissionId?: string; vSubmissionId?: string; parameterId?: string; appealItemId?: string },
) {
  if (kind === 'SELF_RESPONSE') return { kind, saSubmissionId: opts.saSubmissionId, parameterId: opts.parameterId };
  if (kind === 'VERIFICATION_RESPONSE') return { kind, vSubmissionId: opts.vSubmissionId, parameterId: opts.parameterId };
  return { kind: 'APPEAL_ITEM', appealItemId: opts.appealItemId };
}

async function checkUploadAccess(
  userId: string,
  kind: string,
  opts: { saSubmissionId?: string; vSubmissionId?: string; appealItemId?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (kind === 'SELF_RESPONSE' && opts.saSubmissionId) {
    const sub = await prisma.selfAssessmentSubmission.findUnique({
      where: { id: opts.saSubmissionId },
      include: { school: { select: { udise: true } } },
    });
    if (!sub) return { ok: false, error: 'Submission not found.' };
    if (sub.status === 'SUBMITTED') return { ok: false, error: 'Submission already submitted.' };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
    if (!user || user.role !== 'SCHOOL' || user.name !== sub.school.udise) {
      return { ok: false, error: 'Access denied.' };
    }
    return { ok: true };
  }
  if (kind === 'VERIFICATION_RESPONSE' && opts.vSubmissionId) {
    const sub = await prisma.verificationSubmission.findUnique({ where: { id: opts.vSubmissionId } });
    if (!sub) return { ok: false, error: 'Submission not found.' };
    if (sub.status === 'SUBMITTED') return { ok: false, error: 'Submission already submitted.' };
    if (sub.verifierUserId !== userId) return { ok: false, error: 'Access denied.' };
    return { ok: true };
  }
  if (kind === 'APPEAL_ITEM' && opts.appealItemId) {
    const item = await prisma.appealItem.findUnique({
      where: { id: opts.appealItemId },
      include: { appeal: true },
    });
    if (!item) return { ok: false, error: 'Appeal item not found.' };
    if (item.appeal.status !== 'DRAFT') return { ok: false, error: 'Appeal not in draft.' };
    return { ok: true };
  }
  return { ok: false, error: 'Invalid parameters.' };
}
