import { NextResponse } from 'next/server';

interface UFResponse {
  success: boolean;
  valor?: number;
  fecha?: string;
  fuente?: string;
  error?: string;
}

// Cache simple en memoria (1 hora)
let cachedUF: { valor: number; timestamp: number; fecha: string; fuente: string } | null = null;
const CACHE_DURATION = 3600000; // 1 hora en ms

// Valor de respaldo si no se puede obtener online
const UF_FALLBACK = 40876.41;

const MESES_SII = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Consulta la tabla oficial del SII (Servicio de Impuestos Internos)
 * URL: https://www.sii.cl/valores_y_fechas/uf/uf{año}.htm
 */
async function obtenerUfDesdeSII(): Promise<{ valor: number; fecha: string } | null> {
  const now = new Date();
  const year = now.getFullYear().toString();
  const mesNombre = MESES_SII[now.getMonth()];
  const day = now.getDate();
  const fechaIso = now.toISOString().split('T')[0];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`https://www.sii.cl/valores_y_fechas/uf/uf${year}.htm`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 3600 }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const html = await res.text();
    // Localizar el bloque del mes actual
    const mesIdx = html.toLowerCase().indexOf(`mes_${mesNombre}`);
    const subHtml = mesIdx !== -1 ? html.substring(mesIdx, mesIdx + 6000) : html;

    // Buscar el día actual dentro del mes
    const pattern = new RegExp(`<strong>\\s*${day}\\s*<\\/strong><\\/th>\\s*<td[^>]*>([0-9.,]+)<\\/td>`, 'i');
    const match = subHtml.match(pattern);

    if (match && match[1]) {
      const valorStr = match[1].trim();
      const valorNum = parseFloat(valorStr.replace(/\./g, '').replace(',', '.'));
      if (!isNaN(valorNum) && valorNum >= 35000 && valorNum <= 60000) {
        return { valor: valorNum, fecha: fechaIso };
      }
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Consulta la API pública de indicadores económicos (mindicador.cl)
 */
async function obtenerUfDesdeMindicador(): Promise<{ valor: number; fecha: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch('https://mindicador.cl/api/uf', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Simulador-RPRV/1.0'
      },
      next: { revalidate: 3600 }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const data = await res.json();
    if (data?.serie && Array.isArray(data.serie) && data.serie.length > 0) {
      const ultimoDato = data.serie[0];
      const valor = typeof ultimoDato.valor === 'number' ? ultimoDato.valor : parseFloat(ultimoDato.valor);
      const fecha = ultimoDato.fecha ? ultimoDato.fecha.split('T')[0] : new Date().toISOString().split('T')[0];

      if (!isNaN(valor) && valor >= 35000 && valor <= 60000) {
        return { valor: Math.round(valor * 100) / 100, fecha };
      }
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function GET(): Promise<NextResponse<UFResponse>> {
  try {
    // 1. Verificar cache activo
    if (cachedUF && (Date.now() - cachedUF.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        valor: cachedUF.valor,
        fecha: cachedUF.fecha,
        fuente: `cache (${cachedUF.fuente})`
      });
    }

    // 2. Intentar fuente primaria oficial: SII
    const datoSII = await obtenerUfDesdeSII();
    if (datoSII) {
      cachedUF = {
        valor: datoSII.valor,
        fecha: datoSII.fecha,
        fuente: 'sii.cl',
        timestamp: Date.now()
      };

      return NextResponse.json({
        success: true,
        valor: cachedUF.valor,
        fecha: cachedUF.fecha,
        fuente: 'sii.cl'
      });
    }

    // 3. Intentar fuente secundaria: mindicador.cl
    const datoMindicador = await obtenerUfDesdeMindicador();
    if (datoMindicador) {
      cachedUF = {
        valor: datoMindicador.valor,
        fecha: datoMindicador.fecha,
        fuente: 'mindicador.cl',
        timestamp: Date.now()
      };

      return NextResponse.json({
        success: true,
        valor: cachedUF.valor,
        fecha: cachedUF.fecha,
        fuente: 'mindicador.cl'
      });
    }

    throw new Error('Todas las fuentes remotas fallaron');

  } catch (error) {
    console.warn('Fallo al obtener UF online, usando respaldo:', error);

    return NextResponse.json({
      success: true,
      valor: cachedUF?.valor ?? UF_FALLBACK,
      fecha: cachedUF?.fecha ?? new Date().toISOString().split('T')[0],
      fuente: cachedUF ? `cache-stale (${cachedUF.fuente})` : 'fallback_local',
      error: 'Usando valor de respaldo'
    });
  }
}
