import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { generarReportePilotoPDF } from '../reporte-piloto.ts';
import { calcularPiloto, ErrorPiloto } from '../piloto.ts';
import { datosPiloto, grupoPiloto } from './piloto-fixtures.ts';

async function textos(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map(p => {
    const c = p.node.Contents();
    const flujos = c instanceof PDFArray ? c.asArray().map(x => pdf.context.lookup(x)) : [c];
    return flujos.flatMap(f => f instanceof PDFRawStream ? [...Buffer.from(decodePDFRawStream(f).decode()).toString('latin1').matchAll(/<([a-f0-9]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')) : []).join('\n');
  });
}

describe('PDF del piloto: política y trazabilidad desde los datos', () => {
  it('recalcula montos con la misma referencia y conserva fecha, tasas, supuestos y fuentes', async () => {
    const d = datosPiloto(), r = calcularPiloto(d);
    const paginas = await textos(await generarReportePilotoPDF({ datos: d }));
    const todo = paginas.join('\n'), unido = todo.replace(/\s/g, '');
    assert.ok(paginas.length >= 3);
    for (const v of ['PILOTO-001', '2026-11-08', '45.000,13', '3.67%', '2.82%', 'cuota mortuoria', 'TM-2020', 'CNU aprox.']) assert.ok(todo.includes(v), v);
    for (const monto of Object.values(r.comparacion)) {
      assert.ok(todo.includes(`$${monto.pensionMensual.toLocaleString('es-CL')}`));
      assert.ok(todo.includes(monto.pensionEnUF.toFixed(2)));
    }
    for (const f of r.fuentes) assert.ok(unido.includes(f.url), f.url);
    for (const p of paginas) {
      assert.ok(p.includes('Sin certificación normativa'));
      assert.ok(p.includes('No es oferta comercial'));
      assert.ok(p.includes('Sin SCOMP'));
      assert.ok(p.includes(`Valoración ${d.fechaValoracion}`));
    }
  });
  it('solo incluye gráficos RP cuando sus datos financieros están habilitados', async () => {
    const a = (await textos(await generarReportePilotoPDF({ datos: datosPiloto() }))).join('\n');
    assert.ok(a.includes('Pensión mensual RP'));
    assert.ok(a.includes('Saldo AFP al inicio'));
    assert.ok(!a.includes('Pensión líquida'));
    const b = (await textos(await generarReportePilotoPDF({ datos: datosPiloto({ beneficiarios: grupoPiloto() }) }))).join('\n');
    assert.ok(b.includes('Gráficos no habilitados'));
    assert.ok(b.replace(/\s+/g, ' ').includes('familiares futuras bloqueadas'));
    assert.ok(!b.includes('Pensión mensual RP'));
    assert.ok(!b.includes('Saldo AFP al inicio'));
    assert.ok(b.includes('50.00%') && b.includes('15.00%'));
  });
  it('sin fondos genera un informe sin curvas ni montos ficticios', async () => {
    const t = (await textos(await generarReportePilotoPDF({ datos: datosPiloto({ fondos: 0 }) }))).join('\n');
    assert.ok(t.includes('Gráficos no habilitados'));
    assert.ok(t.includes('0.00'));
    assert.ok(!t.includes('Pensión mensual RP'));
  });
  it('no permite resultados, cláusulas ni modos alternativos en el cuerpo del reporte', async () => {
    const d = datosPiloto();
    for (const extra of [{ resultados: [{ pensionMensual: 9999999 }] }, { modoExperto: true }, { parametros: { incluirPGU: true } }]) {
      await assert.rejects(generarReportePilotoPDF({ datos: d, ...extra }), e => e instanceof ErrorPiloto && e.status === 403);
    }
    await assert.rejects(generarReportePilotoPDF({ datos: { ...d, mesesGarantizados: 180 } }), ErrorPiloto);
    await assert.rejects(generarReportePilotoPDF({ datos: { ...d, datosFicticios: false } }), ErrorPiloto);
  });
  it('advierte el uso de 3,67% en una valoración anterior a su vigencia documentada', async () => {
    const d = datosPiloto(); d.fechaValoracion = d.referenciaUF.fecha = '2026-01-01';
    d.tasaTecnicaCNU = Number('3.67') / 100;
    const t = (await textos(await generarReportePilotoPDF({ datos: d }))).join('\n');
    assert.ok(t.replace(/\s+/g, ' ').includes('no corresponde asumir su vigencia'));
  });
  it('admite el tamaño máximo del grupo, fuente e identificador sin perder los avisos', async () => {
    const [c, h] = grupoPiloto();
    const hijos = Array.from({ length: 4 }, (_, i) => ({ ...h, id: `h${i}` }));
    const d = datosPiloto({ caso: 'W'.repeat(40), beneficiarios: [{ ...c, idsHijosComunes: hijos.map(b => b.id) }, ...hijos] });
    d.referenciaUF.fuente = 'W'.repeat(160);
    const paginas = await textos(await generarReportePilotoPDF({ datos: d }));
    assert.ok(paginas.length >= 3);
    for (const pagina of paginas) assert.ok(pagina.includes('Sin certificación normativa'));
    const t = paginas.join('\n');
    assert.ok(t.includes('Gráficos no habilitados'));
    assert.ok(t.includes('Cónyuge') && t.includes('Hijo/a común'));
  });
});
