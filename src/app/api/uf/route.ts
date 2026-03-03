import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface UFResponse {
  success: boolean;
  valor?: number;
  fecha?: string;
  fuente?: string;
  error?: string;
}

// Cache simple en memoria (1 hora)
let cachedUF: { valor: number; timestamp: number; fecha: string } | null = null;
const CACHE_DURATION = 3600000; // 1 hora en ms

// Valor de respaldo si no se puede obtener online
const UF_FALLBACK = 39600;

export async function GET(): Promise<NextResponse<UFResponse>> {
  try {
    // Verificar cache
    if (cachedUF && (Date.now() - cachedUF.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        valor: cachedUF.valor,
        fecha: cachedUF.fecha,
        fuente: 'cache'
      });
    }

    // Intentar obtener UF actualizada
    const zai = await ZAI.create();
    
    // Buscar valor actual de UF
    const searchResults = await zai.functions.invoke('web_search', {
      query: 'valor UF hoy Chile peso',
      num: 3
    });

    let ufValue = UF_FALLBACK;
    let foundDate = new Date().toISOString().split('T')[0];

    // Intentar extraer el valor de los resultados de búsqueda
    if (Array.isArray(searchResults) && searchResults.length > 0) {
      for (const result of searchResults) {
        // Buscar patrón de valor en el snippet (ej: "$39.600" o "39600 pesos")
        const snippet = result.snippet || '';
        const match = snippet.match(/\$?(\d{1,3}(?:\.?\d{3})*(?:,\d{2})?)/);
        
        if (match) {
          // Limpiar y convertir el valor
          const valorStr = match[1].replace(/\./g, '').replace(',', '.');
          const valor = parseFloat(valorStr);
          
          // Validar que esté en un rango razonable (35.000 - 45.000)
          if (valor >= 35000 && valor <= 45000) {
            ufValue = valor;
            break;
          }
        }
      }
    }

    // Intentar leer la página del SII para mayor precisión
    try {
      const pageResult = await zai.functions.invoke('page_reader', {
        url: 'https://www.sii.cl/valores_y_fechas/uf/uf2025.htm'
      });

      if (pageResult?.data?.html) {
        // Buscar el valor de hoy en la tabla del SII
        const html = pageResult.data.html;
        const today = new Date();
        const day = today.getDate().toString();
        
        // Patrón para encontrar el valor del día actual
        const dayPattern = new RegExp(`${day}[^<]*</td><td[^>]*>([^<]+)</td>`, 'i');
        const match = html.match(dayPattern);
        
        if (match) {
          const valorStr = match[1].replace(/\./g, '').replace(',', '.').trim();
          const valor = parseFloat(valorStr);
          
          if (valor >= 35000 && valor <= 45000) {
            ufValue = valor;
            foundDate = today.toISOString().split('T')[0];
          }
        }
      }
    } catch {
      console.log('No se pudo leer SII directamente, usando valor alternativo');
    }

    // Actualizar cache
    cachedUF = {
      valor: ufValue,
      timestamp: Date.now(),
      fecha: foundDate
    };

    return NextResponse.json({
      success: true,
      valor: ufValue,
      fecha: foundDate,
      fuente: 'online'
    });

  } catch (error) {
    console.error('Error obteniendo UF:', error);
    
    // Retornar valor de respaldo
    return NextResponse.json({
      success: true,
      valor: UF_FALLBACK,
      fecha: new Date().toISOString().split('T')[0],
      fuente: 'fallback',
      error: 'Usando valor de respaldo'
    });
  }
}
