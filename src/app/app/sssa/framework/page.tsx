import { redirect } from 'next/navigation';

/**
 * This route rendered a display-only copy of the hardcoded UP SQAAF framework with
 * edit affordances that saved nothing — an editor in appearance only, and a second
 * "Framework" beside the real one. The sidebar now points at /app/sssa/frameworks,
 * the manager the cycle actually reads from; this redirect catches old bookmarks.
 */
export default function SssaFrameworkRedirect() {
  redirect('/app/sssa/frameworks');
}
