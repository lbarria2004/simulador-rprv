import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';

function formatNumber(num) {
  return Math.round(num).toLocaleString('es-CL');
}

function drawText(page, text, x, y, options = {}) {
  const { size = 10, font, color } = options;
  page.drawText(text, {
    x, y, size,
    font: font,
    color: color ? rgb(color.r, color.g, color.b) : rgb(0, 0, 0),
  });
}

function drawTable(page, data, x, y, colWidths, fonts) {
  const rowHeight = 18;
  const cellPadding = 4;
  let currentY = y;

  for (let row = 0; row < data.length; row++) {
    let currentX = x;
    for (let col = 0; col < data[row].length; col++) {
      const cellText = data[row][col];
      const cellWidth = colWidths[col];
      
      if (row === 0) {
        page.drawRectangle({ x: currentX, y: currentY - 4, width: cellWidth, height: rowHeight, color: rgb(0.122, 0.306, 0.475) });
      } else if (row > 1) {
        page.drawRectangle({ x: currentX, y: currentY - 4, width: cellWidth, height: rowHeight, color: rgb(0.91, 0.956, 0.992) });
      }
      
      page.drawRectangle({ x: currentX, y: currentY - 4, width: cellWidth, height: rowHeight, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
      
      const font = row === 0 ? fonts.bold : fonts.regular;
      const color = row === 0 ? { r: 1, g: 1, b: 1 } : { r: 0.2, g: 0.2, b: 0.2 };
      drawText(page, cellText, currentX + cellPadding, currentY + 2, { size: 7, font, color });
      currentX += cellWidth;
    }
    currentY -= rowHeight;
  }
  return currentY - 10;
}

async function generateSamplePDF() {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let y = 750;

  drawText(page, 'PROPUESTA: TABLA CONSOLIDADA RV CON AUMENTO TEMPORAL', 100, y, { size: 14, font: fontBold, color: { r: 0.122, g: 0.306, b: 0.475 } });
  y -= 30;

  drawText(page, 'FORMATO PROPUESTO (Consolidado en una tabla):', 50, y, { size: 11, font: fontBold, color: { r: 0.2, g: 0.5, b: 0.2 } });
  y -= 20;

  drawText(page, '3. RV CON AUMENTO TEMPORAL', 50, y, { size: 11, font: fontBold, color: { r: 0.122, g: 0.306, b: 0.475 } });
  y -= 14;
  drawText(page, 'Aumento 30% por 3 anos', 50, y, { size: 9, font: fontRegular });
  y -= 18;

  const tablaPropuesta = [
    ['Periodo', 'Pension (UF)', 'Bruto', '-7% Salud', 'Liquido', '+ PGU'],
    ['DURANTE 3 ANOS', '12.50 UF', '$481.250', '-$33.688', '$447.562', '$679.294'],
    ['DESPUES (3 anos)', '9.62 UF', '$370.192', '-$25.913', '$344.279', '$576.011']
  ];
  const colWidthsProp = [95, 65, 75, 70, 75, 80];
  y = drawTable(page, tablaPropuesta, 50, y, colWidthsProp, { regular: fontRegular, bold: fontBold });

  drawText(page, 'Diferencia: $103.283/menos (30.0% menos despues del aumento)', 50, y, { size: 8, font: fontRegular, color: { r: 0.5, g: 0.5, b: 0.5 } });
  y -= 30;

  page.drawRectangle({ x: 50, y: y + 10, width: 500, height: 1, color: rgb(0.7, 0.7, 0.7) });
  y -= 20;

  drawText(page, 'FORMATO ANTERIOR (Como referencia - mas extenso):', 50, y, { size: 11, font: fontBold, color: { r: 0.7, g: 0.3, b: 0.3 } });
  y -= 20;

  drawText(page, '3. RV CON AUMENTO TEMPORAL', 50, y, { size: 11, font: fontBold, color: { r: 0.122, g: 0.306, b: 0.475 } });
  y -= 15;
  drawText(page, 'Aumento: 30% por 3 anos', 50, y, { size: 9, font: fontRegular });
  y -= 18;

  drawText(page, '>>> PENSION DURANTE EL PERIODO DE AUMENTO:', 50, y, { size: 10, font: fontBold, color: { r: 0.2, g: 0.5, b: 0.2 } });
  y -= 15;

  const tablaDurante = [
    ['Pension (UF)', 'Pension Mensual Bruto', 'Dscto. 7% Salud', 'Pension Liquida'],
    ['12.50 UF', '$481.250', '-$33.688', '$447.562']
  ];
  y = drawTable(page, tablaDurante, 50, y, [80, 120, 100, 100], { regular: fontRegular, bold: fontBold });

  drawText(page, 'Con PGU (+$231.732): $679.294/mes', 60, y, { size: 9, font: fontRegular, color: { r: 0.2, g: 0.4, b: 0.6 } });
  y -= 20;

  page.drawRectangle({ x: 50, y: y + 5, width: 500, height: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 15;

  drawText(page, '>>> PENSION DESPUES DEL PERIODO DE AUMENTO:', 50, y, { size: 10, font: fontBold, color: { r: 0.6, g: 0.2, b: 0.2 } });
  y -= 15;

  const tablaDespues = [
    ['Pension (UF)', 'Pension Mensual Bruto', 'Dscto. 7% Salud', 'Pension Liquida'],
    ['9.62 UF', '$370.192', '-$25.913', '$344.279']
  ];
  y = drawTable(page, tablaDespues, 50, y, [80, 120, 100, 100], { regular: fontRegular, bold: fontBold });

  drawText(page, 'Con PGU (+$231.732): $576.011/mes', 60, y, { size: 9, font: fontRegular, color: { r: 0.4, g: 0.2, b: 0.4 } });
  y -= 20;

  drawText(page, 'Diferencia: $103.283/menos (30.0% menos despues del aumento)', 50, y, { size: 8, font: fontRegular, color: { r: 0.5, g: 0.5, b: 0.5 } });
  y -= 30;

  page.drawRectangle({ x: 50, y: y - 5, width: 500, height: 60, color: rgb(0.95, 0.98, 0.95), borderColor: rgb(0.2, 0.5, 0.2), borderWidth: 1 });
  y += 45;

  drawText(page, 'RESUMEN DE CAMBIOS', 60, y, { size: 10, font: fontBold, color: { r: 0.1, g: 0.35, b: 0.15 } });
  y -= 14;
  drawText(page, '* Formato propuesto: 1 tabla con 3 filas (incluye PGU integrada)', 60, y, { size: 9, font: fontRegular });
  y -= 12;
  drawText(page, '* Formato anterior: 2 tablas + 2 lineas de PGU + separador', 60, y, { size: 9, font: fontRegular });
  y -= 12;
  drawText(page, '* Ahorro de espacio: ~60% menos lineas verticales', 60, y, { size: 9, font: fontBold, color: { r: 0.2, g: 0.5, b: 0.2 } });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('/home/z/my-project/download/propuesta_tabla_consolidada.pdf', pdfBytes);
  console.log('PDF generado exitosamente');
}

generateSamplePDF().catch(console.error);
