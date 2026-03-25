import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildSchoolReportData } from '@/lib/reports/schoolReport';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session.user.role;
  const url = new URL(request.url);
  const udiseParam = url.searchParams.get('udise');

  let udise: string | null = null;
  if (role === 'SCHOOL') udise = session.user.name ?? null;
  else if (role === 'SSSA_ADMIN') udise = udiseParam;
  else return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!udise) return NextResponse.json({ error: 'Missing udise' }, { status: 400 });

  const data = await buildSchoolReportData(udise);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(data);
}

