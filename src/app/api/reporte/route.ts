import { NextRequest, NextResponse } from 'next/server';
import { generarReportePilotoPDF } from '@/lib/reporte-piloto';
import { ErrorPiloto } from '@/lib/piloto';
export async function POST(request: NextRequest) {
  try {
    const bytes = await generarReportePilotoPDF(await request.json());
    return new Response(Buffer.from(bytes), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="Piloto_RP_RV.pdf"', 'Cache-Control': 'no-store'
    } });
  } catch (error) {
    return NextResponse.json({ success: false, codigo: error instanceof ErrorPiloto ? error.codigo : 'DATOS_INVALIDOS', error: error instanceof Error ? error.message : 'No fue posible generar el informe.' },
      { status: error instanceof ErrorPiloto ? error.status : 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
