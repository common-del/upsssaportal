import { redirect } from 'next/navigation';

/**
 * Recording tasks had its own page for a day. It is one zone of the walkthrough queue now.
 *
 * The redirect stays because the URL was in production and a bookmark should land on the work
 * rather than on a 404. The same reason /app/sssa/escalations still redirects to Decisions.
 */
export default function RecordingTasksRedirect() {
  redirect('/app/verifier/walkthroughs');
}
