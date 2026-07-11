'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { userId: session.user.id };
}

export async function saveNotificationPreferences(
  data: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    disputeAlerts: boolean;
    cycleReminders: boolean;
  },
  revalidate: string,
) {
  const ctx = await requireSession();
  if (!ctx) return { error: 'Unauthorized' };

  await prisma.notificationPreference.upsert({
    where: { userId: ctx.userId },
    create: { userId: ctx.userId, ...data },
    update: data,
  });
  revalidatePath(revalidate);
  return { success: true };
}

export async function savePreferredLocale(locale: 'en' | 'hi') {
  const ctx = await requireSession();
  if (!ctx) return { error: 'Unauthorized' };

  await prisma.user.update({
    where: { id: ctx.userId },
    data: { preferredLocale: locale },
  });
  return { success: true };
}
