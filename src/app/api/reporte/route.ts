import { NextRequest, NextResponse } from 'next/server';
import { generarReportePDF } from '@/lib/reporte-pdf';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bytes = await generarReportePDF(body);
    return new Response(Buffer.from(bytes), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Estudio_Pensiones.pdf"'
    } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Error al generar reporte' },
      { status: error instanceof RangeError ? 400 : 500 });
  }
}
