import { redirect } from 'next/navigation';

/**
 * The page once called Verification. Appeals live in the Decisions inbox; the
 * manual assignment queue it also carried is retired outright, so every old link
 * lands on Decisions.
 */
export default function VerificationMovedPage() {
  redirect('/app/sssa/decisions?tab=appeals');
}
