import { LoginHeader } from '@/components/auth/LoginHeader';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
      <LoginHeader />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
