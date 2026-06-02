import { prisma } from '@/lib/db';

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}
