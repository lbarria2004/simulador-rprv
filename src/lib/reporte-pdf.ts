import type { PorcentajeBeneficiario } from './reglas-sobrevivencia.ts';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { calcularPGU, calcularBAC, calcularCompensacionExpectativaVidaMujer, PGU } from './pension-calculator.ts';
import { clpAUf, ufAClp, validarReferenciaUF, type ReferenciaUF } from './moneda.ts';

interface AfiliadoData {
  nombre: string;
  sexo: string;
  edad: number;
  fondosAcumulados: number;
  anosCotizados: number;
  tipoPension?: 'vejez' | 'invalidez' | 'sobrevivencia';
  gradoInvalidez?: string;
  ingresoBase?: number;
  cubiertoSIS?: boolean;
}

interface ParametrosData {
  referenciaUF: ReferenciaUF;
  tasaRP: number;
  rentabilidadRealAnualRP?: number;
  tasaRV: number;
  incluirPGU?: boolean;
  incluirBAC?: boolean;
  incluirBonoMujer?: boolean;
  mesesAdicionalesBAC?: number;
  afpSeleccionada?: string;
  usarProyeccionUF?: boolean;
  incrementoAnualUF?: number;
}

// Constantes actualizadas
const BAC_UF_POR_ANO = 0.1; // 0,1 UF por año cotizado
const BAC_TOPE_UF = 2.5;    // Tope máximo de 2,5 UF

// Comisiones por AFP (porcentaje sobre pensión bruta)
const COMISIONES_AFP: Record<string, number> = {
  PLANVITAL: 0.0000,  // 0,00%
  HABITAT: 0.0095,    // 0,95%
  CAPITAL: 0.0125,    // 1,25%
  CUPRUM: 0.0125,     // 1,25%
  MODELO: 0.0120,     // 1,20%
  PROVIDA: 0.0125,    // 1,25%
  UNO: 0.0120         // 1,20%
}

const AFP_LABELS: Record<string, string> = {
  PLANVITAL: 'AFP PlanVital (0,00%)',
  HABITAT: 'AFP Habitat (0,95%)',
  CAPITAL: 'AFP Capital (1,25%)',
  CUPRUM: 'AFP Cuprum (1,25%)',
  MODELO: 'AFP Modelo (1,20%)',
  PROVIDA: 'AFP Provida (1,25%)',
  UNO: 'AFP Uno (1,20%)'
}

interface AumentoTemporal {
  meses: number;
  porcentaje: number;
  pensionAumentada: number;
  pensionFinal: number;
}

interface PensionPorBeneficiario {
  tipo: string;
  porcentaje: number;
  pensionMensual: number;
}

interface ResultadoData {
  referenciaUF?: ReferenciaUF;
  nombre: string;
  pensionMensual: number;
  pensionEnUF: number;
  pensionBaseReparto?: number;
  reglasSobrevivencia?: PorcentajeBeneficiario[];
  metodologiaTemporal?: string;
  pensionAnual: number;
  cnu: number;
  tasaInteres: number;
  expectativaVida: number;
  periodoGarantizado?: number;
  aumentoTemporal?: AumentoTemporal;
  advertencias?: string[];
  pensionPorBeneficiario?: PensionPorBeneficiario[];
  gradoInvalidez?: string;
  ingresoBase?: number;
  porcentajeInvalidez?: number;
}

interface BeneficiarioData {
  tipo: string;
  edad: number;
  sexo: string;
  porcentajePension: number;
}

// Formatear número con separador de miles
function formatNumber(num: number): string {
  return Math.round(num).toLocaleString('es-CL');
}

// Dibujar texto
function drawText(page: any, text: string, x: number, y: number, options: { size?: number; font?: any; color?: { r: number; g: number; b: number }; bold?: boolean } = {}) {
  const { size = 10, font, color, bold = false } = options;
  page.drawText(text, {
    x,
    y,
    size,
    font: font,
    color: color ? rgb(color.r, color.g, color.b) : rgb(0, 0, 0),
  });
}

// Dibujar tabla
function drawTable(page: any, data: string[][], x: number, y: number, colWidths: number[], fonts: { regular: any; bold: any }) {
  const rowHeight = 18;
  const cellPadding = 4;
  let currentY = y;

  for (let row = 0; row < data.length; row++) {
    let currentX = x;

    for (let col = 0; col < data[row].length; col++) {
      const cellText = data[row][col];
      const cellWidth = colWidths[col];

      // Background
      if (row === 0) {
        page.drawRectangle({
          x: currentX,
          y: currentY - 4,
          width: cellWidth,
          height: rowHeight,
          color: rgb(0.122, 0.306, 0.475), // #1F4E79
        });
      } else if (row > 1) {
        page.drawRectangle({
          x: currentX,
          y: currentY - 4,
          width: cellWidth,
          height: rowHeight,
          color: rgb(0.91, 0.956, 0.992), // #E8F4FD
        });
      }

      // Border
      page.drawRectangle({
        x: currentX,
        y: currentY - 4,
        width: cellWidth,
        height: rowHeight,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
      });

      // Text
      const font = row === 0 ? fonts.bold : fonts.regular;
      const color = row === 0 ? { r: 1, g: 1, b: 1 } : { r: 0.2, g: 0.2, b: 0.2 };

      drawText(page, cellText, currentX + cellPadding, currentY + 2, {
        size: 7,
        font,
        color
      });

      currentX += cellWidth;
    }
    currentY -= rowHeight;
  }

  return currentY - 10;
}

// Etiquetas para tipo de pensión
const TIPO_PENSION_LABELS: Record<string, string> = {
  vejez: 'Vejez (Edad Legal o Anticipada)',
  invalidez: 'Invalidez',
  sobrevivencia: 'Sobrevivencia'
};

// Etiquetas para tipo de beneficiario
const TIPO_BENEFICIARIO_LABELS: Record<string, string> = {
  conyuge: 'Conyuge',
  conviviente: 'Conviviente',
  hijo: 'Hijo/a',
  padre: 'Padre',
  madre: 'Madre'
};

// Etiquetas para grado de invalidez
const GRADO_INVALIDEZ_LABELS: Record<string, string> = {
  total: 'Total (70%)',
  total_2_3: 'Total 2/3 (50%)',
  parcial: 'Parcial (35%)'
};

export interface DatosReporte {
  afiliado: AfiliadoData;
  parametros: ParametrosData;
  resultados: ResultadoData[];
  beneficiarios: BeneficiarioData[];
}

export async function generarReportePDF(body: DatosReporte): Promise<Uint8Array> {
    const { afiliado, parametros, beneficiarios } = body;
    const referenciaUF = validarReferenciaUF(parametros.referenciaUF);
    const valorUF = referenciaUF.valor;
    if (parametros.usarProyeccionUF || parametros.incrementoAnualUF) {
      throw new RangeError('El reporte usa CLP reales. No admite proyección nominal de UF en la misma serie.');
    }
    const resultados = body.resultados.map(resultado => {
      if (resultado.referenciaUF) {
        const origen = validarReferenciaUF(resultado.referenciaUF);
        if (origen.valor !== valorUF || origen.fecha !== referenciaUF.fecha) {
          throw new RangeError('La referencia UF del resultado difiere de la del reporte; recalcule la simulación');
        }
      }
      return { ...resultado, pensionEnUF: clpAUf(resultado.pensionMensual, referenciaUF) };
    });

    // Crear documento PDF
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([612, 792]); // Letter size - CAMBIADO A let

    // Fuentes
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 750;

    // Funcion helper para crear nueva pagina
    const nuevaPagina = () => {
      page = pdfDoc.addPage([612, 792]);
      y = 750;
    };

    // Determinar tipo de pensión
    const tipoPension = afiliado.tipoPension || 'vejez';

    // Título según tipo de pensión
    const tituloPension = tipoPension === 'invalidez'
      ? 'ESTUDIO PRELIMINAR DE PENSION DE INVALIDEZ'
      : tipoPension === 'sobrevivencia'
      ? 'ESTUDIO PRELIMINAR DE PENSION DE SOBREVIVENCIA'
      : 'ESTUDIO PRELIMINAR DE PENSION';

    drawText(page, tituloPension, 150, y, {
      size: 16,
      font: fontBold,
      color: { r: 0.102, g: 0.212, b: 0.365 }
    });
    y -= 25;

    drawText(page, 'SIMULACION INDEPENDIENTE - SIN CONEXION CON SCOMP', 50, y, { size: 8, font: fontBold });
    y -= 15;
    drawText(page, 'No constituye oferta oficial de AFP o aseguradora ni garantiza pension o rentabilidad.', 50, y, { size: 8, font: fontRegular });
    y -= 15;
    if (parametros.rentabilidadRealAnualRP !== undefined) {
      drawText(page, `RP: retorno real hipotetico ${(parametros.rentabilidadRealAnualRP * 100).toFixed(2)}% anual; descuento CNU ${(parametros.tasaRP * 100).toFixed(2)}%.`, 50, y, { size: 8, font: fontRegular });
      y -= 15;
    }

    drawText(page, 'Importes en CLP reales de la fecha UF de referencia; sin inflacion nominal.', 50, y, { size: 8, font: fontRegular });
    y -= 15;

    // Nombre afiliado/causante
    const nombreAfiliado = (afiliado.nombre || 'AFILIADO').toUpperCase();
    const etiquetaNombre = tipoPension === 'sobrevivencia' ? 'CAUSANTE' : 'SR.';
    drawText(page, `${etiquetaNombre} ${nombreAfiliado}`, 220, y, {
      size: 14,
      font: fontBold,
      color: { r: 0.176, g: 0.216, b: 0.282 }
    });
    y -= 25;

    // Info básica
    const fondosUF = clpAUf(afiliado.fondosAcumulados, referenciaUF).toFixed(2);

    drawText(page, `UF de referencia: $${valorUF.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - Fecha: ${referenciaUF.fecha}`, 50, y, { size: 10, font: fontRegular });
    y -= 15;
    drawText(page, `Edad: ${afiliado.edad} anos`, 50, y, { size: 10, font: fontRegular });
    y -= 15;
    drawText(page, `Tipo de Pension: ${TIPO_PENSION_LABELS[tipoPension]}`, 50, y, { size: 10, font: fontRegular });
    y -= 15;
    drawText(page, `Saldo Acumulado (Bruto): ${fondosUF} UF`, 50, y, { size: 10, font: fontRegular });
    y -= 20;

    // Obtener comisión AFP seleccionada (compartido para vejez e invalidez)
    const afpSeleccionada = parametros.afpSeleccionada || 'HABITAT';
    const comisionAFP = COMISIONES_AFP[afpSeleccionada] ?? 0.0095;
    const comisionAFPPct = (comisionAFP * 100).toFixed(2).replace('.', ',');
    const afpLabel = AFP_LABELS[afpSeleccionada] || 'AFP Habitat (0,95%)';

    // Cálculo dinámico de beneficios del Estado (PGU, BAC, BEV) para la última columna del estudio PDF
    const incluirPGU = parametros?.incluirPGU ?? (body as any)?.incluirPGU ?? false;
    const incluirBAC = parametros?.incluirBAC ?? (body as any)?.incluirBAC ?? false;
    const mesesAdicionalesBAC = parametros?.mesesAdicionalesBAC ?? (body as any)?.mesesAdicionalesBAC ?? 0;
    let bacUF = 0;
    let bacPesos = 0;
    const anosTotalesBAC = (afiliado.anosCotizados || 0) + (mesesAdicionalesBAC / 12);
    if (incluirBAC && tipoPension !== 'sobrevivencia') {
      const bac = calcularBAC(afiliado.anosCotizados, mesesAdicionalesBAC, referenciaUF);
      bacUF = bac.beneficioUF;
      bacPesos = bac.beneficioMensualPesos;
    }

    const esMujer = (afiliado?.sexo || (body as any)?.afiliado?.sexo) === 'F';
    const incluirBEV = (parametros as any)?.incluirBonoMujer ?? (parametros as any)?.incluirBEV ?? true;
    const bev = calcularCompensacionExpectativaVidaMujer(esMujer ? 'F' : 'M', afiliado.edad, referenciaUF, tipoPension, afiliado.cubiertoSIS);
    const bonoMujerUF = incluirBEV ? bev.beneficioUF : 0;
    const bonoMujerPesos = incluirBEV ? bev.beneficioMensualPesos : 0;

    // Función para calcular la última columna de cada fila: Pensión Bruta + PGU + BAC + BEV (en el caso que corresponda)
    const calcularTotalBrutoConBeneficios = (pensionBrutaFila: number): number => {
      const bruta = Math.round(pensionBrutaFila || 0);
      if (tipoPension === 'sobrevivencia') {
        return bruta;
      }
      const pguFila = incluirPGU
        ? calcularPGU(bruta, afiliado.edad).montoMensual
        : 0;
      const bacFila = incluirBAC ? bacPesos : 0;
      const bevFila = (incluirBEV && esMujer) ? bonoMujerPesos : 0;
      return bruta + pguFila + bacFila + bevFila;
    };

    const headerUltimaColumna = 'Bruta+PGU+BAC+BEV';

    // ========== PENSIÓN DE VEJEZ ==========
    if (tipoPension === 'vejez') {
      // Clasificar resultados por tipo usando propiedades del objeto
      const retiroProgramado = resultados.find(r => (r.nombre || '').includes('Retiro Programado'));

      // RV Inmediata: sin período garantizado ni aumento temporal
      const rvInmediata = resultados.find(r =>
        ((r.nombre || '').includes('Inmediata') || (r.nombre || '').includes('RV') || (r.nombre || '').includes('Renta Vitalicia')) &&
        !r.periodoGarantizado && !r.aumentoTemporal
      );

      // RV solo con Garantía: tiene periodoGarantizado pero NO aumentoTemporal
      const rvSoloGarantia = resultados.filter(r =>
        r.periodoGarantizado && r.periodoGarantizado > 0 && !r.aumentoTemporal
      );

      // RV con Aumento (con o sin garantía): tiene aumentoTemporal
      const rvConAumento = resultados.filter(r => r.aumentoTemporal);

      // Número de sección dinámico
      let numSeccion = 1;

      // 1. Retiro Programado
      if (retiroProgramado) {
        drawText(page, `${numSeccion}. Retiro Programado`, 50, y, {
          size: 11,
          font: fontBold,
          color: { r: 0.122, g: 0.306, b: 0.475 }
        });
        y -= 15;
        drawText(page, `(${afpLabel})`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = retiroProgramado.pensionMensual;
        const pensionUF = retiroProgramado.pensionEnUF.toFixed(2);
        const descuentoAFP = Math.round(pensionBruto * comisionAFP);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoAFP - descuentoSalud;
        const totalUltimaCol = calcularTotalBrutoConBeneficios(pensionBruto);

        const rpData = [
          ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', `Desc. ${comisionAFPPct}%`, 'Dscto. 7% Salud', 'Pension Liquida', headerUltimaColumna],
          ['RETIRO PROGRAMADO', `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoAFP)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`, `$${formatNumber(totalUltimaCol)}`]
        ];
        const colWidths = [95, 58, 72, 62, 68, 70, 87];
        y = drawTable(page, rpData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
        y -= 10;
        numSeccion++;
      }

      // 2. RV Inmediata
      if (rvInmediata) {
        drawText(page, `${numSeccion}. Renta Vitalicia Inmediata (Simple)`, 50, y, {
          size: 11,
          font: fontBold,
          color: { r: 0.122, g: 0.306, b: 0.475 }
        });
        y -= 15;
        const tasaRVPct = (rvInmediata.tasaInteres * 100).toFixed(2);
        drawText(page, `Estimacion RVI: Tasa hipotetica de descuento (Vejez: ${tasaRVPct}%)`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = rvInmediata.pensionMensual;
        const pensionUF = rvInmediata.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;
        const totalUltimaCol = calcularTotalBrutoConBeneficios(pensionBruto);

        const rviData = [
          ['Modalidad', 'Tasa (%)', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida', headerUltimaColumna],
          ['RVI SIMPLE (Supuesto)', `${tasaRVPct}%`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`, `$${formatNumber(totalUltimaCol)}`]
        ];
        const colWidths = [105, 45, 60, 75, 68, 72, 87];
        y = drawTable(page, rviData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
        y -= 10;
        numSeccion++;
      }

      // 3. RV con Garantía (solo garantía, sin aumento)
      for (const rv of rvSoloGarantia) {
        // Verificar si necesitamos nueva página
        if (y < 150) {
          nuevaPagina();
        }

        const meses = rv.periodoGarantizado || 0;

        drawText(page, `${numSeccion}. RV con Garantia ${meses} Meses`, 50, y, {
          size: 11,
          font: fontBold,
          color: { r: 0.122, g: 0.306, b: 0.475 }
        });
        y -= 15;
        drawText(page, `Si fallece antes del periodo, beneficiarios reciben el 100% de la pension`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = rv.pensionMensual;
        const pensionUF = rv.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;
        const totalUltimaCol = calcularTotalBrutoConBeneficios(pensionBruto);
        const tasa = (rv.tasaInteres * 100).toFixed(2);

        const rvgData = [
          ['Modalidad', 'Tasa (%)', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida', headerUltimaColumna],
          [`RV GARANTIA ${meses} MESES`, `${tasa}%`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`, `$${formatNumber(totalUltimaCol)}`]
        ];
        const colWidths = [105, 45, 60, 75, 68, 72, 87];
        y = drawTable(page, rvgData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
        y -= 10;
        numSeccion++;
      }

      // 4. RV con Aumento Temporal - Agrupados por período de aumento
      // Primero, agrupar por meses de aumento
      const rvAumentoPorMeses: Record<number, ResultadoData[]> = {};
      for (const rv of rvConAumento) {
        const mesesAumento = rv.aumentoTemporal?.meses || 0;
        if (!rvAumentoPorMeses[mesesAumento]) {
          rvAumentoPorMeses[mesesAumento] = [];
        }
        rvAumentoPorMeses[mesesAumento].push(rv);
      }

      // Ordenar cada grupo: primero sin garantía, luego por meses de garantía ascendente
      for (const mesesAumento of Object.keys(rvAumentoPorMeses).map(Number).sort((a, b) => a - b)) {
        const rvGrupo = rvAumentoPorMeses[mesesAumento];

        // Ordenar: sin garantía primero, luego por meses de garantía
        rvGrupo.sort((a, b) => {
          const ga = a.periodoGarantizado || 0;
          const gb = b.periodoGarantizado || 0;
          return ga - gb;
        });

        // Verificar si necesitamos nueva página
        if (y < 200) {
          nuevaPagina();
        }

        // Obtener porcentaje del primer elemento (todos en el grupo tienen el mismo)
        const porcentajeAumento = rvGrupo[0].aumentoTemporal?.porcentaje || 0;
        const porcentajeTxt = porcentajeAumento > 1 ? porcentajeAumento : porcentajeAumento * 100;

        // Título principal del grupo (solo una vez por período de aumento)
        drawText(page, `${numSeccion}. RENTA VITALICIA AUMENTADA ${mesesAumento} MESES AL ${porcentajeTxt}%`, 50, y, {
          size: 11,
          font: fontBold,
          color: { r: 0.122, g: 0.306, b: 0.475 }
        });
        y -= 16;

        // Procesar cada RV del grupo (sin garantía primero, luego con garantías)
        for (const rv of rvGrupo) {
          // Verificar espacio para cada tabla
          if (y < 120) {
            nuevaPagina();
          }

          const tieneGarantia = rv.periodoGarantizado && rv.periodoGarantizado > 0;
          const mesesGarantia = rv.periodoGarantizado || 0;

          // Subtítulo
          let subtitulo = `Aumento ${porcentajeTxt}% por ${mesesAumento} meses`;
          if (tieneGarantia) {
            subtitulo += ` + Garantizado ${mesesGarantia} meses`;
          }
          drawText(page, subtitulo, 50, y, { size: 9, font: fontRegular, color: { r: 0.3, g: 0.3, b: 0.3 } });
          y -= 15;

          // Cálculos para DURANTE el período de aumento
          const pensionAumentada = rv.pensionMensual;
          const pensionAumentadaUF = rv.pensionEnUF.toFixed(2);
          const descSaludAum = Math.round(pensionAumentada * 0.07);
          const pensionAumentadaLiq = pensionAumentada - descSaludAum;

          // Cálculos para DESPUÉS del período de aumento
          const pensionBase = rv.aumentoTemporal?.pensionFinal || pensionAumentada;
          const pensionBaseUF = clpAUf(pensionBase, referenciaUF).toFixed(2);
          const descSaludBase = Math.round(pensionBase * 0.07);
          const pensionBaseLiq = pensionBase - descSaludBase;

          const pensionBaseProyectada = pensionBase;
          const pensionBaseLiqProyectada = pensionBaseLiq;

          const totalUltimaColAum = calcularTotalBrutoConBeneficios(pensionAumentada);
          const totalUltimaColDef = calcularTotalBrutoConBeneficios(pensionBaseProyectada);

          // Tabla con dos períodos reflejando UF, Pesos y última columna: Pensión Bruta + PGU + BAC + BEV
          const tablaRV = [
            ['Fase / Periodo', 'Pension (UF)', 'Pension Bruta ($)', '-7% Salud', 'Liquido ($)', headerUltimaColumna],
            [`Fase Aumentada (1 a ${mesesAumento}m)`, `${pensionAumentadaUF} UF`, `$${formatNumber(pensionAumentada)}`, `-$${formatNumber(descSaludAum)}`, `$${formatNumber(pensionAumentadaLiq)}`, `$${formatNumber(totalUltimaColAum)}`],
            [`Fase Definitiva (Mes ${mesesAumento + 1}+)`, `${pensionBaseUF} UF`, `$${formatNumber(pensionBaseProyectada)}`, `-$${formatNumber(Math.round(pensionBaseProyectada * 0.07))}`, `$${formatNumber(pensionBaseLiqProyectada)}`, `$${formatNumber(totalUltimaColDef)}`]
          ];
          const colWidthsRV = [115, 65, 78, 68, 76, 110];
          y = drawTable(page, tablaRV, 50, y, colWidthsRV, { regular: fontRegular, bold: fontBold });

          y -= 8;
        }

        y -= 5;
        numSeccion++;
      }
    }

    // ========== PENSIÓN DE INVALIDEZ ==========
    if (tipoPension === 'invalidez') {
      const retiroProgramado = resultados.find(r => (r.nombre || '').includes('Retiro Programado') || (r.nombre || '').includes('RP'));
      const rvInmediata = resultados.find(r =>
        ((r.nombre || '').includes('Inmediata') || (r.nombre || '').includes('RV') || (r.nombre || '').includes('Renta Vitalicia')) &&
        !r.periodoGarantizado && !r.aumentoTemporal
      );
      const rvGarantizados = resultados.filter(r =>
        r.periodoGarantizado && r.periodoGarantizado > 0 && !r.aumentoTemporal
      );
      const rvAumentos = resultados.filter(r => r.aumentoTemporal);
      const pensionInvalidez = resultados.find(r => (r.nombre || '').includes('Pension Invalidez'));

      // Información del grado de invalidez
      if (afiliado.gradoInvalidez || pensionInvalidez?.gradoInvalidez) {
        const grado = afiliado.gradoInvalidez || pensionInvalidez?.gradoInvalidez || 'total';
        const ingresoBase = afiliado.ingresoBase || pensionInvalidez?.ingresoBase || 0;

        drawText(page, `Grado de Invalidez: ${GRADO_INVALIDEZ_LABELS[grado] || grado}`, 50, y, { size: 10, font: fontBold });
        y -= 15;
        drawText(page, `Ingreso Base de Referencia: $${formatNumber(ingresoBase)}`, 50, y, { size: 10, font: fontRegular });
        y -= 25;
      }

      // Retiro Programado Invalidez
      if (retiroProgramado) {
        drawText(page, '1. Retiro Programado (Invalidez)', 50, y, {
          size: 11,
          font: fontBold,
          color: { r: 0.122, g: 0.306, b: 0.475 }
        });
        y -= 15;
        drawText(page, `(${afpLabel} - Tabla de mortalidad de invalidos I-H/I-M-2020)`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = retiroProgramado.pensionMensual;
        const pensionUF = retiroProgramado.pensionEnUF.toFixed(2);
        const descuentoAFP = Math.round(pensionBruto * comisionAFP);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoAFP - descuentoSalud;
        const totalUltimaCol = calcularTotalBrutoConBeneficios(pensionBruto);

        const rpData = [
          ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', `Desc. ${comisionAFPPct}%`, 'Dscto. 7% Salud', 'Pension Liquida', headerUltimaColumna],
          ['RP INVALIDEZ', `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoAFP)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`, `$${formatNumber(totalUltimaCol)}`]
        ];
        const colWidths = [95, 58, 72, 62, 68, 70, 87];
        y = drawTable(page, rpData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
      }

      // RV Inmediata Invalidez
      if (rvInmediata) {
        drawText(page, '2. Renta Vitalicia Inmediata (Invalidez)', 50, y, {
          size: 11,
          font: fontBold,
          color: { r: 0.122, g: 0.306, b: 0.475 }
        });
        y -= 15;
        drawText(page, `Tasa: ${(rvInmediata.tasaInteres * 100).toFixed(2)}% - Tabla de invalidos`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = rvInmediata.pensionMensual;
        const pensionUF = rvInmediata.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;
        const totalUltimaCol = calcularTotalBrutoConBeneficios(pensionBruto);

        const rvData = [
          ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida', headerUltimaColumna],
          ['RV INMEDIATA INVALIDEZ', `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`, `$${formatNumber(totalUltimaCol)}`]
        ];
        const colWidths = [115, 65, 78, 68, 76, 110];
        y = drawTable(page, rvData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
      }

      // RV Garantizados
      for (let i = 0; i < rvGarantizados.length; i++) {
        const rv = rvGarantizados[i];
        const num = rvInmediata ? 3 + i : 2 + i;
        const meses = rv.periodoGarantizado || 0;
        const anos = Math.floor(meses / 12);

        drawText(page, `${num}. RV Invalidez con Garantia ${anos} anos`, 50, y, {
          size: 11,
          font: fontBold,
          color: { r: 0.122, g: 0.306, b: 0.475 }
        });
        y -= 20;

        const pensionBruto = rv.pensionMensual;
        const pensionUF = rv.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;
        const totalUltimaCol = calcularTotalBrutoConBeneficios(pensionBruto);

        const rvgData = [
          ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida', headerUltimaColumna],
          [`RV GARANTIA ${anos} ANOS`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`, `$${formatNumber(totalUltimaCol)}`]
        ];
        const colWidths = [115, 65, 78, 68, 76, 110];
        y = drawTable(page, rvgData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
      }

      // RV con Aumento Temporal
      for (let i = 0; i < rvAumentos.length; i++) {
        const rv = rvAumentos[i];
        const baseNum = rvInmediata ? 3 : 2;
        const num = baseNum + rvGarantizados.length + i;
        const meses = rv.aumentoTemporal?.meses || 0;

        drawText(page, `${num}. RV Invalidez con Aumento Temporal`, 50, y, {
          size: 11,
          font: fontBold,
          color: { r: 0.122, g: 0.306, b: 0.475 }
        });
        y -= 15;
        drawText(page, `Aumento ${(rv.aumentoTemporal!.porcentaje > 1 ? rv.aumentoTemporal!.porcentaje : rv.aumentoTemporal!.porcentaje * 100)}% por ${meses} meses`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = rv.pensionMensual;
        const pensionUF = rv.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;
        const totalUltimaColAum = calcularTotalBrutoConBeneficios(pensionBruto);

        const pensionBase = rv.aumentoTemporal?.pensionFinal || pensionBruto;
        const pensionBaseUF = clpAUf(pensionBase, referenciaUF).toFixed(2);
        const descBase = Math.round(pensionBase * 0.07);
        const pensionBaseLiq = pensionBase - descBase;
        const totalUltimaColDef = calcularTotalBrutoConBeneficios(pensionBase);

        const rvaData = [
          ['Fase / Periodo', 'Pension (UF)', 'Pension Bruta ($)', 'Dscto. 7% Salud', 'Pension Liquida', headerUltimaColumna],
          [`Fase Aumentada (1 a ${meses}m)`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`, `$${formatNumber(totalUltimaColAum)}`],
          [`Fase Definitiva (Desde mes ${meses + 1})`, `${pensionBaseUF} UF`, `$${formatNumber(pensionBase)}`, `-$${formatNumber(descBase)}`, `$${formatNumber(pensionBaseLiq)}`, `$${formatNumber(totalUltimaColDef)}`]
        ];
        const colWidths = [115, 65, 78, 68, 76, 110];
        y = drawTable(page, rvaData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
      }

      // Pensión de Invalidez básica (si no hay escenarios RV)
      if (pensionInvalidez && resultados.length === 1) {
        const num = retiroProgramado ? 2 : 1;
        drawText(page, `${num}. Pension de Invalidez`, 50, y, {
          size: 11,
          font: fontBold,
          color: { r: 0.122, g: 0.306, b: 0.475 }
        });
        y -= 15;

        const grado = pensionInvalidez.gradoInvalidez || 'total';
        drawText(page, `Grado: ${GRADO_INVALIDEZ_LABELS[grado]} - Tasa: ${(pensionInvalidez.tasaInteres * 100).toFixed(2)}%`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = pensionInvalidez.pensionMensual;
        const pensionUF = pensionInvalidez.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;
        const totalUltimaCol = calcularTotalBrutoConBeneficios(pensionBruto);

        const invData = [
          ['Grado', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida', headerUltimaColumna],
          [GRADO_INVALIDEZ_LABELS[grado] || grado, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`, `$${formatNumber(totalUltimaCol)}`]
        ];
        const colWidths = [115, 65, 78, 68, 76, 110];
        y = drawTable(page, invData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });

        // Advertencias
        if (pensionInvalidez.advertencias && pensionInvalidez.advertencias.length > 0) {
          y -= 5;
          for (const adv of pensionInvalidez.advertencias) {
            if (y < 100) break;
            drawText(page, `- ${adv}`, 50, y, { size: 8, font: fontRegular, color: { r: 0.4, g: 0.4, b: 0.4 } });
            y -= 12;
          }
        }
      }
    }

    // ========== PENSIÓN DE SOBREVIVENCIA ==========
    if (tipoPension === 'sobrevivencia') {
      // Listar beneficiarios
      if (beneficiarios && beneficiarios.length > 0) {
        drawText(page, 'Beneficiarios:', 50, y, { size: 10, font: fontBold });
        y -= 15;

        for (const ben of beneficiarios) {
          if (y < 100) break;
          const tipoLabel = TIPO_BENEFICIARIO_LABELS[ben.tipo] || ben.tipo;
          drawText(page, `- ${tipoLabel}: ${ben.edad} anos, ${(ben.porcentajePension * 100).toFixed(0)}% de pension`, 60, y, { size: 9, font: fontRegular });
          y -= 12;
        }
        y -= 10;
      }

      // Mostrar resultados
      let contador = 1;
      for (const resultado of resultados) {
        if (y < 150) {
          nuevaPagina();
        }

        const pensionBruto = resultado.pensionMensual;
        const pensionUF = resultado.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;

        const nombreModalidad = resultado.nombre || 'Modalidad';
        drawText(page, `${contador}. ${nombreModalidad}`, 50, y, {
          size: 11,
          font: fontBold,
          color: { r: 0.122, g: 0.306, b: 0.475 }
        });
        y -= 20;

        let sobData: string[][];
        let colWidths: number[];

        if (resultado.aumentoTemporal && resultado.aumentoTemporal.meses > 0) {
          const meses = resultado.aumentoTemporal.meses;
          const pensionBase = resultado.aumentoTemporal.pensionFinal;
          const pensionBaseUF = clpAUf(pensionBase, referenciaUF).toFixed(2);
          const descBase = Math.round(pensionBase * 0.07);
          const pensionBaseLiq = pensionBase - descBase;

          sobData = [
            ['Fase / Periodo', 'Pension (UF)', 'Pension Base ($)', 'Dscto. 7% Salud', 'Pension Liquida'],
            [`Fase Aumentada (1 a ${meses}m)`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`],
            [`Fase Definitiva (Mes ${meses + 1}+)`, `${pensionBaseUF} UF`, `$${formatNumber(pensionBase)}`, `-$${formatNumber(descBase)}`, `$${formatNumber(pensionBaseLiq)}`]
          ];
          colWidths = [140, 70, 95, 85, 90];
        } else {
          sobData = [
            ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida'],
            [nombreModalidad.substring(0, 25), `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
          ];
          colWidths = [130, 70, 100, 90, 90];
        }
        y = drawTable(page, sobData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });

        // Pensión por beneficiario
        if (resultado.pensionPorBeneficiario && resultado.pensionPorBeneficiario.length > 0) {
          y -= 5;
          drawText(page, 'Distribucion por Beneficiario:', 50, y, { size: 9, font: fontBold });
          y -= 15;

          const benData = [
            ['Beneficiario', 'Porcentaje', 'Pension Mensual'],
            ...resultado.pensionPorBeneficiario.map(b => [
              TIPO_BENEFICIARIO_LABELS[b.tipo] || b.tipo,
              `${(b.porcentaje * 100).toFixed(0)}%`,
              `$${formatNumber(b.pensionMensual)}`
            ])
          ];
          const colWidthsBen = [120, 80, 120];
          y = drawTable(page, benData, 60, y, colWidthsBen, { regular: fontRegular, bold: fontBold });
        }

        contador++;
      }
    }

    const reglas = resultados.find(r => r.reglasSobrevivencia?.length)?.reglasSobrevivencia;
    if (reglas?.length) {
      if (y < 140 + reglas.length * 22) nuevaPagina();
      drawText(page, 'Porcentajes de referencia (art.58): sujetos a requisitos y vinculos acreditados.', 50, y, { size: 8, font: fontBold });
      y -= 14;
      drawText(page, 'La base de referencia del causante es distinta de la base financiable del modelo.', 50, y, { size: 8, font: fontRegular });
      y -= 18;
      for (let inicio = 0; inicio < reglas.length; inicio += 20) {
        if (inicio) nuevaPagina();
        const rows = [['Persona', 'Regla base', 'Incremento', 'Utilizado', 'Part. familiar'], ...reglas.slice(inicio, inicio + 20).map(b => [
          b.tipo, `${(b.porcentajeLegal * 100).toFixed(2)}%`, `${(b.incrementoLegal * 100).toFixed(2)}%`, `${(b.porcentaje * 100).toFixed(2)}%`, `${(b.participacionFamiliar * 100).toFixed(2)}%`
        ])];
        y = drawTable(page, rows, 50, y, [135, 85, 85, 85, 110], { regular: fontRegular, bold: fontBold });
      }
      drawText(page, 'Los porcentajes manuales y casos sin datos completos no acreditan un derecho legal.', 50, y, { size: 8, font: fontRegular });
      y -= 15;
    }

    // Notas finales
    y = Math.min(y, 100);
    if (y < 90) { nuevaPagina(); y = 100; }
    drawText(page, 'NOTA: VALORES ESTIMATIVOS NO CONSTITUYEN UNA OFERTA FORMAL DE PENSION.', 50, y, { size: 7, font: fontRegular });
    y -= 12;
    drawText(page, 'LA PGU SE SOLICITA A LOS 65 ANOS, REQUISITO TENER REGISTRO SOCIAL DE HOGARES.', 50, y, { size: 7, font: fontRegular });
    y -= 12;
    drawText(page, 'BONIFICACION POR ANO COTIZADO: 0.1 UF POR ANO COTIZADO.', 50, y, { size: 7, font: fontRegular });

    if (tipoPension === 'invalidez') {
      y -= 12;
      drawText(page, 'PENSION DE INVALIDEZ: REQUIERE DICTAMEN DE COMISION MEDICA.', 50, y, { size: 7, font: fontRegular });
    }

    if (tipoPension === 'sobrevivencia') {
      y -= 12;
      drawText(page, 'PENSION DE SOBREVIVENCIA: PORCENTAJES SEGUN ART. 58 DL 3500.', 50, y, { size: 7, font: fontRegular });
    }

    for (const pagina of pdfDoc.getPages()) {
      drawText(pagina, 'TM-2020 cotejada con SP/CMF. CNU anual y complemento mensual estimativos; sin certificacion.', 50, 29, { size: 6, font: fontRegular });
      drawText(pagina, 'Orientacion independiente. Sin conexion con SCOMP. No es oferta de AFP o aseguradora.', 50, 18, { size: 7, font: fontRegular });
    }

    if (tipoPension === 'sobrevivencia') {
      for (const pagina of pdfDoc.getPages()) drawText(pagina, 'RV: cuotas iniciales ilustrativas; revisar cambios de derecho y acrecimientos futuros.', 50, 40, { size: 7, font: fontRegular });
    }

    // Guardar PDF
    const pdfBytes = await pdfDoc.save();

    return pdfBytes;
}
