import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface AfiliadoData {
  nombre: string;
  sexo: string;
  edad: number;
  fondosAcumulados: number;
  anosCotizados: number;
  tipoPension?: 'vejez' | 'invalidez' | 'sobrevivencia';
  gradoInvalidez?: string;
  ingresoBase?: number;
}

interface ParametrosData {
  uf: number;
  tasaRP: number;
  tasaRV: number;
  incluirPGU?: boolean;
  incluirBAC?: boolean;
  mesesAdicionalesBAC?: number;
  afpSeleccionada?: string;
}

// Constantes actualizadas
const PGU_MONTO = 231732;  // Actualizado enero 2025
const PGU_TOPE = 1054000;  // Tope de ingreso para PGU
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
  nombre: string;
  pensionMensual: number;
  pensionEnUF: number;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { afiliado, parametros, resultados, beneficiarios } = body as {
      afiliado: AfiliadoData;
      parametros: ParametrosData;
      resultados: ResultadoData[];
      beneficiarios: BeneficiarioData[];
    };

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
    const fondosUF = Math.round(afiliado.fondosAcumulados / parametros.uf);

    drawText(page, `Valor UF Utilizado: $${formatNumber(parametros.uf)}`, 50, y, { size: 10, font: fontRegular });
    y -= 15;
    drawText(page, `Edad: ${afiliado.edad} anos`, 50, y, { size: 10, font: fontRegular });
    y -= 15;
    drawText(page, `Tipo de Pension: ${TIPO_PENSION_LABELS[tipoPension]}`, 50, y, { size: 10, font: fontRegular });
    y -= 15;
    drawText(page, `Saldo Acumulado (Bruto): ${fondosUF} UF`, 50, y, { size: 10, font: fontRegular });
    y -= 20;

    // ========== PENSIÓN DE VEJEZ ==========
    if (tipoPension === 'vejez') {
      // Clasificar resultados por tipo usando propiedades del objeto
      const retiroProgramado = resultados.find(r => r.nombre.includes('Retiro Programado'));
      
      // RV Inmediata: sin período garantizado ni aumento temporal
      const rvInmediata = resultados.find(r => 
        (r.nombre.includes('Inmediata') || r.nombre.includes('RV') || r.nombre.includes('Renta Vitalicia')) && 
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

      // Obtener comisión AFP seleccionada
      const afpSeleccionada = parametros.afpSeleccionada || 'HABITAT';
      const comisionAFP = COMISIONES_AFP[afpSeleccionada] ?? 0.0095;
      const comisionAFPPct = (comisionAFP * 100).toFixed(2).replace('.', ',');
      const afpLabel = AFP_LABELS[afpSeleccionada] || 'AFP Habitat (0,95%)';

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

        const rpData = [
          ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', `Desc. ${comisionAFPPct}%`, 'Dscto. 7% Salud', 'Pension Liquida'],
          ['RETIRO PROGRAMADO', `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoAFP)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
        ];
        const colWidths = [110, 70, 90, 70, 80, 85];
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
        drawText(page, `Calculo RVI: Tasa de Venta: Media Mercado (Vejez: ${tasaRVPct}%)`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = rvInmediata.pensionMensual;
        const pensionUF = rvInmediata.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;
        const pguMonto = 231732;
        const pensionConPGU = pensionLiquida + pguMonto;

        const rviData = [
          ['Modalidad', 'Tasa (%)', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida'],
          ['RVI SIMPLE (Media Mercado)', `${tasaRVPct}%`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`],
          ['Pension + PGU ($231.732)', '', '', '', '', `$${formatNumber(pensionConPGU)}`]
        ];
        const colWidths = [120, 55, 70, 85, 75, 85];
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
        const pguMonto = 231732;
        const pensionConPGU = pensionLiquida + pguMonto;
        const tasa = (rv.tasaInteres * 100).toFixed(2);

        const rvgData = [
          ['Modalidad', 'Tasa (%)', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida'],
          [`RV GARANTIA ${meses} MESES`, `${tasa}%`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`],
          ['Pension + PGU ($231.732)', '', '', '', '', `$${formatNumber(pensionConPGU)}`]
        ];
        const colWidths = [120, 55, 70, 85, 75, 85];
        y = drawTable(page, rvgData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
        y -= 10;
        numSeccion++;
      }

      // 4. RV con Aumento Temporal - Cada escenario con su propia tabla
      for (const rv of rvConAumento) {
        // Verificar si necesitamos nueva página
        if (y < 180) {
          nuevaPagina();
        }

        const mesesAumento = rv.aumentoTemporal?.meses || 0;
        const porcentajeAumento = rv.aumentoTemporal?.porcentaje || 0;
        const porcentajeTxt = porcentajeAumento > 1 ? porcentajeAumento : porcentajeAumento * 100;
        
        const tieneGarantia = rv.periodoGarantizado && rv.periodoGarantizado > 0;
        const mesesGarantia = rv.periodoGarantizado || 0;

        // Título principal
        drawText(page, `${numSeccion}. RENTA VITALICIA AUMENTADA ${mesesAumento} MESES AL ${porcentajeTxt}%`, 50, y, { 
          size: 11, 
          font: fontBold, 
          color: { r: 0.122, g: 0.306, b: 0.475 } 
        });
        y -= 14;

        // Subtítulo
        let subtitulo = `Aumento ${porcentajeTxt}% por ${mesesAumento} meses`;
        if (tieneGarantia) {
          subtitulo += ` + Garantizado ${mesesGarantia} meses`;
        }
        drawText(page, subtitulo, 50, y, { size: 9, font: fontRegular, color: { r: 0.3, g: 0.3, b: 0.3 } });
        y -= 18;

        // Cálculos para DURANTE el período de aumento
        const pensionAumentada = rv.pensionMensual;
        const pensionAumentadaUF = rv.pensionEnUF.toFixed(2);
        const descSaludAum = Math.round(pensionAumentada * 0.07);
        const pensionAumentadaLiq = pensionAumentada - descSaludAum;
        const pensionAumConPGU = pensionAumentadaLiq + 231732;

        // Cálculos para DESPUÉS del período de aumento
        const pensionBase = rv.aumentoTemporal?.pensionFinal || pensionAumentada;
        const pensionBaseUF = (pensionBase / parametros.uf).toFixed(2);
        const descSaludBase = Math.round(pensionBase * 0.07);
        const pensionBaseLiq = pensionBase - descSaludBase;
        const pensionBaseConPGU = pensionBaseLiq + 231732;

        // Tabla con dos períodos
        const tablaRV = [
          ['Periodo', 'Pension (UF)', 'Bruto', '-7% Salud', 'Liquido', '+ PGU'],
          [`Primeros ${mesesAumento} meses`, `${pensionAumentadaUF} UF`, `$${formatNumber(pensionAumentada)}`, `-$${formatNumber(descSaludAum)}`, `$${formatNumber(pensionAumentadaLiq)}`, `$${formatNumber(pensionAumConPGU)}`],
          [`Desde el mes ${mesesAumento + 1}`, `${pensionBaseUF} UF`, `$${formatNumber(pensionBase)}`, `-$${formatNumber(descSaludBase)}`, `$${formatNumber(pensionBaseLiq)}`, `$${formatNumber(pensionBaseConPGU)}`]
        ];
        const colWidthsRV = [110, 70, 75, 70, 75, 80];
        y = drawTable(page, tablaRV, 50, y, colWidthsRV, { regular: fontRegular, bold: fontBold });
        y -= 10;

        numSeccion++;
      }
    }

    // ========== PENSIÓN DE INVALIDEZ ==========
    if (tipoPension === 'invalidez') {
      const retiroProgramado = resultados.find(r => r.nombre.includes('Retiro Programado'));
      const rvInmediata = resultados.find(r => r.nombre.includes('RV Inmediata') && r.nombre.includes('Invalidez'));
      const rvGarantizados = resultados.filter(r => r.nombre.includes('RV Invalidez Garantia'));
      const rvAumentos = resultados.filter(r => r.nombre.includes('RV Invalidez +') && r.nombre.includes('x'));
      const pensionInvalidez = resultados.find(r => r.nombre.includes('Pension Invalidez'));

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

        const rpData = [
          ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', `Desc. ${comisionAFPPct}%`, 'Dscto. 7% Salud', 'Pension Liquida'],
          ['RP INVALIDEZ', `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoAFP)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
        ];
        const colWidths = [110, 70, 90, 70, 80, 85];
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

        const rvData = [
          ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida'],
          ['RV INMEDIATA INVALIDEZ', `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
        ];
        const colWidths = [130, 80, 100, 90, 100];
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

        const rvgData = [
          ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida'],
          [`RV GARANTIA ${anos} ANOS`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
        ];
        const colWidths = [130, 80, 100, 90, 100];
        y = drawTable(page, rvgData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
      }

      // RV con Aumento Temporal
      for (let i = 0; i < rvAumentos.length; i++) {
        const rv = rvAumentos[i];
        const baseNum = rvInmediata ? 3 : 2;
        const num = baseNum + rvGarantizados.length + i;
        const meses = rv.aumentoTemporal?.meses || 0;
        const anosAumento = Math.floor(meses / 12);

        drawText(page, `${num}. RV Invalidez con Aumento Temporal`, 50, y, { 
          size: 11, 
          font: fontBold, 
          color: { r: 0.122, g: 0.306, b: 0.475 } 
        });
        y -= 15;
        drawText(page, `Aumento ${rv.aumentoTemporal?.porcentaje || 0}% por ${anosAumento} anos`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = rv.pensionMensual;
        const pensionUF = rv.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;

        const pensionBase = rv.aumentoTemporal?.pensionFinal || pensionBruto;
        const pensionBaseUF = (pensionBase / 38500).toFixed(2);
        const descBase = Math.round(pensionBase * 0.07);
        const pensionBaseLiq = pensionBase - descBase;

        const rvaData = [
          ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida'],
          [`RV AUMENTADA ${meses} MESES`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`],
          [`PENSION BASE (desde mes ${meses + 1})`, `${pensionBaseUF} UF`, `$${formatNumber(pensionBase)}`, `-$${formatNumber(descBase)}`, `$${formatNumber(pensionBaseLiq)}`]
        ];
        const colWidths = [140, 70, 100, 90, 100];
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

        const invData = [
          ['Grado', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida'],
          [GRADO_INVALIDEZ_LABELS[grado] || grado, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
        ];
        const colWidths = [100, 80, 100, 90, 100];
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

        drawText(page, `${contador}. ${resultado.nombre}`, 50, y, { 
          size: 11, 
          font: fontBold, 
          color: { r: 0.122, g: 0.306, b: 0.475 } 
        });
        y -= 20;

        const sobData = [
          ['Modalidad', 'Pension (UF)', 'Pension M. Bruto', 'Dscto. 7% Salud', 'Pension Liquida'],
          [resultado.nombre.substring(0, 25), `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
        ];
        const colWidths = [130, 70, 100, 90, 90];
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

    // ========== BENEFICIOS ADICIONALES (PGU y BAC) ==========
    // Obtener parámetros de beneficios adicionales del body
    const incluirPGU = body.incluirPGU || false;
    const incluirBAC = body.incluirBAC || false;
    const mesesAdicionalesBAC = body.mesesAdicionalesBAC || 0;

    // Obtener la pensión más alta para cálculos
    const mejorPension = resultados.length > 0 
      ? Math.max(...resultados.map(r => r.pensionMensual)) 
      : 0;

    // Variables para almacenar montos calculados
    let pguMonto = 0;
    let pguAplica = false;
    let bacUF = 0;
    let bacPesos = 0;

    // ===== PGU - Pensión Garantizada Universal =====
    if (incluirPGU) {
      if (y < 150) {
        nuevaPagina();
      }

      y -= 10;
      drawText(page, '==============================================', 50, y, { size: 10, font: fontBold });
      y -= 15;
      drawText(page, 'PGU - PENSION GARANTIZADA UNIVERSAL', 50, y, { 
        size: 12, 
        font: fontBold, 
        color: { r: 0.102, g: 0.212, b: 0.365 } 
      });
      y -= 20;

      drawText(page, `Monto Base 2025: $${formatNumber(PGU_MONTO)}/mes`, 50, y, { size: 9, font: fontRegular });
      y -= 12;
      drawText(page, `Tope de Ingreso: $${formatNumber(PGU_TOPE)}/mes`, 50, y, { size: 9, font: fontRegular });
      y -= 15;

      // Calcular PGU
      if (afiliado.edad >= 65 && mejorPension < PGU_TOPE) {
        pguAplica = true;
        const factor = mejorPension / PGU_TOPE;
        pguMonto = Math.round(PGU_MONTO * (1 - factor));
        
        drawText(page, `Factor de descuento: ${(factor * 100).toFixed(2)}%`, 50, y, { size: 9, font: fontRegular, color: { r: 0.4, g: 0.4, b: 0.4 } });
        y -= 12;
        drawText(page, `Calculo: $${formatNumber(PGU_MONTO)} x (1 - ${(factor * 100).toFixed(2)}%)`, 50, y, { size: 8, font: fontRegular, color: { r: 0.5, g: 0.5, b: 0.5 } });
        y -= 15;
        
        const pguData = [
          ['Concepto', 'Monto Mensual'],
          ['PGU Aplicable', `$${formatNumber(pguMonto)}`]
        ];
        const colWidthsPGU = [300, 150];
        y = drawTable(page, pguData, 50, y, colWidthsPGU, { regular: fontRegular, bold: fontBold });
      } else {
        if (afiliado.edad < 65) {
          drawText(page, 'No aplica: Requiere 65 anos de edad o mas', 50, y, { 
            size: 9, font: fontRegular, color: { r: 0.7, g: 0.3, b: 0.3 } 
          });
          y -= 12;
        }
        if (mejorPension >= PGU_TOPE) {
          drawText(page, `No aplica: Pension ($${formatNumber(mejorPension)}) supera tope de $${formatNumber(PGU_TOPE)}`, 50, y, { 
            size: 9, font: fontRegular, color: { r: 0.7, g: 0.3, b: 0.3 } 
          });
          y -= 12;
        }
      }
      y -= 10;
    }

    // ===== BAC - Bono por Años Cotizados =====
    if (incluirBAC) {
      if (y < 180) {
        nuevaPagina();
      }

      y -= 10;
      drawText(page, '==============================================', 50, y, { size: 10, font: fontBold });
      y -= 15;
      drawText(page, 'BAC - BONO POR ANOS COTIZADOS', 50, y, { 
        size: 12, 
        font: fontBold, 
        color: { r: 0.1, g: 0.4, b: 0.2 } 
      });
      y -= 20;
      
      const anosTotalesBAC = afiliado.anosCotizados + (mesesAdicionalesBAC / 12);
      bacUF = anosTotalesBAC * BAC_UF_POR_ANO;
      const topeAplicado = bacUF > BAC_TOPE_UF;
      
      if (topeAplicado) {
        bacUF = BAC_TOPE_UF;
      }
      
      bacPesos = Math.round(bacUF * parametros.uf);
      
      drawText(page, `Anos cotizados: ${afiliado.anosCotizados} anos`, 50, y, { size: 9, font: fontRegular });
      y -= 12;
      if (mesesAdicionalesBAC > 0) {
        drawText(page, `Meses adicionales: ${mesesAdicionalesBAC} meses (${(mesesAdicionalesBAC/12).toFixed(2)} anos)`, 50, y, { size: 9, font: fontRegular });
        y -= 12;
      }
      drawText(page, `Total anos: ${anosTotalesBAC.toFixed(2)} anos`, 50, y, { size: 9, font: fontRegular, color: { r: 0.2, g: 0.4, b: 0.6 } });
      y -= 12;
      drawText(page, `Calculo: ${anosTotalesBAC.toFixed(2)} anos x 0,1 UF/ano = ${bacUF.toFixed(2)} UF`, 50, y, { 
        size: 8, font: fontRegular, color: { r: 0.5, g: 0.5, b: 0.5 } 
      });
      y -= 15;

      if (topeAplicado) {
        drawText(page, '(Tope maximo de 2,5 UF aplicado)', 50, y, { 
          size: 8, font: fontRegular, color: { r: 0.7, g: 0.4, b: 0.2 } 
        });
        y -= 12;
      }

      const bacData = [
        ['Concepto', 'Valor UF', 'Monto Mensual'],
        ['BAC Aplicable', `${bacUF.toFixed(2)} UF`, `$${formatNumber(bacPesos)}`]
      ];
      const colWidthsBAC = [200, 100, 150];
      y = drawTable(page, bacData, 50, y, colWidthsBAC, { regular: fontRegular, bold: fontBold });
      y -= 15;

      drawText(page, 'NOTA: El BAC se devenga desde el 1 de enero de 2026.', 50, y, { 
        size: 7, font: fontRegular, color: { r: 0.4, g: 0.4, b: 0.4 } 
      });
      y -= 10;
    }

    // ===== RESUMEN TOTAL (si alguno aplica) =====
    if (incluirPGU || incluirBAC) {
      if (pguAplica || bacPesos > 0) {
        if (y < 100) {
          nuevaPagina();
        }

        const totalBeneficios = pguMonto + bacPesos;
        const pensionTotalConBeneficios = mejorPension + totalBeneficios;

        y -= 10;
        page.drawRectangle({
          x: 50,
          y: y - 5,
          width: 500,
          height: 50,
          color: rgb(0.95, 0.98, 0.95),
          borderColor: rgb(0.2, 0.5, 0.2),
          borderWidth: 1,
        });
        y += 40;
        
        drawText(page, 'RESUMEN TOTAL CON BENEFICIOS ADICIONALES', 60, y, { 
          size: 9, font: fontBold, color: { r: 0.1, g: 0.35, b: 0.15 } 
        });
        y -= 12;
        drawText(page, `Pension Base: $${formatNumber(mejorPension)}  |  PGU: $${formatNumber(pguMonto)}  |  BAC: $${formatNumber(bacPesos)}`, 60, y, { 
          size: 8, font: fontRegular 
        });
        y -= 12;
        drawText(page, `TOTAL MENSUAL CON BENEFICIOS: $${formatNumber(pensionTotalConBeneficios)}`, 60, y, { 
          size: 10, font: fontBold, color: { r: 0.1, g: 0.35, b: 0.15 } 
        });
        y -= 20;
      }
    }

    // Notas finales
    y = Math.min(y, 100);
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

    // Guardar PDF
    const pdfBytes = await pdfDoc.save();

    // Nombre del archivo
    const nombreLimpio = nombreAfiliado
      .replace(/[^A-Z\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
    const tipoSuffix = tipoPension === 'vejez' ? '' : `_${tipoPension}`;
    const filename = `Estudio${tipoSuffix}_${nombreLimpio}.pdf`;

    // Retornar el PDF
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error generando reporte:', error);
    return NextResponse.json(
      { success: false, error: `Error al generar el reporte PDF: ${error instanceof Error ? error.message : 'Error desconocido'}` },
      { status: 500 }
    );
  }
}
