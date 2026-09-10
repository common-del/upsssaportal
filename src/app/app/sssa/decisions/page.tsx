import Link from 'next/link';
import { buildDecisionsInbox } from '@/lib/sssa/decisionsInbox';
import { DecisionsInbox, type DecisionsTab, type IssuesWho } from '@/components/sssa/DecisionsInbox';

/**
 * Every ruling waiting on the admin, in three tabs.
 *
 * Overview is the default and only informs: who-count tiles, the backlog by age,
 * and four standing signals. Appeals and Verification issues are the work tabs,
 * every decision on the same six-slot card; "Rule oldest first" deals the same
 * cards one at a time. This page replaced the three sidebar entries Appeals,
 * Escalations and Discrepancies; their URLs and old query shapes land on the right
 * slice below. The legacy assignment queue is not a decision and lives on at
 * /app/sssa/appeals?tab=legacy; Audit stays its own page on purpose, being a blind
 * re-check of finished work rather than a pending ruling.
 */
export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; who?: string; type?: string; view?: string }>;
}) {
  const [data, sp] = await Promise.all([buildDecisionsInbox(), searchParams]);

  // New shape first, then the older ?type=/?view= links still in notifications.
  const tab: DecisionsTab =
    sp.tab === 'appeals' || sp.tab === 'issues' || sp.tab === 'overview'
      ? sp.tab
      : sp.type === 'appeals'
        ? 'appeals'
        : sp.type === 'escalations' || sp.type === 'discrepancies'
          ? 'issues'
          : 'overview';
  const who: IssuesWho =
    sp.who === 'verifier' || sp.who === 'field'
      ? sp.who
      : sp.type === 'escalations'
        ? 'verifier'
        : sp.type === 'discrepancies'
          ? 'field'
          : 'all';
  const focus = sp.view === 'focus';

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Decisions</h1>
      </header>

      <DecisionsInbox data={data} initialTab={tab} initialWho={who} initialFocus={focus} />

      <p className="text-[12px] text-gray-400">
        Looking for manual verifier assignment? That is not a decision and lives on the{' '}
        <Link href="/app/sssa/appeals?tab=legacy" className="underline hover:text-gray-600">
          legacy assignment queue
        </Link>
        .
      </p>
    </div>
  );
}
