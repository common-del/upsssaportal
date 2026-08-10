'use client';

import { useState, useTransition } from 'react';
import { sendBlockReminder } from '@/lib/actions/reminders';

const NAVY = '#1B2A6B';

function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

/**
 * The one control on this page that reaches real people.
 *
 * It says how many schools it will write to, because "Send reminder" on a row
 * carrying 58 schools reads like a single message. And it shows when the block was
 * last chased, so a second officer does not repeat a nudge sent yesterday — the
 * server refuses inside 24 hours regardless, but a refusal after the click is a
 * worse experience than knowing beforehand.
 */
export function RemindButton({
  blockCode,
  notStarted,
  lastRemindedAt,
}: {
  blockCode: string;
  notStarted: number;
  lastRemindedAt?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sent: number; error?: string } | null>(null);

  const recentlySent =
    !!lastRemindedAt && Date.now() - new Date(lastRemindedAt).getTime() < 24 * 3_600_000;

  if (result?.sent) {
    return (
      <span className="text-[12px] font-semibold text-green-700">
        Reminded {result.sent} {result.sent === 1 ? 'school' : 'schools'}
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending || notStarted === 0 || recentlySent}
        onClick={() =>
          startTransition(async () => {
            setResult(await sendBlockReminder(blockCode));
          })
        }
        className="whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] font-bold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
        style={{ borderColor: NAVY, color: NAVY }}
        title={
          recentlySent
            ? 'Already reminded in the last 24 hours'
            : `Notifies the ${notStarted} schools here that have not started`
        }
      >
        {pending
          ? 'Sending…'
          : recentlySent
            ? 'Reminded'
            : lastRemindedAt
              ? 'Remind again'
              : `Remind ${notStarted}`}
      </button>

      {result?.error ? (
        <span className="text-[11px] text-red-700">{result.error}</span>
      ) : lastRemindedAt ? (
        <span className="text-[11px] text-gray-500">Last sent {daysAgo(lastRemindedAt)}</span>
      ) : null}
    </span>
  );
}
