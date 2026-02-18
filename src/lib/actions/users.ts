'use server';

import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

type ActorInfo = { userId: string; role: string; districtCode?: string | null };

const VALID_ROLES = ['SSSA_ADMIN', 'DISTRICT_OFFICIAL', 'VERIFIER', 'SCHOOL'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function auditLog(actor: ActorInfo, action: string, entityType: string, entityId?: string, metadata?: Record<string, any>) {
  await prisma.auditLog.create({
    data: { actorUserId: actor.userId, action, entityType, entityId, metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined },
  });
}

function isSssaAdmin(actor: ActorInfo) { return actor.role === 'SSSA_ADMIN'; }
function isDistrictOfficial(actor: ActorInfo) { return actor.role === 'DISTRICT_OFFICIAL'; }

export async function listUsers(
  actor: ActorInfo,
  filters: { role?: string; districtCode?: string; active?: string; q?: string; page?: number },
) {
  const PAGE_SIZE = 20;
  const page = Math.max(1, filters.page ?? 1);

  if (!isSssaAdmin(actor) && !isDistrictOfficial(actor)) {
    return { users: [], total: 0 };
  }

  type WhereType = { role?: string; active?: boolean; districtCode?: string; OR?: object[]; id?: { in: string[] } };
  const where: WhereType = {};

  if (isDistrictOfficial(actor)) {
    const vds = await prisma.verifierDistrict.findMany({
      where: { districtCode: actor.districtCode! },
      select: { verifierUserId: true },
    });
    where.role = 'VERIFIER';
    where.id = { in: vds.map((v) => v.verifierUserId) };
  } else {
    if (filters.role) where.role = filters.role;
    if (filters.districtCode) where.districtCode = filters.districtCode;
  }

  if (filters.active === 'true') where.active = true;
  else if (filters.active === 'false') where.active = false;

  if (filters.q) {
    where.OR = [
      { username: { contains: filters.q, mode: 'insensitive' } },
      { name: { contains: filters.q, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, username: true, name: true, role: true, districtCode: true,
        verifierCapacity: true, active: true, createdAt: true,
        verifierDistricts: { select: { districtCode: true } },
      },
    }),
    prisma.user.count({ where: where as any }),
  ]);

  return { users, total, pageSize: PAGE_SIZE };
}

export async function createUser(
  actor: ActorInfo,
  payload: {
    username: string; password: string; name?: string; role: string;
    districtCode?: string; verifierCapacity?: number; districtCodes?: string[];
  },
): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!isSssaAdmin(actor) && !isDistrictOfficial(actor)) return { success: false, error: 'Access denied.' };

  if (isDistrictOfficial(actor)) {
    if (payload.role !== 'VERIFIER') return { success: false, error: 'You can only create VERIFIER users.' };
  }

  if (!VALID_ROLES.includes(payload.role as any)) return { success: false, error: 'Invalid role.' };
  if (!payload.username?.trim()) return { success: false, error: 'Username is required.' };
  if (!payload.password || payload.password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

  const existing = await prisma.user.findUnique({ where: { username: payload.username.trim() } });
  if (existing) return { success: false, error: 'Username already exists.' };

  if (payload.role === 'DISTRICT_OFFICIAL' && !payload.districtCode) {
    return { success: false, error: 'District code is required for District Officials.' };
  }
  if (payload.role === 'SCHOOL') {
    const school = await prisma.school.findUnique({ where: { udise: payload.username.trim() } });
    if (!school) return { success: false, error: 'No school found with this UDISE code.' };
  }

  const hash = await bcrypt.hash(payload.password, 10);
  const user = await prisma.user.create({
    data: {
      username: payload.username.trim(),
      passwordHash: hash,
      name: payload.name?.trim() || null,
      role: payload.role,
      districtCode: payload.role === 'DISTRICT_OFFICIAL' ? payload.districtCode : null,
      verifierCapacity: payload.role === 'VERIFIER' ? (payload.verifierCapacity ?? 50) : null,
    },
  });

  if (payload.role === 'VERIFIER') {
    let codes = payload.districtCodes ?? [];
    if (isDistrictOfficial(actor)) codes = [actor.districtCode!];
    if (codes.length > 0) {
      await prisma.verifierDistrict.createMany({
        data: codes.map((dc) => ({ verifierUserId: user.id, districtCode: dc })),
        skipDuplicates: true,
      });
    }
  }

  await auditLog(actor, 'USER_CREATED', 'User', user.id, {
    username: user.username, role: user.role, districtCode: user.districtCode,
  });

  revalidatePath('/app/sssa/users');
  revalidatePath('/app/district/users');
  return { success: true, userId: user.id };
}

export async function updateUser(
  actor: ActorInfo,
  userId: string,
  payload: { name?: string; role?: string; districtCode?: string | null; verifierCapacity?: number; active?: boolean },
): Promise<{ success: boolean; error?: string }> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: 'User not found.' };

  if (isDistrictOfficial(actor)) {
    if (target.role !== 'VERIFIER') return { success: false, error: 'Access denied.' };
    const vd = await prisma.verifierDistrict.findFirst({
      where: { verifierUserId: userId, districtCode: actor.districtCode! },
    });
    if (!vd) return { success: false, error: 'User not in your district.' };
    if (payload.role && payload.role !== 'VERIFIER') return { success: false, error: 'Cannot change role.' };
    if (payload.districtCode !== undefined) return { success: false, error: 'Cannot change district code.' };
  } else if (!isSssaAdmin(actor)) {
    return { success: false, error: 'Access denied.' };
  }

  const data: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};

  if (payload.name !== undefined && payload.name !== target.name) {
    before.name = target.name; data.name = payload.name;
  }
  if (isSssaAdmin(actor) && payload.role && payload.role !== target.role) {
    before.role = target.role; data.role = payload.role;
  }
  if (isSssaAdmin(actor) && payload.districtCode !== undefined && payload.districtCode !== target.districtCode) {
    before.districtCode = target.districtCode; data.districtCode = payload.districtCode;
  }
  if (payload.verifierCapacity !== undefined && payload.verifierCapacity !== target.verifierCapacity) {
    before.verifierCapacity = target.verifierCapacity; data.verifierCapacity = payload.verifierCapacity;
  }
  if (payload.active !== undefined && payload.active !== target.active) {
    before.active = target.active; data.active = payload.active;
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id: userId }, data });
    await auditLog(actor, 'USER_UPDATED', 'User', userId, { before, after: data });
  }

  revalidatePath('/app/sssa/users');
  revalidatePath('/app/district/users');
  return { success: true };
}

export async function setUserEnabled(
  actor: ActorInfo, userId: string, enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: 'User not found.' };

  if (isDistrictOfficial(actor)) {
    if (target.role !== 'VERIFIER') return { success: false, error: 'Access denied.' };
    const vd = await prisma.verifierDistrict.findFirst({
      where: { verifierUserId: userId, districtCode: actor.districtCode! },
    });
    if (!vd) return { success: false, error: 'User not in your district.' };
  } else if (!isSssaAdmin(actor)) {
    return { success: false, error: 'Access denied.' };
  }

  await prisma.user.update({ where: { id: userId }, data: { active: enabled } });
  await auditLog(actor, enabled ? 'USER_ENABLED' : 'USER_DISABLED', 'User', userId, { username: target.username });

  revalidatePath('/app/sssa/users');
  revalidatePath('/app/district/users');
  return { success: true };
}

export async function resetPassword(
  actor: ActorInfo, userId: string, newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: 'User not found.' };

  if (isDistrictOfficial(actor)) {
    if (target.role !== 'VERIFIER') return { success: false, error: 'Access denied.' };
    const vd = await prisma.verifierDistrict.findFirst({
      where: { verifierUserId: userId, districtCode: actor.districtCode! },
    });
    if (!vd) return { success: false, error: 'User not in your district.' };
  } else if (!isSssaAdmin(actor)) {
    return { success: false, error: 'Access denied.' };
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  await auditLog(actor, 'PASSWORD_RESET', 'User', userId, { username: target.username });

  return { success: true };
}

export async function setVerifierDistricts(
  actor: ActorInfo, userId: string, districtCodes: string[],
): Promise<{ success: boolean; error?: string }> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== 'VERIFIER') return { success: false, error: 'User not found or not a verifier.' };

  if (isDistrictOfficial(actor)) {
    return { success: false, error: 'District officials cannot change district mappings.' };
  } else if (!isSssaAdmin(actor)) {
    return { success: false, error: 'Access denied.' };
  }

  const before = await prisma.verifierDistrict.findMany({
    where: { verifierUserId: userId }, select: { districtCode: true },
  });

  await prisma.verifierDistrict.deleteMany({ where: { verifierUserId: userId } });
  if (districtCodes.length > 0) {
    await prisma.verifierDistrict.createMany({
      data: districtCodes.map((dc) => ({ verifierUserId: userId, districtCode: dc })),
    });
  }

  await auditLog(actor, 'DISTRICT_MAPPING_CHANGED', 'User', userId, {
    before: before.map((v) => v.districtCode),
    after: districtCodes,
  });

  revalidatePath('/app/sssa/users');
  return { success: true };
}

type BulkRow = { username: string; password: string; name?: string; role: string; districtCode?: string; verifierCapacity?: string; districtCodes?: string };
type BulkError = { row: number; field: string; message: string };

export async function bulkValidateAndCreate(
  actor: ActorInfo,
  rows: BulkRow[],
): Promise<{ success: boolean; created: number; errors: BulkError[] }> {
  if (!isSssaAdmin(actor)) return { success: false, created: 0, errors: [{ row: 0, field: '', message: 'Access denied.' }] };

  const errors: BulkError[] = [];
  const usernames = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;
    if (!r.username?.trim()) errors.push({ row: rowNum, field: 'username', message: 'Required' });
    else if (usernames.has(r.username.trim())) errors.push({ row: rowNum, field: 'username', message: 'Duplicate in file' });
    else usernames.add(r.username.trim());

    if (!r.password || r.password.length < 6) errors.push({ row: rowNum, field: 'password', message: 'Min 6 chars' });
    if (!VALID_ROLES.includes(r.role as any)) errors.push({ row: rowNum, field: 'role', message: 'Invalid role' });
    if (r.role === 'DISTRICT_OFFICIAL' && !r.districtCode) errors.push({ row: rowNum, field: 'districtCode', message: 'Required' });
  }

  const existingUsers = await prisma.user.findMany({
    where: { username: { in: Array.from(usernames) } },
    select: { username: true },
  });
  const existingSet = new Set(existingUsers.map((u) => u.username));
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].username && existingSet.has(rows[i].username.trim())) {
      errors.push({ row: i + 1, field: 'username', message: 'Already exists' });
    }
  }

  if (errors.length > 0) return { success: false, created: 0, errors };

  let created = 0;
  for (const r of rows) {
    const hash = await bcrypt.hash(r.password, 10);
    const user = await prisma.user.create({
      data: {
        username: r.username.trim(),
        passwordHash: hash,
        name: r.name?.trim() || null,
        role: r.role,
        districtCode: r.role === 'DISTRICT_OFFICIAL' ? r.districtCode : null,
        verifierCapacity: r.role === 'VERIFIER' ? parseInt(r.verifierCapacity ?? '50', 10) || 50 : null,
      },
    });

    if (r.role === 'VERIFIER' && r.districtCodes) {
      const codes = r.districtCodes.split(';').map((c) => c.trim()).filter(Boolean);
      if (codes.length > 0) {
        await prisma.verifierDistrict.createMany({
          data: codes.map((dc) => ({ verifierUserId: user.id, districtCode: dc })),
          skipDuplicates: true,
        });
      }
    }
    created++;
  }

  await auditLog(actor, 'BULK_IMPORT', 'User', undefined, { count: created });

  revalidatePath('/app/sssa/users');
  return { success: true, created, errors: [] };
}

export async function getUserAuditLogs(userId: string) {
  return prisma.auditLog.findMany({
    where: { entityId: userId, entityType: 'User' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, action: true, metadata: true, createdAt: true, actor: { select: { username: true } } },
  });
}
