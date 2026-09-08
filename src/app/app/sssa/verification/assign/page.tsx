import { redirect } from 'next/navigation';

export default function LegacyVerifierAssignPage() {
  redirect('/app/sssa/appeals?tab=legacy');
}
