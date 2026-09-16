import { getMySchoolLocationState, getMySchoolWalkthrough } from '@/lib/actions/walkthrough';
import {
  RegisterLocationCard,
  SchoolWalkthroughClient,
} from '@/components/school/SchoolWalkthroughClient';

const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

export default async function SchoolWalkthroughPage() {
  const [view, location] = await Promise.all([getMySchoolWalkthrough(), getMySchoolLocationState()]);

  // The heading follows the mode, because the two are different jobs. A school whose call has
  // already dropped should not be reading about a live session it can no longer join.
  const recording = view?.mode === 'GUIDED_CAPTURE';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          {recording ? 'Recording tasks' : 'Video walkthrough'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          {recording
            ? 'The live check could not hold its connection, so film a short video for each item instead. There is nobody waiting on a call.'
            : 'When your self assessment is flagged for a live check, the session runs here: you and an anonymous verifier speak while your camera shows the school.'}
        </p>
      </div>

      {location && <RegisterLocationCard capturedAt={location.capturedAt} />}

      {view ? (
        <SchoolWalkthroughClient view={view} />
      ) : (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">No walkthrough is scheduled for your school.</p>
          <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
            Most schools never need one. A session appears here only if the desk screening of
            your self assessment leaves questions that a live look can settle.
          </p>
        </div>
      )}
    </div>
  );
}
