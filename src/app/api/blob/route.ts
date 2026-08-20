import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_SIZE,
        // Was absent, which defaults to false: the blob landed at the original filename, so
        // evidence URLs were guessable and the second school to upload "toilet.jpg" got a hard
        // error because allowOverwrite also defaults to false. Both were findings 02 and 03 of
        // the security review.
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // Record creation handled by the client via server action after upload
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
