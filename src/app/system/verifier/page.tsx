import { redirect } from 'next/navigation';
import { LOGIN_TABS } from '@/lib/loginRoutes';

export default function VerifierLoginPage() {
  redirect(LOGIN_TABS.verifier);
}
