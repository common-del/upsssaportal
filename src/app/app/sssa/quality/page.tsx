import { getQualitySample } from '@/lib/actions/supervisor';
import { QualitySampler } from '@/components/supervisor/QualitySampler';

export default async function QualityPage() {
  const items = await getQualitySample();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#073763' }}>
          Quality sample
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#5F7190' }}>
          A fixed draw of completed work, redrawn every Monday. The draw is seeded on the server,
          so a verifier cannot predict which of their cases you will read and nobody can fish for
          a particular one.
        </p>
      </div>
      <QualitySampler items={items} />
    </div>
  );
}
