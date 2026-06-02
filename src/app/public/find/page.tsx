import { prisma } from '@/lib/db';
import { FindSchoolFlow } from '@/components/public/FindSchoolFlow';
import { getFallbackGeo, type GeoOption } from '@/lib/public/findGeoFallback';

async function loadGeo(): Promise<{ districts: GeoOption[]; blocks: GeoOption[] }> {
  try {
    const [districts, blocks] = await Promise.all([
      prisma.district.findMany({
        select: { code: true, nameEn: true, nameHi: true },
        orderBy: { nameEn: 'asc' },
      }),
      prisma.block.findMany({
        select: { code: true, districtCode: true, nameEn: true, nameHi: true },
        orderBy: { nameEn: 'asc' },
      }),
    ]);
    return { districts, blocks };
  } catch {
    return getFallbackGeo();
  }
}

export default async function FindSchoolsPage() {
  const { districts, blocks } = await loadGeo();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <FindSchoolFlow districts={districts} blocks={blocks} />
    </div>
  );
}
