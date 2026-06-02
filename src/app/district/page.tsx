import { redirect } from 'next/navigation';
import { LOGIN_TABS } from '@/lib/loginRoutes';

export default function DistrictLoginPage() {
  redirect(LOGIN_TABS.official);
}
