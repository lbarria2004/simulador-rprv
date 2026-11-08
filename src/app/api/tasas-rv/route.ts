import { NextResponse } from 'next/server';
import { PERFIL_PILOTO } from '@/lib/piloto';
export async function GET() {
  return NextResponse.json({ success: false, perfil: PERFIL_PILOTO, codigo: 'FUNCION_RESTRINGIDA', error: 'M14/M15/M26: datos comerciales de aseguradoras deshabilitados. Utilice una tasa RV hipotética explícita.' }, { status: 403 });
}
