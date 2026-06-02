import { PublicNav } from '@/components/public/PublicNav';
import { PublicFooter } from '@/components/public/PublicFooter';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
      <PublicNav />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
