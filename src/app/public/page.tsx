import { HomeContent } from '@/components/public/HomeContent';
import { loadRegisterStats } from '@/lib/public/registerStats';

export default async function PublicHomePage() {
  // Loaded here rather than in HomeContent because HomeContent is a client component
  // with a district selector. Passing the counts in is what stops them being derived
  // from a multiplier, which is how they were arrived at before.
  const stats = await loadRegisterStats();

  return (
    <div className="bg-[#F3F4F6]">
      <HomeContent stats={stats} />
    </div>
  );
}
