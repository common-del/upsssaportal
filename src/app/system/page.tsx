import { redirect } from 'next/navigation';
import { LOGIN_PATH } from '@/lib/loginRoutes';

export default function SystemPage() {
  redirect(LOGIN_PATH);
}
