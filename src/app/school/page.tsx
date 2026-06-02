import { redirect } from 'next/navigation';
import { LOGIN_TABS } from '@/lib/loginRoutes';

export default function SchoolLoginPage() {
  redirect(LOGIN_TABS.school);
}
