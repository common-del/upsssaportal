import { CompareSchoolsContent } from '@/components/public/CompareSchoolsContent';

export default async function CompareSchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    schools?: string;
    district?: string;
    type?: string;
    search?: string;
  }>;
}) {
  const initial = await searchParams;
  return <CompareSchoolsContent initial={initial} />;
}
