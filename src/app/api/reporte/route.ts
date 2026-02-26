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
  conyuge: 'Cónyuge',
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
    const page = pdfDoc.addPage([612, 792]); // Letter size
    
    // Fuentes
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 750;

    // Determinar tipo de pensión
    const tipoPension = afiliado.tipoPension || 'vejez';

    // Título según tipo de pensión
    const tituloPension = tipoPension === 'invalidez' 
      ? 'ESTUDIO PRELIMINAR DE PENSIÓN DE INVALIDEZ'
      : tipoPension === 'sobrevivencia'
      ? 'ESTUDIO PRELIMINAR DE PENSIÓN DE SOBREVIVENCIA'
      : 'ESTUDIO PRELIMINAR DE PENSIÓN';

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
    const edadJubilacion = afiliado.sexo === 'M' ? 65 : 60;

    drawText(page, `Valor UF Utilizado: $${formatNumber(parametros.uf)}`, 50, y, { size: 10, font: fontRegular });
    y -= 15;
    drawText(page, `Edad: ${afiliado.edad} años`, 50, y, { size: 10, font: fontRegular });
    y -= 15;
    drawText(page, `Tipo de Pensión: ${TIPO_PENSION_LABELS[tipoPension]}`, 50, y, { size: 10, font: fontRegular });
    y -= 15;
    drawText(page, `Saldo Acumulado (Bruto): ${fondosUF} UF`, 50, y, { size: 10, font: fontRegular });
    y -= 20;

    // ========== PENSIÓN DE VEJEZ ==========
    if (tipoPension === 'vejez') {
      // Separar resultados por tipo
      const retiroProgramado = resultados.find(r => r.nombre.includes('Retiro Programado'));
      const rvInmediata = resultados.find(r => r.nombre.includes('Inmediata') && !r.nombre.includes('Aumento'));
      const rvConAumento = resultados.filter(r => r.nombre.includes('Aumento'));
      const rvConGarantia = resultados.filter(r => r.nombre.includes('Garant') && !r.nombre.includes('Aumento'));

      // 1. Retiro Programado
      if (retiroProgramado) {
        drawText(page, '1. Retiro Programado', 50, y, { 
          size: 11, 
          font: fontBold, 
          color: { r: 0.122, g: 0.306, b: 0.475 } 
        });
        y -= 15;
        drawText(page, '(AFP HABITAT - 0.95%)', 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = retiroProgramado.pensionMensual;
        const pensionUF = retiroProgramado.pensionEnUF.toFixed(2);
        const descuentoAFP = Math.round(pensionBruto * 0.0095);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoAFP - descuentoSalud;

        const rpData = [
          ['Modalidad', 'Pensión (UF)', 'Pensión M. Bruto', 'Desc. 0.95%', 'Dscto. 7% Salud', 'Pensión Líquida'],
          ['RETIRO PROGRAMADO', `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoAFP)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
        ];
        const colWidths = [110, 70, 90, 70, 80, 85];
        y = drawTable(page, rpData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
      }

      // 2. RV Inmediata
      if (rvInmediata) {
        drawText(page, '2. Renta Vitalicia Inmediata (Simple y Garantizada)', 50, y, { 
          size: 11, 
          font: fontBold, 
          color: { r: 0.122, g: 0.306, b: 0.475 } 
        });
        y -= 15;
        const tasaRVPct = (parametros.tasaRV * 100).toFixed(2);
        drawText(page, `Cálculo RVI: Tasa de Venta: Media Mercado (Vejez: ${tasaRVPct}%)`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = rvInmediata.pensionMensual;
        const pensionUF = rvInmediata.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;
        const pguMonto = 224004;
        const pensionConPGU = pensionLiquida + pguMonto;

        const rviData = [
          ['Modalidad', 'Tasa (%)', 'Pensión (UF)', 'Pensión M. Bruto', 'Dscto. 7% Salud', 'Pensión Líquida'],
          ['RVI SIMPLE (Media Mercado)', `${tasaRVPct}%`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`],
          ['Pensión + PGU ($224.004)', '', '', '', '', `$${formatNumber(pensionConPGU)}`]
        ];
        const colWidths = [120, 55, 70, 85, 75, 85];
        y = drawTable(page, rviData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
      }

      // RV con Garantía
      for (const rv of rvConGarantia) {
        const pensionBruto = rv.pensionMensual;
        const pensionUF = rv.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;
        const pguMonto = 224004;
        const pensionConPGU = pensionLiquida + pguMonto;
        const meses = rv.periodoGarantizado || 0;
        const anos = Math.floor(meses / 12);
        const tasa = (rv.tasaInteres * 100).toFixed(2);

        const rvgData = [
          ['Modalidad', 'Tasa (%)', 'Pensión (UF)', 'Pensión M. Bruto', 'Dscto. 7% Salud', 'Pensión Líquida'],
          [`RV GARANTIZADA ${anos} años`, `${tasa}%`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`],
          ['Pensión + PGU ($224.004)', '', '', '', '', `$${formatNumber(pensionConPGU)}`]
        ];
        const colWidths = [120, 55, 70, 85, 75, 85];
        y = drawTable(page, rvgData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
      }

      // 3. RV con Aumento
      if (rvConAumento.length > 0) {
        drawText(page, '3. Renta Vitalicia con Aumento Temporal', 50, y, { 
          size: 11, 
          font: fontBold, 
          color: { r: 0.122, g: 0.306, b: 0.475 } 
        });
        y -= 20;

        for (const rv of rvConAumento) {
          const pensionBruto = rv.pensionMensual;
          const pensionUF = rv.pensionEnUF.toFixed(2);
          const descuentoSalud = Math.round(pensionBruto * 0.07);
          const pensionLiquida = pensionBruto - descuentoSalud;
          const pguMonto = 224004;
          const pensionConPGU = pensionLiquida + pguMonto;

          if (rv.aumentoTemporal) {
            const meses = rv.aumentoTemporal.meses;
            const pensionBase = rv.aumentoTemporal.pensionFinal;
            const pensionBaseUF = (pensionBase / 38500).toFixed(2);
            const descBase = Math.round(pensionBase * 0.07);
            const pensionBaseLiq = pensionBase - descBase;
            const pensionBaseConPGU = pensionBaseLiq + pguMonto;
            const garantia = rv.periodoGarantizado || 0;

            const rvaData = [
              ['Modalidad', 'Pensión (UF)', 'Pensión M. Bruto', 'Dscto. 7% Salud', 'Pensión Líquida'],
              [`R.V. Aumentado ${meses} meses - Garantizado ${garantia} meses.`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`],
              ['Pensión + PGU ($224.004)', '', '', '', `$${formatNumber(pensionConPGU)}`],
              [`- P. BASE (desde mes ${meses + 1})`, `${pensionBaseUF} UF`, `$${formatNumber(pensionBase)}`, `-$${formatNumber(descBase)}`, `$${formatNumber(pensionBaseLiq)}`],
              ['Pensión + PGU ($224.004)', '', '', '', `$${formatNumber(pensionBaseConPGU)}`]
            ];
            const colWidths = [160, 70, 85, 80, 85];
            y = drawTable(page, rvaData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
          }
        }
      }
    }

    // ========== PENSIÓN DE INVALIDEZ ==========
    if (tipoPension === 'invalidez') {
      const retiroProgramado = resultados.find(r => r.nombre.includes('Retiro Programado'));
      const rvInmediata = resultados.find(r => r.nombre.includes('RV Inmediata') && r.nombre.includes('Invalidez'));
      const rvGarantizados = resultados.filter(r => r.nombre.includes('RV Invalidez Garantía'));
      const rvAumentos = resultados.filter(r => r.nombre.includes('RV Invalidez +') && r.nombre.includes('x'));
      const pensionInvalidez = resultados.find(r => r.nombre.includes('Pensión Invalidez'));

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
        drawText(page, '(Usa tabla de mortalidad de inválidos I-H/I-M-2020)', 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = retiroProgramado.pensionMensual;
        const pensionUF = retiroProgramado.pensionEnUF.toFixed(2);
        const descuentoAFP = Math.round(pensionBruto * 0.0095);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoAFP - descuentoSalud;

        const rpData = [
          ['Modalidad', 'Pensión (UF)', 'Pensión M. Bruto', 'Desc. 0.95%', 'Dscto. 7% Salud', 'Pensión Líquida'],
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
        drawText(page, `Tasa: ${(rvInmediata.tasaInteres * 100).toFixed(2)}% - Tabla de inválidos`, 50, y, { size: 9, font: fontRegular });
        y -= 20;

        const pensionBruto = rvInmediata.pensionMensual;
        const pensionUF = rvInmediata.pensionEnUF.toFixed(2);
        const descuentoSalud = Math.round(pensionBruto * 0.07);
        const pensionLiquida = pensionBruto - descuentoSalud;

        const rvData = [
          ['Modalidad', 'Pensión (UF)', 'Pensión M. Bruto', 'Dscto. 7% Salud', 'Pensión Líquida'],
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

        drawText(page, `${num}. RV Invalidez con Garantía ${anos} años`, 50, y, { 
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
          ['Modalidad', 'Pensión (UF)', 'Pensión M. Bruto', 'Dscto. 7% Salud', 'Pensión Líquida'],
          [`RV GARANTÍA ${anos} AÑOS`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
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
        drawText(page, `Aumento ${rv.aumentoTemporal?.porcentaje || 0}% por ${anosAumento} años`, 50, y, { size: 9, font: fontRegular });
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
          ['Modalidad', 'Pensión (UF)', 'Pensión M. Bruto', 'Dscto. 7% Salud', 'Pensión Líquida'],
          [`RV AUMENTADA ${meses} MESES`, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`],
          [`PENSIÓN BASE (desde mes ${meses + 1})`, `${pensionBaseUF} UF`, `$${formatNumber(pensionBase)}`, `-$${formatNumber(descBase)}`, `$${formatNumber(pensionBaseLiq)}`]
        ];
        const colWidths = [140, 70, 100, 90, 100];
        y = drawTable(page, rvaData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });
      }

      // Pensión de Invalidez básica (si no hay escenarios RV)
      if (pensionInvalidez && resultados.length === 1) {
        const num = retiroProgramado ? 2 : 1;
        drawText(page, `${num}. Pensión de Invalidez`, 50, y, { 
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
          ['Grado', 'Pensión (UF)', 'Pensión M. Bruto', 'Dscto. 7% Salud', 'Pensión Líquida'],
          [GRADO_INVALIDEZ_LABELS[grado] || grado, `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
        ];
        const colWidths = [100, 80, 100, 90, 100];
        y = drawTable(page, invData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });

        // Advertencias
        if (pensionInvalidez.advertencias && pensionInvalidez.advertencias.length > 0) {
          y -= 5;
          for (const adv of pensionInvalidez.advertencias) {
            if (y < 100) break;
            drawText(page, `• ${adv}`, 50, y, { size: 8, font: fontRegular, color: { r: 0.4, g: 0.4, b: 0.4 } });
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
          drawText(page, `• ${tipoLabel}: ${ben.edad} años, ${(ben.porcentajePension * 100).toFixed(0)}% de pensión`, 60, y, { size: 9, font: fontRegular });
          y -= 12;
        }
        y -= 10;
      }

      // Mostrar resultados
      let contador = 1;
      for (const resultado of resultados) {
        if (y < 150) {
          // Crear nueva página si es necesario
          const newPage = pdfDoc.addPage([612, 792]);
          y = 750;
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
          ['Modalidad', 'Pensión (UF)', 'Pensión M. Bruto', 'Dscto. 7% Salud', 'Pensión Líquida'],
          [resultado.nombre.substring(0, 25), `${pensionUF} UF`, `$${formatNumber(pensionBruto)}`, `-$${formatNumber(descuentoSalud)}`, `$${formatNumber(pensionLiquida)}`]
        ];
        const colWidths = [130, 70, 100, 90, 90];
        y = drawTable(page, sobData, 50, y, colWidths, { regular: fontRegular, bold: fontBold });

        // Pensión por beneficiario
        if (resultado.pensionPorBeneficiario && resultado.pensionPorBeneficiario.length > 0) {
          y -= 5;
          drawText(page, 'Distribución por Beneficiario:', 50, y, { size: 9, font: fontBold });
          y -= 15;

          const benData = [
            ['Beneficiario', 'Porcentaje', 'Pensión Mensual'],
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

    // Notas finales
    y = Math.min(y, 100);
    drawText(page, 'NOTA: VALORES ESTIMATIVOS NO CONSTITUYEN UNA OFERTA FORMAL DE PENSIÓN.', 50, y, { size: 7, font: fontRegular });
    y -= 12;
    drawText(page, 'LA PGU SE SOLICITA A LOS 65 AÑOS, REQUISITO TENER REGISTRO SOCIAL DE HOGARES.', 50, y, { size: 7, font: fontRegular });
    y -= 12;
    drawText(page, 'BONIFICACIÓN POR AÑO COTIZADO: 0.1 UF POR AÑO COTIZADO.', 50, y, { size: 7, font: fontRegular });
    
    if (tipoPension === 'invalidez') {
      y -= 12;
      drawText(page, 'PENSIÓN DE INVALIDEZ: REQUIERE DICTAMEN DE COMISIÓN MÉDICA.', 50, y, { size: 7, font: fontRegular });
    }
    
    if (tipoPension === 'sobrevivencia') {
      y -= 12;
      drawText(page, 'PENSIÓN DE SOBREVIVENCIA: PORCENTAJES SEGÚN ART. 58 DL 3500.', 50, y, { size: 7, font: fontRegular });
    }

    // Guardar PDF
    const pdfBytes = await pdfDoc.save();

    // Nombre del archivo
    const nombreLimpio = nombreAfiliado
      .replace(/[^A-ZÁÉÍÓÚÑ\s]/g, '')
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
