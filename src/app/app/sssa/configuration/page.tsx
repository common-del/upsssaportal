import { getProgrammeAdminData } from '@/lib/actions/programmeAdmin';
import { ProgrammeConfigForm } from '@/components/sssa/ProgrammeConfigForm';
import { RubricManager } from '@/components/sssa/RubricManager';

export default async function ConfigurationPage() {
  const data = await getProgrammeAdminData();
  if (!data) return <p className="text-sm text-gray-600">Not authorised, or the configuration row is missing.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#073763' }}>
          Programme configuration
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#5F7190' }}>
          Every contested number in the programme lives here rather than in code. Where the
          source documents disagree, the note beside the setting says so. Every change needs a
          reason and is kept on the record below.
        </p>
      </div>
      <RubricManager rubrics={data.rubrics} />
      <ProgrammeConfigForm config={data.config} changes={data.changes} />
    </div>
  );
}
