import { PublicNav } from '@/components/public/PublicNav';
import { PublicFooter } from '@/components/public/PublicFooter';
import { DemoDataNotice } from '@/components/public/DemoDataNotice';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
      {/* Above the navigation, so it is read before anyone reaches a school's page
          rather than after. Every public page inherits it from here — putting it on
          pages one at a time is how a page ends up without it. */}
      <DemoDataNotice />
      <PublicNav />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
