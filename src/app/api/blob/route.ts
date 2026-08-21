import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// Guided-capture walkthrough clips are the one video the portal accepts: short, recorded
// in the app, uploaded straight from the camera. Scoped by path prefix so the size
// allowance for video never applies to documents and images.
const CLIP_PREFIX = 'walkthrough/';
const CLIP_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp'];
const CLIP_MAX_SIZE = 100 * 1024 * 1024; // 100MB, roughly a minute of 1080p or several of 480p

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session.user.role;
  // The four verification roles were missing, so an On-Ground Verifier could not upload the
  // geotagged photographs the field protocol requires: the endpoint refused them by omission.
  if (
    ![
      'SCHOOL',
      'VERIFIER',
      'ONLINE_VERIFIER',
      'ONGROUND_VERIFIER',
      'SUPERVISOR',
      'AUDIT_CELL',
      'SSSA_ADMIN',
    ].includes(role)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const isClip = pathname.startsWith(CLIP_PREFIX);
        return {
          allowedContentTypes: isClip ? CLIP_TYPES : ALLOWED_TYPES,
          maximumSizeInBytes: isClip ? CLIP_MAX_SIZE : MAX_SIZE,
          // Was absent, which defaults to false: the blob landed at the original filename, so
          // evidence URLs were guessable and the second school to upload "toilet.jpg" got a hard
          // error because allowOverwrite also defaults to false. Both were findings 02 and 03 of
          // the security review.
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Record creation handled by the client via server action after upload
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
