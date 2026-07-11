import { ActivityLog } from '@/components/sssa/ActivityLog';
import { buildActivityLog } from '@/lib/sssa/activityLog';

export default async function ActivityLogPage() {
  const { counts, items } = await buildActivityLog(30);

  return (
    <ActivityLog
      counts={counts}
      items={items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
      }))}
    />
  );
}
