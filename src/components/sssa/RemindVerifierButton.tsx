'use client';

import { useState, useTransition } from 'react';
import { sendVerifierReminder } from '@/lib/actions/reminders';

const NAVY = '#1B2A6B';
const COOLDOWN_MS = 24 * 3_600_000;

function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
}

/**
 * Chases the verifier a school is waiting on.
 *
 * Disabled inside the cooldown rather than left clickable, because the server
 * refuses either way and a refusal after the click is a worse experience than
 * knowing beforehand. The last-sent line is there for the same reason: two officers
 * working the same district should not both chase the same person on the same day.
 */
export function RemindVerifierButton({
  udise,
  lastRemindedAt,
}: {
  udise: string;
  lastRemindedAt?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sent: number; error?: string } | null>(null);

  const recentlySent = !!lastRemindedAt && Date.now() - new Date(lastRemindedAt).getTime() < COOLDOWN_MS;

  if (result?.sent) {
    return <span className="whitespace-nowrap text-[11.5px] font-bold text-green-700">Reminded</span>;
  }

  return (
    <span className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending || recentlySent}
        onClick={() =>
          startTransition(async () => {
            setResult(await sendVerifierReminder(udise));
          })
        }
        className="whitespace-nowrap rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-500 hover:border-[#1B2A6B] hover:text-[#1B2A6B] disabled:cursor-not-allowed disabled:opacity-45"
        style={pending ? { borderColor: NAVY, color: NAVY } : undefined}
        title={
          recentlySent
            ? 'Already reminded in the last 24 hours'
            : 'Notifies the verifier that this school is waiting'
        }
      >
        {pending ? 'Sending…' : recentlySent ? 'Reminded' : 'Remind'}
      </button>

      {result?.error ? (
        <span className="max-w-[150px] text-right text-[10.5px] leading-tight text-red-700">
          {result.error}
        </span>
      ) : lastRemindedAt ? (
        <span className="text-[10.5px] text-gray-400">{daysAgo(lastRemindedAt)}</span>
      ) : null}
    </span>
  );
}
