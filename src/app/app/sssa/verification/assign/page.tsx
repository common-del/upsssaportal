import { redirect } from 'next/navigation';

export default function LegacyVerifierAssignPage() {
  redirect('/app/sssa/decisions?tab=appeals');
}
