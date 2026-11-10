'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Copy, Pencil, Plus, Trash2, LockKeyhole, SlidersHorizontal, LoaderCircle } from 'lucide-react';
import { CATALOGO_MODALIDADES, MAX_ESCENARIOS, escenarioInicial, modalidadEscenario, validarListaEscenarios,
  type EscenarioCotizacion, type ModalidadEscenario, type ComparacionEscenarios } from '@/lib/escenarios';
import { ESCENARIOS_RENTABILIDAD_RP } from '@/lib/pension-calculator';

type Borrador = Omit<EscenarioCotizacion, 'mesesGarantizados' | 'mesesAumento' | 'porcentajeAumento' | 'tasaSensibilidad'> & {
  mesesGarantizados: string; mesesAumento: string; porcentajeAumento: string; tasaSensibilidad: string;
};
function aBorrador(e: EscenarioCotizacion): Borrador {
  return { ...e, mesesGarantizados: String(e.mesesGarantizados), mesesAumento: String(e.mesesAumento),
    porcentajeAumento: String(e.porcentajeAumento), tasaSensibilidad: e.tasaSensibilidad === null ? '' : (e.tasaSensibilidad * 100).toFixed(2) };
}
const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const porcentaje = (n: number) => `${(n * 100).toFixed(2)}%`;

export function ScenarioBuilder({ datos, firmaDatos, habilitado, validarDatosFormulario }: {
  datos: unknown; firmaDatos: string; habilitado: boolean; validarDatosFormulario: () => boolean;
}) {
  const [lista, setLista] = useState<EscenarioCotizacion[]>([
    escenarioInicial('esc-1', 'retiro_programado', 'RP de referencia'),
    escenarioInicial('esc-2', 'rv_inmediata', 'RV simple de referencia'),
  ]);
  const [seleccion, setSeleccion] = useState(['esc-1', 'esc-2']);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [editando, setEditando] = useState(false);
  const [errorEditor, setErrorEditor] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [estudio, setEstudio] = useState<{ firma: string; resultados: ComparacionEscenarios['resultados'] } | null>(null);
  const contador = useRef(3);
  const editorRef = useRef<HTMLDivElement>(null);
  const elegidos = lista.filter(e => seleccion.includes(e.id));
  const calculables = elegidos.filter(e => modalidadEscenario(e.modalidad).calculable);
  const firma = JSON.stringify({ firmaDatos, lista, seleccion });
  const vigente = estudio?.firma === firma && !borrador;
  const resultados = vigente ? estudio.resultados : [];
  const abrir = (e: EscenarioCotizacion, esEdicion: boolean) => {
    setBorrador(aBorrador(e)); setEditando(esEdicion); setErrorEditor(''); setError('');
    editorRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const nuevo = (modalidad: ModalidadEscenario) => {
    if (lista.length >= MAX_ESCENARIOS) return;
    const numero = contador.current++;
    abrir(escenarioInicial(`esc-${numero}`, modalidad, `Escenario ${numero}`), false);
  };
  const actualizar = (cambios: Partial<Borrador>) => setBorrador(borrador ? { ...borrador, ...cambios } : null);
  const guardar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault(); if (!borrador) return;
    try {
      const convertido = { ...borrador, mesesGarantizados: Number(borrador.mesesGarantizados),
        mesesAumento: Number(borrador.mesesAumento), porcentajeAumento: Number(borrador.porcentajeAumento),
        tasaSensibilidad: borrador.supuestoTasa === 'sensibilidad' ? Number(borrador.tasaSensibilidad) / 100 : null };
      const nuevaLista = editando ? lista.map(e => e.id === convertido.id ? convertido : e) : [...lista, convertido];
      setLista(validarListaEscenarios(nuevaLista));
      if (!editando) setSeleccion([...seleccion, convertido.id]);
      setBorrador(null); setErrorEditor('');
    } catch (e) { setErrorEditor(e instanceof Error ? e.message : 'Revise la configuración.'); }
  };
  const duplicar = (e: EscenarioCotizacion) => {
    if (lista.length >= MAX_ESCENARIOS) return;
    let n = 1, nombre = '';
    do { nombre = `${e.nombre.slice(0, 45)} copia ${n++}`; } while (lista.some(s => s.nombre.toLocaleLowerCase('es-CL') === nombre.toLocaleLowerCase('es-CL')));
    const copia = { ...e, id: `esc-${contador.current++}`, nombre };
    setLista([...lista, copia]); setSeleccion([...seleccion, copia.id]);
  };
  const comparar = async () => {
    if (borrador || !elegidos.length) return;
    if (calculables.length && (!habilitado || !validarDatosFormulario())) return;
    setError(''); setEstudio(null);
    if (!calculables.length) { setEstudio({ firma, resultados: [] }); return; }
    setCargando(true);
    try {
      const response = await fetch('/api/escenarios', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos, escenarios: calculables }) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'No fue posible comparar.');
      setEstudio({ firma, resultados: body.resultado.resultados });
    } catch (e) { setError(e instanceof Error ? e.message : 'Error del servicio local.'); }
    finally { setCargando(false); }
  };
  const garantia = borrador && ['rv_garantizada', 'rv_combinada'].includes(borrador.modalidad);
  const aumento = borrador && ['rv_aumento', 'rv_combinada'].includes(borrador.modalidad);

  return <section id="constructor-escenarios" className="mt-10 scroll-mt-5 space-y-5" aria-labelledby="titulo-constructor">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-teal-700">Configuraciones personalizadas</p>
        <h2 id="titulo-constructor" className="text-2xl font-semibold tracking-tight text-[#172c40]">Constructor de escenarios</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Compare modalidades y supuestos con los datos ficticios del estudio. Configurar una cláusula no habilita su cálculo ni constituye una cotización comercial. Aquí se comparan montos iniciales; las curvas y el PDF superiores corresponden al estudio base.</p></div>
      <a href="#datos-estudio" className="pilot-small-button shrink-0">Revisar datos y tasas del estudio</a>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" role="region" aria-label="Catálogo de modalidades">
      {CATALOGO_MODALIDADES.map(m => <article key={m.id} className="pilot-panel flex flex-col p-4">
        <span className={`mb-3 self-start rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${m.calculable ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-900'}`}>{m.calculable ? 'Estimación habilitada' : 'Pendiente actuarial'}</span>
        <h3 className="text-sm font-semibold text-slate-800">{m.nombre}</h3><p className="mb-4 mt-2 flex-1 text-[11px] leading-5 text-slate-500">{m.motivo}</p>
        <button type="button" className="pilot-small-button w-full" aria-label={`Configurar ${m.nombre}`} disabled={lista.length >= MAX_ESCENARIOS || cargando || !!borrador} onClick={() => nuevo(m.id)}><Plus size={13} />Configurar</button>
      </article>)}
    </div>

    <div className="rounded-xl border border-slate-200 bg-white/60 p-4 text-xs leading-6 text-slate-600">
      <strong>Tasas separadas.</strong> La tasa técnica de referencia se toma del estudio y continúa siendo una hipótesis de cálculo. Una sensibilidad modifica solo el descuento del escenario. El retorno AFP 0/2/4% sigue siendo un supuesto distinto. <strong>No hay tasas comerciales ni ofertas de aseguradoras.</strong>
    </div>

    <div ref={editorRef} className="scroll-mt-5">
      {borrador && <form className="pilot-panel p-5 sm:p-6" aria-label="Editor de escenario" onSubmit={guardar}>
        <div className="mb-5 flex items-center gap-2"><SlidersHorizontal size={17} className="text-teal-700" /><h3 className="font-semibold">{editando ? 'Editar escenario' : 'Nuevo escenario'}</h3></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2"><label className="pilot-label" htmlFor="esc-nombre">Nombre descriptivo del escenario</label><input id="esc-nombre" className="pilot-input" value={borrador.nombre} onChange={e => actualizar({ nombre: e.target.value })} required maxLength={60} autoComplete="off" /><p className="mt-1 text-[10px] text-slate-400">Sin nombres de personas, RUT ni información de clientes.</p></div>
          <div className="sm:col-span-2"><label className="pilot-label" htmlFor="esc-modalidad">Modalidad del escenario</label><select className="pilot-input" id="esc-modalidad" value={borrador.modalidad} onChange={e => {
            const inicial = escenarioInicial(borrador.id, e.target.value as ModalidadEscenario, borrador.nombre);
            setBorrador(aBorrador(inicial));
          }}>{CATALOGO_MODALIDADES.map(m => <option value={m.id} key={m.id}>{m.nombre}</option>)}</select><p className="mt-1 text-[10px] text-slate-400">Cambiar modalidad restablece cláusulas y sensibilidad.</p></div>
          {garantia && <div><label className="pilot-label" htmlFor="esc-garantia">Período garantizado · meses</label><input className="pilot-input" type="number" id="esc-garantia" min={1} max={600} step={1} required value={borrador.mesesGarantizados} onChange={e => actualizar({ mesesGarantizados: e.target.value })} /></div>}
          {aumento && <><div><label className="pilot-label" htmlFor="esc-aumento">Duración del aumento · meses</label><input className="pilot-input" type="number" id="esc-aumento" min={1} max={600} step={1} required value={borrador.mesesAumento} onChange={e => actualizar({ mesesAumento: e.target.value })} /></div>
            <div><label className="pilot-label" htmlFor="esc-porcentaje">Porcentaje de aumento · %</label><input className="pilot-input" type="number" id="esc-porcentaje" min={.01} max={100} step={.01} required value={borrador.porcentajeAumento} onChange={e => actualizar({ porcentajeAumento: e.target.value })} /></div></>}
          <div><label className="pilot-label" htmlFor="esc-tasa-tipo">Supuesto de tasa</label><select id="esc-tasa-tipo" className="pilot-input" value={borrador.supuestoTasa} onChange={e => actualizar({ supuestoTasa: e.target.value as EscenarioCotizacion['supuestoTasa'], tasaSensibilidad: '' })}><option value="referencia">Referencia técnica del estudio</option><option value="sensibilidad">Sensibilidad hipotética</option></select></div>
          {borrador.supuestoTasa === 'sensibilidad' && <div><label className="pilot-label" htmlFor="esc-tasa">Descuento de sensibilidad · % real anual</label><input className="pilot-input" type="number" id="esc-tasa" min={0} max={10} step={.01} value={borrador.tasaSensibilidad} required onChange={e => actualizar({ tasaSensibilidad: e.target.value })} /></div>}
          {borrador.modalidad === 'retiro_programado' && <div><label className="pilot-label" htmlFor="esc-retorno">Rentabilidad real AFP hipotética</label><select id="esc-retorno" className="pilot-input" value={borrador.escenarioRP} onChange={e => actualizar({ escenarioRP: e.target.value as EscenarioCotizacion['escenarioRP'] })}><option value="conservador">Conservador · 0%</option><option value="base">Base · 2%</option><option value="optimista">Optimista · 4%</option></select></div>}
        </div>
        {!modalidadEscenario(borrador.modalidad).calculable && <p role="note" className="mt-5 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-950">Solo configuración: sin pensión ni PDF. Los rangos son límites operativos, no admisibilidad contractual ni normativa. {modalidadEscenario(borrador.modalidad).motivo}</p>}
        {errorEditor && <p role="alert" className="mt-4 text-sm text-red-700">{errorEditor}</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button type="submit" className="rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white">Guardar escenario</button><button type="button" className="pilot-small-button" onClick={() => { setBorrador(null); setErrorEditor(''); }}>Cancelar edición</button></div>
      </form>}
    </div>

    <div className="pilot-panel p-5 sm:p-6" aria-label="Lista de escenarios">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Mis escenarios <span className="text-xs font-normal text-slate-400">{lista.length}/{MAX_ESCENARIOS}</span></h3><p className="text-[11px] text-slate-500">Solo en memoria; no se guardan al recargar.</p></div>
      {!lista.length && <p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">Sin escenarios. Agregue una configuración desde el catálogo.</p>}
      <div className="grid gap-3 lg:grid-cols-2">{lista.map(e => {
        const m = modalidadEscenario(e.modalidad);
        return <article key={e.id} className="min-w-0 rounded-xl border border-slate-200 p-4" data-testid={`escenario-${e.id}`}>
          <div className="flex items-start gap-3"><input type="checkbox" className="mt-1 accent-teal-700" aria-label={`Comparar ${e.nombre}`} checked={seleccion.includes(e.id)} disabled={cargando || !!borrador} onChange={evento => setSeleccion(evento.target.checked ? [...seleccion, e.id] : seleccion.filter(id => id !== e.id))} />
            <div className="min-w-0 flex-1"><h4 className="break-words text-sm font-semibold text-slate-800">{e.nombre}</h4><p className="mt-1 text-xs text-slate-500">{m.nombre}</p></div><span className={`rounded px-2 py-1 text-[9px] font-semibold ${m.calculable ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-900'}`}>{m.calculable ? 'Estimativo' : 'Sin cálculo'}</span></div>
          <p className="mt-3 break-words text-[11px] leading-5 text-slate-500">Garantía: {e.mesesGarantizados} meses · Aumento: {e.mesesAumento} meses / {e.porcentajeAumento}%<br />{e.supuestoTasa === 'referencia' ? 'Descuento de referencia del estudio' : `Sensibilidad ${porcentaje(e.tasaSensibilidad!)} real anual`}{e.modalidad === 'retiro_programado' ? ` · Retorno AFP ${e.escenarioRP}` : ' · Sin retorno AFP'}</p>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="pilot-small-button" aria-label={`Editar ${e.nombre}`} disabled={cargando || !!borrador} onClick={() => abrir(e, true)}><Pencil size={12} />Editar</button><button type="button" className="pilot-small-button" aria-label={`Duplicar ${e.nombre}`} disabled={lista.length >= MAX_ESCENARIOS || cargando || !!borrador} onClick={() => duplicar(e)}><Copy size={12} />Duplicar</button><button type="button" className="pilot-small-button" aria-label={`Eliminar ${e.nombre}`} disabled={cargando || !!borrador} onClick={() => { setLista(lista.filter(s => s.id !== e.id)); setSeleccion(seleccion.filter(id => id !== e.id)); }}><Trash2 size={12} />Eliminar</button></div>
        </article>;
      })}</div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"><button type="button" className="flex items-center justify-center gap-2 rounded-lg bg-[#126e67] px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300" disabled={cargando || !!borrador || !elegidos.length || (calculables.length > 0 && !habilitado)} onClick={comparar}>{cargando && <LoaderCircle className="animate-spin" size={15} />}Comparar seleccionados</button><p className="text-[11px] leading-5 text-slate-500">{elegidos.length} seleccionados · {calculables.length} calculables como estimación.<br />Las cláusulas solo se comparan por configuración. Confirme datos ficticios para calcular.</p></div>
    </div>

    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {estudio && !vigente && <p role="status" className="rounded-lg bg-amber-50 p-4 text-xs text-amber-950">Configuraciones o datos modificados. Compare nuevamente para actualizar; no se muestran montos anteriores.</p>}
    {vigente && <section className="pilot-panel overflow-hidden" aria-label="Comparación de escenarios" data-testid="comparacion-escenarios">
      <div className="p-5"><h3 className="font-semibold">Comparación de configuraciones y estimaciones</h3><p className="mt-2 text-xs leading-6 text-slate-500">Montos iniciales brutos en CLP y UF reales del estudio. No hay ranking ni recomendación comercial. La sensibilidad no es una tasa ofertada.</p></div>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de escenarios, desplazable horizontalmente">
        <table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{['Escenario / modalidad', 'Cláusulas configuradas', 'Tasas reales anuales', 'Pensión inicial', 'Estado'].map(t => <th className="px-5 py-3" key={t}>{t}</th>)}</tr></thead>
          <tbody>{elegidos.map(e => {
            const m = modalidadEscenario(e.modalidad), r = resultados.find(s => s.id === e.id);
            return <tr key={e.id} className="border-t border-slate-100 align-top" data-testid={`comparado-${e.id}`}><td className="max-w-60 break-words px-5 py-4"><strong>{e.nombre}</strong><p className="mt-2 leading-5 text-slate-500">{m.nombre}</p></td><td className="px-5 py-4 leading-6">Garantía {e.mesesGarantizados} meses<br />Aumento {e.mesesAumento} meses / {e.porcentajeAumento}%</td><td className="px-5 py-4 leading-6">{r ? <>Técnica base: {porcentaje(r.tasaTecnicaBase)}<br />Aplicada: {porcentaje(r.tasaDescuento)}<br />{r.supuestoTasa === 'sensibilidad' ? 'Sensibilidad hipotética' : 'Referencia del estudio'}<br />{r.escenarioRP ? `Retorno AFP: ${porcentaje(ESCENARIOS_RENTABILIDAD_RP[r.escenarioRP].rentabilidadRealAnual)}` : 'Sin retorno AFP'}</> : <>Sin tasa de cálculo<br />{e.supuestoTasa === 'sensibilidad' ? `Hipótesis guardada: ${porcentaje(e.tasaSensibilidad!)}` : 'Referencia del estudio'}<br />Sin tasa comercial</>}</td><td className="px-5 py-4 tabular-nums">{m.calculable && r ? <><strong>{pesos(r.pensionMensual)}</strong> CLP<br /><span className="mt-2 block text-teal-800">{r.pensionEnUF.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF</span></> : <span className="text-amber-900">Sin cálculo</span>}</td><td className="max-w-72 px-5 py-4 leading-5">{m.calculable && r ? <><span className="font-semibold text-teal-800">Aproximación documentada</span><p className="mt-2 text-slate-500">Pendiente de validación especializada individual.</p></> : <><span className="flex items-center gap-1 font-semibold text-amber-900"><LockKeyhole size={12} />Pendiente actuarial</span><p className="mt-2 text-slate-500">{m.motivo}</p></>}</td></tr>;
          })}</tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-5 py-4 text-[11px] leading-6 text-slate-500">El PDF del estudio inicial se conserva por separado y no exporta esta lista ni sus sensibilidades. No hay exportación de cláusulas. Para obtener un informe base, vuelva a calcular el estudio inicial con sus propios supuestos explícitos.</p>
    </section>}
  </section>;
}
