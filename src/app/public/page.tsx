import Link from 'next/link';
import { HomeContent } from '@/components/public/HomeContent';
import { ReportsContent } from '@/components/public/ReportsContent';

export default function PublicHomePage() {
  return (
    <div className="bg-[#F3F4F6]">
      <HomeContent />

      <section id="reports" className="scroll-mt-20">
        <ReportsContent />
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-10">
        <p className="text-center text-xs text-gray-400">
          For unresolved issues regarding a school, you may use the{' '}
          <Link
            href="/public/dispute/new"
            className="underline hover:text-gray-600"
          >
            Grievance Redressal
          </Link>{' '}
          facility or{' '}
          <Link
            href="/public/dispute/track"
            className="underline hover:text-gray-600"
          >
            track an existing grievance
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
