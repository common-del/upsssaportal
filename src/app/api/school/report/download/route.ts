import React from 'react';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildSchoolReportData } from '@/lib/reports/schoolReport';
import SchoolReportPdf from '@/lib/reports/SchoolReportPdf';
import { renderToBuffer } from '@react-pdf/renderer';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session.user.role;
  const url = new URL(request.url);
  const udiseParam = url.searchParams.get('udise');
  const locale = (url.searchParams.get('locale') === 'hi' ? 'hi' : 'en') as 'en' | 'hi';

  let udise: string | null = null;
  if (role === 'SCHOOL') udise = session.user.name ?? null;
  else if (role === 'SSSA_ADMIN') udise = udiseParam;
  else return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!udise) return NextResponse.json({ error: 'Missing udise' }, { status: 400 });

  const data = await buildSchoolReportData(udise);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // `renderToBuffer` is typed to accept a react-pdf `<Document />` element.
  // Our `SchoolReportPdf` returns that `<Document />`, but TS can't prove it through the component boundary,
  // so we cast without changing runtime behavior.
  const pdf = await renderToBuffer(React.createElement(SchoolReportPdf, { data, locale }) as any);
  const pdfBytes = new Uint8Array(pdf);

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="school-report-${udise}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

