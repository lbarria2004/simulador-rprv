import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPiloto, leerSolicitudPiloto, validarDatosPiloto, verificarProyeccionPiloto, ErrorPiloto } from '../piloto.ts';
import { calcularEscenariosRetiroProgramado, calcularRVInmediata } from '../pension-calculator.ts';
import { datosPiloto, grupoPiloto } from './piloto-fixtures.ts';

const restringida = (fn: () => unknown) => assert.throws(fn, e => e instanceof ErrorPiloto && e.status === 403);

describe('Piloto: política compartida y cálculo preservado', () => {
  it('delega la comparación en el motor anterior sin alterar sus CNU ni montos', () => {
    const d = datosPiloto(), copia = structuredClone(d);
    const r = calcularPiloto(d);
    const original = calcularEscenariosRetiroProgramado(d.fondos, d.edad, d.sexo, d.tasaTecnicaCNU, [], false, 2026, d.referenciaUF);
    const rv = calcularRVInmediata(d.fondos, d.edad, d.sexo, d.tasaRV, [], false, d.referenciaUF);
    assert.equal(r.comparacion.rp.pensionMensual, original.base.pensionMensual);
    assert.equal(r.comparacion.rp.cnu, original.base.cnu);
    assert.equal(r.comparacion.rv.pensionMensual, rv.pensionMensual);
    assert.equal(r.comparacion.rv.cnu, rv.cnu);
    assert.equal(r.comparacion.rv.tasaDescuento, d.tasaRV);
    assert.deepEqual(d, copia);
    assert.notEqual(r.datos.referenciaUF, d.referenciaUF);
  });
  it('clasifica los dos montos como aproximaciones, sin convertirlos en ofertas', () => {
    const r = calcularPiloto(datosPiloto());
    for (const monto of Object.values(r.comparacion)) {
      assert.equal(monto.clasificacion, 'aproximacion_documentada');
      assert.equal(monto.validacionIndividual, 'pendiente_validacion_especializada');
      assert.ok(!('expectativaVida' in monto));
      assert.ok(!('periodoGarantizado' in monto));
      assert.ok(!('proyeccion' in monto));
    }
    assert.match(r.aviso, /sin certificación normativa/);
    assert.match(r.aviso, /No es una oferta/);
    assert.ok(r.supuestos.some(s => s.includes('cuota mortuoria')));
    assert.ok(r.restricciones.some(s => s.componentes.some(c => c === 'M23')));
  });
  for (const escenarioRP of ['conservador', 'base', 'optimista'] as const) {
    it(`escenario ${escenarioRP}: cambia el retorno, conserva CNU inicial y verifica todas las curvas`, () => {
      const r = calcularPiloto(datosPiloto({ escenarioRP }));
      assert.equal(r.escenarios.length, 3);
      assert.deepEqual(r.escenarios.map(e => e.rentabilidadRealAnual), [0, .02, .04]);
      assert.equal(new Set(r.escenarios.map(e => e.pensionInicial)).size, 1);
      assert.equal(r.proyecciones.disponibles, true);
      assert.ok(r.proyecciones.puntos.length > 20);
      const fila = r.proyecciones.puntos[10];
      assert.ok(fila.conservadorSaldo < fila.baseSaldo && fila.baseSaldo < fila.optimistaSaldo);
      assert.ok(fila.conservadorPension < fila.basePension && fila.basePension < fila.optimistaPension);
      assert.equal(r.proyecciones.puntos[0].baseSaldo, r.datos.fondos);
      assert.equal(r.proyecciones.puntos[0].basePension, r.comparacion.rp.pensionMensual);
    });
  }
  it('cambiar únicamente la UF conserva CLP y puntos, y reduce a la mitad sus equivalentes', () => {
    const d = datosPiloto(), a = calcularPiloto(d);
    const b = calcularPiloto({ ...d, referenciaUF: { ...d.referenciaUF, valor: d.referenciaUF.valor * 2 } });
    assert.deepEqual(a.proyecciones, b.proyecciones);
    for (const k of ['rp', 'rv'] as const) {
      assert.equal(a.comparacion[k].cnu, b.comparacion[k].cnu);
      assert.equal(a.comparacion[k].pensionMensual, b.comparacion[k].pensionMensual);
      assert.equal(a.comparacion[k].pensionEnUF, b.comparacion[k].pensionEnUF * 2);
    }
  });
  it('sin saldo no inventa una curva financiada y mantiene ambos montos en cero', () => {
    const r = calcularPiloto(datosPiloto({ fondos: 0 }));
    assert.equal(r.comparacion.rp.pensionMensual, 0);
    assert.equal(r.comparacion.rv.pensionMensual, 0);
    assert.equal(r.proyecciones.disponibles, false);
    assert.deepEqual(r.proyecciones.puntos, []);
  });
  it('con cónyuge e hijo conserva el cálculo inicial y retira todas las curvas familiares', () => {
    const d = datosPiloto({ beneficiarios: grupoPiloto() }), copia = structuredClone(d);
    const r = calcularPiloto(d);
    const original = calcularRVInmediata(d.fondos, d.edad, d.sexo, d.tasaRV, d.beneficiarios, false, d.referenciaUF);
    assert.equal(r.comparacion.rv.pensionMensual, original.pensionMensual);
    assert.deepEqual(r.porcentajesActuales.map(b => b.porcentaje), [.5, .15]);
    assert.equal(r.proyecciones.disponibles, false);
    assert.deepEqual(r.proyecciones.puntos, []);
    assert.match(r.proyecciones.motivo, /M11\/M22/);
    assert.deepEqual(d, copia);
  });
  it('admite cónyuge sin hijos con vínculo vacío explícito y bloquea su curva', () => {
    const conyuge = { ...grupoPiloto()[0], idsHijosComunes: [] };
    const r = calcularPiloto(datosPiloto({ beneficiarios: [conyuge] }));
    assert.equal(r.porcentajesActuales[0].porcentaje, .6);
    assert.equal(r.proyecciones.puntos.length, 0);
  });
  it('admite solo el perfil familiar acotado, incluyendo el estudio explícito de 18–23 años', () => {
    const grupo = grupoPiloto(); grupo[1].edad = 20;
    assert.throws(() => calcularPiloto(datosPiloto({ beneficiarios: grupo })), /hipótesis explícita de estudios/);
    grupo[1].esEstudiante = true;
    assert.equal(calcularPiloto(datosPiloto({ beneficiarios: grupo })).porcentajesActuales[1].edad, 20);
    grupo[1].edad = 24;
    assert.throws(() => calcularPiloto(datosPiloto({ beneficiarios: grupo })), /Edad de beneficiario/);
  });
  it('separa el respaldo de 3,67% desde octubre de su uso hipotético en una fecha anterior', () => {
    const d = datosPiloto(); d.fechaValoracion = d.referenciaUF.fecha = '2026-01-01';
    d.tasaTecnicaCNU = Number('3.67') / 100;
    const r = calcularPiloto(d);
    assert.ok(r.supuestos.some(s => s.includes('no corresponde asumir su vigencia')));
    assert.equal(r.datos.tasaTecnicaCNU, d.tasaTecnicaCNU);
  });
  it('sin campos requeridos o confirmación ficticia no calcula ni usa valores de respaldo', () => {
    for (const cambio of [{ datosFicticios: false }, { datosFicticios: 'true' }, { datosFicticios: undefined }, { referenciaUF: undefined }, { tasaRV: undefined }, { fondos: undefined }]) {
      assert.throws(() => calcularPiloto({ ...datosPiloto(), ...cambio }), RangeError);
    }
  });
  it('rechaza números y categorías malformados, fechas imposibles y referencias discordantes', () => {
    const d = datosPiloto();
    for (const cambio of [{ fondos: '80000000' }, { fondos: NaN }, { fondos: -1 }, { fondos: .5 }, { fondos: 1e13 }, { edad: 64 }, { edad: 65.5 }, { sexo: 'X' }, { tasaRV: Infinity }, { tasaTecnicaCNU: -.01 }, { tasaRV: .11 }, { escenarioRP: ['base'] }, { fechaValoracion: '2026-01-01' }]) {
      assert.throws(() => calcularPiloto({ ...d, ...cambio }), RangeError);
    }
    for (const referenciaUF of [{ ...d.referenciaUF, valor: 0 }, { ...d.referenciaUF, fecha: '2026-02-30' }, { ...d.referenciaUF, fuente: '' }]) assert.throws(() => calcularPiloto({ ...d, referenciaUF, fechaValoracion: referenciaUF.fecha }), RangeError);
    for (const fecha of ['2023-06-30', '2026-11-09']) assert.throws(() => calcularPiloto({ ...d, fechaValoracion: fecha, referenciaUF: { ...d.referenciaUF, fecha } }), /fuera del piloto/);
    assert.equal(calcularPiloto(datosPiloto({ sexo: 'F', edad: 60 })).datos.edad, 60);
  });
  it('rechaza UF con precisión oculta o magnitud fuera del formato visible del piloto', () => {
    for (const valor of [.001, 45000.131, 1000001]) {
      const d = datosPiloto(); d.referenciaUF.valor = valor;
      assert.throws(() => calcularPiloto(d), /UF fuera del formato/);
    }
    const d = datosPiloto(); d.referenciaUF.valor = 45000.13;
    assert.equal(calcularPiloto(d).datos.referenciaUF.valor, 45000.13);
  });
  for (const campo of ['periodoGarantizado', 'mesesAumento', 'porcentajeAumento', 'modoExperto', 'cubiertoSIS', 'ingresoBase', 'incluirPGU', 'incluirBAC', 'incluirBEV', 'comision', 'tipoPension', 'resultados', 'pensionMensual']) {
    it(`bloquea ${campo}, incluso por entrada directa fuera de la pantalla`, () => {
      restringida(() => calcularPiloto({ ...datosPiloto(), [campo]: true }));
    });
  }
  it('rechaza parentescos complejos, orfandad, vínculos incompletos, porcentajes manuales e invalidez', () => {
    const [c, h] = grupoPiloto();
    for (const grupo of [[h], [{ ...c, tipo: 'conviviente' }], [c, { ...c, id: 'c2' }], [{ ...c, porcentajePension: .7 }], [{ ...c, idsHijosComunes: [] }, h], [{ ...c, idsHijosComunes: ['h', 'h'] }, h], [c, { ...h, esInvalido: true }], [{ ...c, tipo: ['conyuge'] }], [{ ...c, esEstudiante: true }]]) {
      assert.throws(() => calcularPiloto({ ...datosPiloto(), beneficiarios: grupo }), RangeError);
    }
  });
  it('valida identificadores únicos y grupos de máximo cuatro hijos comunes', () => {
    const [c, h] = grupoPiloto();
    const hijos = Array.from({ length: 4 }, (_, i) => ({ ...h, id: `h${i}` }));
    const grupo = [{ ...c, idsHijosComunes: hijos.map(b => b.id) }, ...hijos];
    assert.equal(calcularPiloto({ ...datosPiloto(), beneficiarios: grupo }).porcentajesActuales.length, 5);
    assert.throws(() => calcularPiloto({ ...datosPiloto(), beneficiarios: [...grupo, { ...h, id: 'extra' }] }), RangeError);
    assert.throws(() => calcularPiloto({ ...datosPiloto(), beneficiarios: [c, { ...h, id: 'c' }] }), /identificadores únicos/);
  });
  it('el contrato de PDF no admite importes ni resultados precalculados para eludir la política', () => {
    const d = datosPiloto();
    assert.deepEqual(leerSolicitudPiloto({ datos: d }, true), validarDatosPiloto(d));
    for (const extra of [{ resultados: [] }, { parametros: {} }, { perfil: 'experto' }, { tipo: 'periodo_garantizado' }]) restringida(() => leerSolicitudPiloto({ datos: d, ...extra }, true));
    restringida(() => leerSolicitudPiloto({ datos: { ...d, referenciaUF: { ...d.referenciaUF, modoExperto: true } } }, true));
  });
  for (const tipo of ['retiro_programado', 'inmediata', 'invalidez', 'sobrevivencia', 'periodo_garantizado', 'aumento_temporal', 'ambas', 'sobrevivencia_rv_aumento']) {
    it(`la API histórica ${tipo} queda restringida en el perfil piloto`, () => restringida(() => leerSolicitudPiloto({ tipo, datos: datosPiloto() })));
  }
  it('detecta flujos, calendarios y horizontes alterados antes de habilitar un gráfico', () => {
    const d = datosPiloto();
    const filas = calcularEscenariosRetiroProgramado(d.fondos, d.edad, d.sexo, d.tasaTecnicaCNU, [], false, 2026, d.referenciaUF).base.proyeccion;
    const verificar = (p: typeof filas) => verificarProyeccionPiloto(p, d.fondos, .02, 65, 2026);
    assert.equal(verificar(filas), true);
    assert.equal(verificar([]), false);
    assert.equal(verificar(filas.slice(0, 1)), false);
    for (const cambio of [{ saldoFinal: filas[2].saldoFinal + 1 }, { pensionMensual: filas[2].pensionMensual + 1 }, { retiroAnual: 1e9 }, { anoCalendario: 1900 }, { cnu: NaN }, { beneficiarios: grupoPiloto() }]) {
      const copia = structuredClone(filas); Object.assign(copia[2], cambio);
      assert.equal(verificar(copia), false);
    }
  });
});
