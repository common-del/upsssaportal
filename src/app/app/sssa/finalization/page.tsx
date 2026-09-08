import { redirect } from 'next/navigation';

/**
 * Retired in the consolidation. This page held the second of two publication systems:
 * a cycle-wide "publish results" switch from before the verification pipeline existed,
 * sitting unlinked in any sidebar while Reporting published school by school through
 * the census queue. Two publish buttons with different semantics is how a cycle gets
 * half-published twice, so the switch is gone and publication belongs to Reporting.
 * The school report card honours both eras: a school is published if its own
 * Result.publishedAt is set or the old cycle switch was ever thrown.
 *
 * The appeal decision screen below this route (/finalization/appeal/[udise]) is alive
 * and linked from the Appeals page; only this index retired.
 */
export default function FinalizationRetiredPage() {
  redirect('/app/sssa/reporting');
}
