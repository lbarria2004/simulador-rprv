import { determinarPorcentajes } from '../reglas-sobrevivencia.ts';
import { calcularRVAumentoTemporalInvalidez } from '../pension-calculator.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { generarReportePDF, type DatosReporte } from '../reporte-pdf.ts';
import { type ReferenciaUF } from '../moneda.ts';

/** Extrae las cadenas WinAnsi realmente dibujadas, sin servicios ni dependencias nuevas. */
async function textosPDF(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map(page => {
    const contents = page.node.Contents();
    const flujos = contents instanceof PDFArray ? contents.asArray().map(item => doc.context.lookup(item)) : [contents];
    return flujos.flatMap(flujo => {
      if (!(flujo instanceof PDFRawStream)) return [];
      const operadores = Buffer.from(decodePDFRawStream(flujo).decode()).toString('latin1');
      return [...operadores.matchAll(/<([0-9a-f]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1'));
    }).join('\n');
  });
}
const uf: ReferenciaUF = { valor: 45000.13, fecha: '2026-10-01', fuente: 'Fixture de reporte' };
const entrada = (): DatosReporte => ({
  afiliado: { nombre: 'Ejemplo de prueba', sexo: 'M', edad: 65, fondosAcumulados: uf.valor * 1000.25, anosCotizados: 25, tipoPension: 'vejez' },
  parametros: { referenciaUF: uf, tasaRP: .0367, tasaRV: .03, afpSeleccionada: 'PLANVITAL', incluirPGU: false, incluirBAC: false },
  resultados: [{ nombre: 'Retiro Programado', pensionMensual: uf.valor * 10, pensionEnUF: 9999, pensionAnual: uf.valor * 120, cnu: 200, tasaInteres: .0367, expectativaVida: 20 }],
  beneficiarios: []
});

describe('Regresión del documento PDF', () => {
  it('usa CLP como origen, ignora UF precalculadas y muestra valor y fecha exactos', async () => {
    const bytes = await generarReportePDF(entrada());
    const textos = await textosPDF(bytes);
    assert.ok(textos[0].includes('10.00 UF'));
    assert.ok(textos[0].includes('1000.25 UF'));
    assert.ok(textos[0].includes('45.000,13'));
    assert.ok(textos[0].includes('2026-10-01'));
    assert.ok(!textos[0].includes('9999'));
    assert.ok(textos[0].includes('CLP reales'));
  });
  it('al duplicar UF mantiene pesos y reduce a la mitad sus equivalentes', async () => {
    const body = entrada();
    body.parametros.referenciaUF = { ...uf, valor: uf.valor * 2 };
    const texto = (await textosPDF(await generarReportePDF(body))).join('\n');
    assert.ok(texto.includes('5.00 UF'));
    assert.ok(texto.includes('500.13 UF'));
    assert.ok(texto.includes('$450.001'));
  });
  it('rechaza referencias sin fecha o distintas de las anotadas en el resultado', async () => {
    const body = entrada();
    body.parametros.referenciaUF = { ...uf, fecha: '' };
    await assert.rejects(generarReportePDF(body), RangeError);
    const otro = entrada();
    otro.resultados[0].referenciaUF = { ...uf, fecha: '2026-09-01' };
    await assert.rejects(generarReportePDF(otro), /referencia UF del resultado/);
  });
  it('rechaza la antigua mezcla de UF nominal futura y flujos reales', async () => {
    const body = entrada();
    body.parametros.usarProyeccionUF = true;
    body.parametros.incrementoAnualUF = 1000;
    await assert.rejects(generarReportePDF(body), /CLP reales/);
  });
  it('no agrega PGU a una persona menor de 65 al activar el beneficio', async () => {
    const body = entrada();
    body.afiliado.edad = 60;
    body.parametros.incluirPGU = true;
    const texto = (await textosPDF(await generarReportePDF(body))).join('\n');
    assert.ok(!texto.includes('$681.733'), 'No debe sumar PGU al monto bruto de este caso');
    assert.ok(texto.includes('$450.001'));
  });
  it('dibuja el aviso de orientación en todas las páginas de un reporte extenso', async () => {
    const body = entrada();
    for (let i = 0; i < 10; i++) body.resultados.push({ ...body.resultados[0], nombre: `RV Inmediata Garantizada ${i}`, periodoGarantizado: 60 + i * 12 });
    const paginas = await textosPDF(await generarReportePDF(body));
    assert.ok(paginas.length > 1);
    for (const texto of paginas) {
      assert.ok(texto.includes('Sin conexion con SCOMP. No es oferta de AFP o aseguradora.'));
      assert.ok(texto.includes('Montos, tasas aplicadas, garantias y derechos futuros: pendientes de validacion especializada.'));
    }
  });
  it('distingue en el PDF regla legal, incremento, porcentaje aplicado y participación familiar', async () => {
    const body = entrada();
    body.resultados[0].reglasSobrevivencia = determinarPorcentajes([
      { tipo: 'conyuge', id: 'c', edad: 62, sexo: 'F', porcentajePension: .7, idsHijosComunes: ['h'] },
      { tipo: 'hijo', id: 'h', edad: 12, sexo: 'M', porcentajePension: 0 }
    ]);
    const texto = (await textosPDF(await generarReportePDF(body))).join('\n');
    for (const valor of ['Regla base', 'Incremento', 'Utilizado', 'Part. familiar', '50.00%', '70.00%', '82.35%', '15.00%']) assert.ok(texto.includes(valor), valor);
    assert.ok(texto.includes('base de referencia del causante es distinta'));
    assert.ok(texto.includes('no acreditan un derecho legal'));
    assert.ok(texto.includes('sin certificacion'));
  });
  it('invalidez temporal conserva 13 meses, aumento de 50% y conversión UF en ambas fases', async () => {
    const body = entrada();
    body.afiliado.tipoPension = 'invalidez';
    const resultado = calcularRVAumentoTemporalInvalidez(80000000, 65, 'M', 13, .5, .03, [], uf);
    body.resultados = [resultado];
    const texto = (await textosPDF(await generarReportePDF(body))).join('\n');
    assert.ok(texto.includes('Aumento 50% por 13 meses'));
    assert.ok(texto.includes('Desde mes 14'));
    assert.ok(texto.includes(`${(resultado.pensionMensual / uf.valor).toFixed(2)} UF`));
    assert.ok(texto.includes(`${(resultado.aumentoTemporal!.pensionFinal / uf.valor).toFixed(2)} UF`));
  });

});
