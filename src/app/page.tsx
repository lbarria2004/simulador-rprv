'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, BarChart3, Check, ChevronRight, FileText, Info, LockKeyhole, Plus, Trash2, UserRound, UsersRound, Wallet, LoaderCircle } from 'lucide-react';
import { AVISO_PILOTO, FECHA_REVISION_PILOTO, FUENTES_PILOTO, LIMITACION_CNU, RESTRICCIONES_PILOTO, type ResultadoPiloto } from '@/lib/piloto';
import { TASAS_INTERES } from '@/lib/pension-calculator';
import { clpAUf } from '@/lib/moneda';
import { ProjectionCharts } from '@/components/piloto/ProjectionCharts';
import { ScenarioBuilder } from '@/components/escenarios/ScenarioBuilder';

interface BeneficiarioFormulario { id: string; tipo: 'conyuge' | 'hijo'; edad: string; sexo: 'M' | 'F'; esEstudiante: boolean }
const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const uf = (n: number) => n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Home() {
  const [caso, setCaso] = useState('CASO-001');
  const [sexo, setSexo] = useState<'M' | 'F'>('M');
  const [edad, setEdad] = useState('65');
  const [fondos, setFondos] = useState('80000000');
  const [valorUF, setValorUF] = useState('40000');
  const [fecha, setFecha] = useState(FECHA_REVISION_PILOTO);
  const [fuente, setFuente] = useState('Supuesto ilustrativo para ejercicio interno');
  const [tasaRP, setTasaRP] = useState((TASAS_INTERES.RETIRO_PROGRAMADO * 100).toFixed(2));
  const [tasaRV, setTasaRV] = useState((TASAS_INTERES.RENTA_VITALICIA_VEJEZ * 100).toFixed(2));
  const [escenario, setEscenario] = useState('base');
  const [beneficiarios, setBeneficiarios] = useState<BeneficiarioFormulario[]>([]);
  const [vinculos, setVinculos] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');
  const [estudio, setEstudio] = useState<{ firma: string; resultado: ResultadoPiloto } | null>(null);
  const siguienteId = useRef(1);
  const formularioRef = useRef<HTMLFormElement>(null);
  const hayConyuge = beneficiarios.some(b => b.tipo === 'conyuge');
  const hijos = beneficiarios.filter(b => b.tipo === 'hijo');
  const composicionValida = !beneficiarios.length || (hayConyuge && (!hijos.length || vinculos));
  const datos = {
    caso, datosFicticios: confirmado, sexo, edad: Number(edad), fondos: Number(fondos),
    fechaValoracion: fecha, referenciaUF: { valor: Number(valorUF), fecha, fuente },
    tasaTecnicaCNU: Number(tasaRP) / 100, tasaRV: Number(tasaRV) / 100, escenarioRP: escenario,
    beneficiarios: beneficiarios.map(b => ({ id: b.id, tipo: b.tipo, edad: Number(b.edad), sexo: b.sexo, porcentajePension: 0,
      ...(b.tipo === 'hijo' ? { esEstudiante: b.esEstudiante } : { idsHijosComunes: vinculos ? hijos.map(h => h.id) : [] }) }))
  };
  // La firma incluye las entradas textuales: un campo vacío no equivale a un cero calculado.
  const firma = JSON.stringify({ datos, entradas: { edad, fondos, valorUF, tasaRP, tasaRV, beneficiarios } });
  const vigente = estudio?.firma === firma;
  const resultado = vigente ? estudio.resultado : null;
  let saldoUF = '—';
  try { if (fondos && valorUF) saldoUF = uf(clpAUf(Number(fondos), datos.referenciaUF)); } catch { /* Entrada incompleta: no se dibuja un importe inventado. */ }
  const agregar = (tipo: 'conyuge' | 'hijo') => {
    const b: BeneficiarioFormulario = { id: `b-${siguienteId.current++}`, tipo, edad: tipo === 'conyuge' ? '62' : '12', sexo: tipo === 'conyuge' ? 'F' : 'M', esEstudiante: false };
    setBeneficiarios([...beneficiarios, b]); setVinculos(false);
  };
  const editar = (id: string, cambios: Partial<BeneficiarioFormulario>) => setBeneficiarios(beneficiarios.map(b => b.id === id ? { ...b, ...cambios } : b));
  const calcular = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setCargando(true); setError('');
    try {
      const response = await fetch('/api/pension', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'comparacion_piloto', datos }) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'No fue posible calcular el estudio.');
      setEstudio({ firma, resultado: body.resultado });
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión local.'); }
    finally { setCargando(false); }
  };
  const descargar = async () => {
    if (!resultado) return;
    setDescargando(true); setError('');
    try {
      const response = await fetch('/api/reporte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datos: resultado.datos }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'No fue posible preparar el PDF.'); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `Piloto_RP_RV_${resultado.datos.caso}.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible descargar el informe.'); }
    finally { setDescargando(false); }
  };

  return <div className="pilot-root min-h-screen">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1460px] items-center justify-between gap-4 px-5 py-4 sm:px-9">
        <a href="/" className="flex items-center gap-3 text-slate-900" aria-label="Inicio del piloto RP RV">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#123a42] text-white"><BarChart3 size={22} /></span>
          <span><span className="block text-lg font-bold leading-5 tracking-tight">RP <span className="font-normal text-slate-300">/</span> RV</span><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">Mesa de asesoría</span></span>
        </a>
        <div className="flex items-center gap-3 text-xs text-slate-500"><a href="#constructor-escenarios" className="font-semibold text-teal-800 underline decoration-teal-200 underline-offset-4">Escenarios</a><span className="hidden sm:inline">Chile · Orientación previsional</span><span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">Piloto interno</span></div>
      </div>
    </header>

    <main className="mx-auto max-w-[1460px] px-5 pb-10 pt-7 sm:px-9">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-3 flex items-center gap-1 text-[11px] text-slate-500">Mesa de asesoría <ChevronRight size={12} /> Estudio orientativo</div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#172c40] sm:text-[34px]">Comparador previsional</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Retiro Programado simple y Renta Vitalicia inmediata teórica.<br className="hidden sm:block" /> Una comparación con ahorro propio y supuestos explícitos.</p>
        </div>
        <div className="text-left text-[11px] leading-5 text-slate-500 sm:text-right"><span className="font-semibold text-slate-700">Versión piloto · Matriz M01–M27</span><br />Fuentes revisadas al {FECHA_REVISION_PILOTO}</div>
      </div>
      <div className="mb-7 flex items-start gap-3 rounded-xl border border-amber-200/80 bg-[#fffaf0] px-4 py-3.5 text-xs leading-5 text-amber-950" role="note"><Info className="mt-0.5 shrink-0" size={17} /><p><strong>Uso interno con datos ficticios.</strong> No es oferta comercial ni cálculo normativamente certificado. El CNU es aproximado y los montos requieren validación especializada. Sin conexión con SCOMP.</p></div>

      <div className="grid items-start gap-6 lg:grid-cols-[350px_minmax(0,1fr)] xl:gap-8">
        <form id="datos-estudio" ref={formularioRef} onSubmit={calcular} className="scroll-mt-5 space-y-5" aria-label="Datos y supuestos del estudio">
          <section className="pilot-panel p-5">
            <div className="pilot-section-title"><span className="pilot-step">01</span><h2>Afiliado y ahorro propio</h2><UserRound size={16} className="ml-auto text-slate-400" /></div>
            <label className="pilot-label" htmlFor="caso">Identificador del caso ficticio</label>
            <input className="pilot-input" id="caso" value={caso} maxLength={40} pattern="[A-Za-z0-9 _-]+" onChange={e => setCaso(e.target.value)} required autoComplete="off" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div><label className="pilot-label" htmlFor="sexo">Sexo del afiliado</label><select className="pilot-input" id="sexo" value={sexo} onChange={e => setSexo(e.target.value as 'M' | 'F')}><option value="M">Hombre</option><option value="F">Mujer</option></select></div>
              <div><label className="pilot-label" htmlFor="edad">Edad declarada</label><input className="pilot-input" id="edad" type="number" min={sexo === 'M' ? 65 : 60} max={90} step="1" value={edad} onChange={e => setEdad(e.target.value)} required /></div>
            </div>
            <label className="pilot-label mt-4" htmlFor="saldo">Saldo AFP · CLP</label>
            <div className="relative"><span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">$</span><input className="pilot-input pl-7! font-medium tabular-nums" id="saldo" type="number" min="0" max="1000000000000" step="1" value={fondos} onChange={e => setFondos(e.target.value)} required /></div>
            <div className="mt-2 flex justify-between text-[11px]"><span className="text-slate-500">Equivalente con la UF indicada</span><span className="font-semibold tabular-nums text-teal-800">{saldoUF} UF</span></div>
            <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-5 text-slate-500">Solo ahorro propio. Se excluyen SIS, beneficios estatales, comisiones y descuentos de salud.</p>
          </section>

          <section className="pilot-panel p-5">
            <div className="pilot-section-title"><span className="pilot-step">02</span><h2>Valoración y tasas</h2><Wallet size={16} className="ml-auto text-slate-400" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="pilot-label" htmlFor="uf">Valor UF · CLP</label><input id="uf" className="pilot-input tabular-nums" type="number" min="0.01" max="1000000" step="0.01" value={valorUF} onChange={e => setValorUF(e.target.value)} required /></div>
              <div><label className="pilot-label" htmlFor="fecha">Fecha UF / valoración</label><input id="fecha" className="pilot-input text-xs!" type="date" min="2023-07-01" max={FECHA_REVISION_PILOTO} value={fecha} onChange={e => setFecha(e.target.value)} required /></div>
            </div>
            <label className="pilot-label mt-4" htmlFor="fuente">Fuente o descripción de la UF</label><input id="fuente" className="pilot-input text-xs!" value={fuente} maxLength={160} onChange={e => setFuente(e.target.value)} required />
            <p className="mt-2 text-[10px] leading-4 text-slate-500">Valor ilustrativo editable; no es una UF vigente consultada automáticamente. La misma fecha se utiliza para valorar el ejercicio.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div><label className="pilot-label" htmlFor="tasa-rp">Tasa técnica CNU · RP</label><div className="relative"><input className="pilot-input pr-7! tabular-nums" id="tasa-rp" type="number" min="0" max="10" step="0.01" value={tasaRP} onChange={e => setTasaRP(e.target.value)} required /><span className="pointer-events-none absolute right-3 top-3 text-xs text-slate-400">%</span></div></div>
              <div><label className="pilot-label" htmlFor="tasa-rv">Descuento RV teórica</label><div className="relative"><input className="pilot-input pr-7! tabular-nums" id="tasa-rv" type="number" min="0" max="10" step="0.01" value={tasaRV} onChange={e => setTasaRV(e.target.value)} required /><span className="pointer-events-none absolute right-3 top-3 text-xs text-slate-400">%</span></div></div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">Tasas reales anuales configurables. RP 3,67% documentado desde octubre de 2026; sin selección normativa por fecha. RV es una hipótesis de cálculo, sin aseguradora.</p>
            <fieldset className="mt-5"><legend className="pilot-label">Rentabilidad real hipotética AFP</legend><div className="grid grid-cols-3 gap-2">{[['conservador', 'Conservador', '0%'], ['base', 'Base', '2%'], ['optimista', 'Optimista', '4%']].map(([id, nombre, valor]) => <label key={id} className={`cursor-pointer rounded-lg border px-1 py-3 text-center transition-colors ${escenario === id ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}><input className="sr-only" type="radio" name="escenario" value={id} checked={escenario === id} onChange={() => setEscenario(id)} /><span className="block text-[10px]">{nombre}</span><strong className="mt-1 block text-base">{valor}</strong></label>)}</div></fieldset>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">El retorno del fondo se mantiene separado del descuento CNU. No es un pronóstico ni una rentabilidad garantizada.</p>
          </section>

          <section className="pilot-panel p-5">
            <div className="pilot-section-title"><span className="pilot-step">03</span><h2>Beneficiarios hipotéticos</h2><UsersRound size={16} className="ml-auto text-slate-400" /></div>
            <p className="mb-4 text-[11px] leading-5 text-slate-500">Un cónyuge y hasta cuatro hijos comunes no inválidos. Otros vínculos o concurrencias requieren revisión especializada.</p>
            {!beneficiarios.length && <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Sin beneficiarios declarados</div>}
            {beneficiarios.map((b, i) => <div key={b.id} className="mb-3 rounded-lg border border-slate-200 p-3">
              <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-slate-700">{b.tipo === 'conyuge' ? 'Cónyuge' : 'Hijo/a común'}</span><button type="button" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Quitar beneficiario ${i + 1}`} onClick={() => { setBeneficiarios(beneficiarios.filter(x => x.id !== b.id)); setVinculos(false); }}><Trash2 size={14} /></button></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="pilot-label" htmlFor={`edad-${b.id}`}>Edad beneficiario {i + 1}</label><input className="pilot-input" type="number" id={`edad-${b.id}`} min={b.tipo === 'conyuge' ? 18 : 0} max={b.tipo === 'conyuge' ? 100 : 23} step="1" value={b.edad} onChange={e => editar(b.id, { edad: e.target.value })} required /></div><div><label className="pilot-label" htmlFor={`sexo-${b.id}`}>Sexo beneficiario {i + 1}</label><select id={`sexo-${b.id}`} className="pilot-input" value={b.sexo} onChange={e => editar(b.id, { sexo: e.target.value as 'M' | 'F' })}><option value="M">Hombre</option><option value="F">Mujer</option></select></div></div>
              {b.tipo === 'hijo' && <label className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-slate-600"><input className="mt-0.5 accent-teal-700" type="checkbox" checked={b.esEstudiante} onChange={e => editar(b.id, { esEstudiante: e.target.checked })} />Hipótesis de estudios con derecho (necesaria entre 18 y 23 años)</label>}
            </div>)}
            <div className="grid grid-cols-2 gap-2"><button className="pilot-small-button" type="button" disabled={hayConyuge} onClick={() => agregar('conyuge')}><Plus size={13} />Cónyuge</button><button className="pilot-small-button" type="button" disabled={!hayConyuge || hijos.length >= 4} onClick={() => agregar('hijo')}><Plus size={13} />Hijo/a común</button></div>
            {!!hijos.length && <label className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[11px] leading-5 text-amber-950"><input className="mt-1 accent-teal-700" type="checkbox" checked={vinculos} onChange={e => setVinculos(e.target.checked)} />Confirmo como hipótesis que todos los hijos indicados son comunes al cónyuge.</label>}
            {!!beneficiarios.length && <p className="mt-3 text-[11px] leading-5 text-amber-800">Con beneficiarios solo se compara la pensión inicial. Las curvas familiares futuras y los acrecimientos quedan bloqueados.</p>}
          </section>

          <div className="px-1"><label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-slate-600"><input className="mt-1 accent-teal-700" type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} required />Confirmo que usaré datos ficticios para una prueba interna, sin interpretar el resultado como una oferta.</label>
            <button type="submit" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#126e67] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#105b55] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none" disabled={cargando || !confirmado || !composicionValida}>{cargando ? <LoaderCircle className="animate-spin" size={16} /> : <BarChart3 size={16} />}{cargando ? 'Calculando…' : 'Calcular comparación'}<ArrowRight className="ml-auto" size={16} /></button>
            <p className="mt-2 text-center text-[10px] leading-4 text-slate-400">Los resultados se actualizan solo al calcular.<br />No se guardan datos del caso.</p>
          </div>
        </form>

        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-800">Estudio comparativo</h2><button type="button" className="pilot-small-button px-4! py-2.5!" disabled={!resultado || descargando || cargando} onClick={descargar}>{descargando ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowDownToLine size={15} />}{descargando ? 'Preparando informe…' : 'Descargar informe PDF'}</button></div>
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</div>}
          {estudio && !vigente && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Parámetros modificados. Recalcule para mostrar resultados, gráficos y PDF consistentes.</div>}
          {resultado ? <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/60 px-3 py-2 text-[11px] text-slate-500"><span className="flex items-center gap-1.5"><Check size={13} className="text-teal-700" />{resultado.datos.caso} · Valoración {resultado.datos.fechaValoracion}</span><span>UF {uf(resultado.datos.referenciaUF.valor)} CLP · {resultado.datos.escenarioRP}</span></div>
            <div className="grid gap-4 sm:grid-cols-2" data-testid="comparacion">
              {([['rp', 'Retiro Programado', 'Variable · Ahorro propio'], ['rv', 'Renta Vitalicia teórica', 'Inmediata · Sin aseguradora']] as const).map(([id, nombre, subtitulo]) => {
                const r = resultado.comparacion[id];
                return <article key={id} className={`pilot-panel overflow-hidden ${id === 'rp' ? 'border-t-[3px]! border-t-teal-600!' : 'border-t-[3px]! border-t-slate-600!'}`}>
                  <div className="p-5"><div className="flex items-center justify-between gap-2"><h3 className="text-[15px] font-semibold">{nombre}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">Estimación</span></div><p className="mt-1 text-[11px] text-slate-500">{subtitulo}</p>
                    <div className="mt-7 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Pensión mensual inicial · bruta</div>
                    <p className="mt-2 flex items-baseline gap-1.5"><span className="text-[31px] font-semibold tracking-tight tabular-nums text-[#172e41]" data-testid={`${id}-clp`}>{dinero(r.pensionMensual)}</span><span className="text-xs text-slate-400">CLP</span></p>
                    <p className="mt-1 text-sm font-medium tabular-nums text-teal-800" data-testid={`${id}-uf`}>{uf(r.pensionEnUF)} UF <span className="font-normal text-slate-400">/ mes</span></p>
                    <div className="mt-6 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs"><div><div className="text-[10px] text-slate-400">Descuento real anual</div><strong className="mt-1 block font-medium tabular-nums text-slate-700">{(r.tasaDescuento * 100).toFixed(2)}%</strong></div><div><div className="text-[10px] text-slate-400">CNU aproximado</div><strong className="mt-1 block font-medium tabular-nums text-slate-700">{r.cnu.toFixed(4)}</strong></div></div>
                  </div>
                  <p className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-[10px] leading-5 text-slate-500">{id === 'rp' ? 'Pensión recalculada anualmente según saldo y supuestos del modelo.' : 'Ejemplo financiero. No es oferta comercial ni una renta garantizada.'}</p>
                </article>;
              })}
            </div>
            <div className="flex items-start gap-2.5 px-1 text-[11px] leading-5 text-slate-500"><Info size={15} className="mt-0.5 shrink-0" /><p>Montos brutos, sin SIS, beneficios estatales ni descuentos. No se recomienda una modalidad solo por la diferencia estimada. {LIMITACION_CNU}</p></div>
            {!!resultado.porcentajesActuales.length && <section className="pilot-panel p-5"><h3 className="text-sm font-semibold">Porcentajes de referencia actuales · grupo hipotético</h3><p className="mt-2 text-xs leading-5 text-slate-500">Sujetos a requisitos y vínculos declarados; no acreditan derechos. No son un reparto normalizado de una oferta ni pagos futuros.</p><div className="mt-3 flex flex-wrap gap-2">{resultado.porcentajesActuales.map((b, i) => <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700" key={b.id}>{b.tipo === 'conyuge' ? 'Cónyuge' : `Hijo/a ${i}`} · {(b.porcentaje * 100).toFixed(2)}%</span>)}</div></section>}
            <ProjectionCharts resultado={resultado} />
            <details className="pilot-panel p-5 text-xs"><summary className="cursor-pointer font-semibold text-slate-700">Supuestos utilizados en este estudio</summary><ul className="mt-4 list-disc space-y-2 pl-4 leading-6 text-slate-500">{resultado.supuestos.map(s => <li key={s}>{s}</li>)}</ul></details>
          </> : <section className="pilot-panel flex min-h-[365px] flex-col items-center justify-center p-9 text-center" aria-label="Estudio pendiente de cálculo">
            <div className="mb-5 rounded-2xl bg-teal-50 p-5 text-teal-700"><FileText size={32} strokeWidth={1.3} /></div>
            <h3 className="text-xl font-medium tracking-tight text-slate-800">Prepare un estudio con supuestos claros</h3>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">Complete los datos del ejercicio y calcule la comparación. Los resultados y las curvas aparecerán únicamente cuando exista un cálculo válido.</p>
            <div className="mt-6 flex gap-4 text-[11px] text-slate-400"><span>01 · Datos</span><ChevronRight size={13} /><span>02 · Comparación</span><ChevronRight size={13} /><span>03 · Informe</span></div>
          </section>}

          <section className="pilot-panel overflow-hidden" aria-label="Funciones restringidas del piloto">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><LockKeyhole size={15} className="text-slate-400" /><h2 className="text-sm font-semibold text-slate-700">Fuera del alcance de este piloto</h2><span className="ml-auto text-[10px] text-slate-400">Matriz de trazabilidad</span></div>
            <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">{RESTRICCIONES_PILOTO.map(r => <div className="flex items-start gap-2.5" key={r.id}><LockKeyhole size={13} className="mt-1 shrink-0 text-slate-300" /><div><h3 className="text-xs font-medium text-slate-600">{r.titulo}</h3><p className="mt-1 text-[10px] leading-5 text-slate-400">{r.motivo}</p></div></div>)}</div>
          </section>
          <details className="pilot-panel p-5 text-xs"><summary className="cursor-pointer font-semibold text-slate-700">Fuentes y metodología del piloto</summary><p className="mt-4 leading-6 text-slate-500">{LIMITACION_CNU} La misma política limita pantalla, API y PDF; el servidor recalcula el informe desde los datos, sin aceptar importes precalculados.</p><ul className="mt-4 space-y-3">{FUENTES_PILOTO.map(f => <li key={f.url}><a href={f.url} target="_blank" rel="noreferrer" className="font-medium text-teal-800 underline decoration-teal-200 underline-offset-4">{f.titulo}</a><p className="mt-1 leading-5 text-slate-500">{f.alcance}</p></li>)}</ul><p className="mt-4 border-t border-slate-100 pt-3 leading-5 text-slate-400">Referencia interna: docs/fase-4-matriz-trazabilidad.md · M01–M27. Revisión de fuentes {FECHA_REVISION_PILOTO}; no acredita vigencia para otras fechas.</p></details>
        </div>
      </div>
      <ScenarioBuilder datos={datos} firmaDatos={firma} habilitado={confirmado && composicionValida} validarDatosFormulario={() => formularioRef.current?.reportValidity() === true} />
      <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-slate-200 pt-5 text-[10px] leading-5 text-slate-400 sm:flex-row"><span>RP / RV · Herramienta de orientación para la mesa de asesoría</span><span className="max-w-xl sm:text-right">{AVISO_PILOTO}</span></footer>
    </main>
  </div>;
}
