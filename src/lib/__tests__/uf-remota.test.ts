import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { consultarReferenciaUF, leerUFDesdeSII, fechaEnChile } from '../uf-remota.ts';

describe('Fecha y procedencia UF remota', () => {
  const tabla = `<div id='mes_enero'><table><th><strong>8</strong></th><td>40.000,10</td></table></div><div id='mes_noviembre'><table><th><strong>8</strong></th><td>41.290,15</td></table></div>`;
  it('identifica el mes exacto, incluye decimales y no toma el mismo día de otro mes', () => {
    assert.deepEqual(leerUFDesdeSII(tabla, '2026-11-08'), { valor: 41290.15, fecha: '2026-11-08', fuente: 'sii.cl' });
    assert.throws(() => leerUFDesdeSII(tabla, '2026-10-08'), RangeError);
    assert.throws(() => leerUFDesdeSII(tabla.replace('41.290,15', ''), '2026-11-08'), RangeError);
  });
  it('obtiene la fecha de Chile en el cambio de día UTC', () => {
    assert.equal(fechaEnChile(new Date('2026-01-02T01:00:00Z')), '2026-01-01');
  });
  it('la fuente secundaria conserva su fecha histórica real y descarta datos futuros', async () => {
    const falso = (async (url: string) => url.includes('sii.cl') ? new Response('', { status: 503 }) : Response.json({ serie: [
      { valor: 55000, fecha: '2026-11-10T00:00:00Z' }, { valor: 41000.11, fecha: '2026-11-07T00:00:00Z' }, { valor: 40000, fecha: '' }
    ] })) as typeof fetch;
    const ref = await consultarReferenciaUF('2026-11-08', falso);
    assert.equal(ref.fecha, '2026-11-07');
    assert.equal(ref.valor, 41000.11);
  });
  it('no inventa una UF ni la fecha de hoy cuando fallan las fuentes', async () => {
    const falso = (async () => Response.json({ serie: [{ valor: 41000 }] })) as typeof fetch;
    await assert.rejects(consultarReferenciaUF('2026-11-08', falso));
  });
});
