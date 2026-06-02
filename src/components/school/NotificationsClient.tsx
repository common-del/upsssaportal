'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Calendar, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/schoolPortal';
import type { NotificationType } from '@prisma/client';
import { cn } from '@/lib/cn';

type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

function typeIcon(type: NotificationType) {
  switch (type) {
    case 'CYCLE_OPENED': return <Calendar className="h-5 w-5 text-blue-500" />;
    case 'SUBMISSION_RECEIVED': return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'REVIEW_COMMENT': return <MessageSquare className="h-5 w-5 text-purple-500" />;
    case 'DEADLINE_REMINDER': return <AlertCircle className="h-5 w-5 text-amber-500" />;
    case 'DISPUTE_FILED': return <Bell className="h-5 w-5 text-red-500" />;
    default: return <Bell className="h-5 w-5 text-gray-500" />;
  }
}

type FilterTab = 'all' | 'unread' | 'cycle' | 'review' | 'deadlines';

export function NotificationsClient({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<FilterTab>('all');

  const filtered = notifications.filter((n) => {
    if (tab === 'unread') return !n.read;
    if (tab === 'cycle') return n.type === 'CYCLE_OPENED' || n.type === 'SUBMISSION_RECEIVED';
    if (tab === 'review') return n.type === 'REVIEW_COMMENT';
    if (tab === 'deadlines') return n.type === 'DEADLINE_REMINDER';
    return true;
  });

  function markRead(id: string) {
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  function markAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'cycle', label: 'Cycle Updates' },
    { key: 'review', label: 'Review Comments' },
    { key: 'deadlines', label: 'Deadlines' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">Cycle updates, review comments and deadline reminders.</p>
        </header>
        <button
          type="button"
          disabled={pending}
          onClick={markAllRead}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Mark all as read
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium',
              tab === key ? 'text-[#1B2A6B]' : 'text-gray-600 hover:bg-gray-100',
            )}
            style={tab === key ? { backgroundColor: '#F5B731' } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm">No notifications.</p>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={cn(
                'relative rounded-2xl bg-white p-5 shadow-sm',
                !n.read && 'border-l-4 border-blue-500 pl-6',
              )}
            >
              {!n.read && (
                <span className="absolute left-2 top-6 h-2 w-2 rounded-full bg-blue-500" />
              )}
              <div className="flex gap-4">
                <div className="shrink-0">{typeIcon(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{n.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{n.body}</p>
                  <p className="mt-2 text-xs text-gray-400">{n.createdAt}</p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => markRead(n.id)}
                    className="shrink-0 text-xs font-medium text-[#1B2A6B] hover:underline disabled:opacity-50"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
