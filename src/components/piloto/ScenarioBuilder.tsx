'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Copy, Layers, LockKeyhole, Pencil, Plus, Trash2 } from 'lucide-react';
import { CATALOGO_MODALIDADES, MAX_ESCENARIOS, modalidadEscenario, validarConfiguracionEscenario, type ConfiguracionEscenario, type ModalidadEscenario, type SeleccionEscenarios } from '@/lib/escenarios';

interface Props { value: SeleccionEscenarios; onChange: (value: SeleccionEscenarios) => void }
const estado = (m: ModalidadEscenario) => modalidadEscenario(m).calculable ? 'Calculable · estimativo' : 'Pendiente de validación actuarial';

export function ScenarioBuilder({ value, onChange }: Props) {
  const [modalidad, setModalidad] = useState<ModalidadEscenario>('rv_garantizada');
  const [nombre, setNombre] = useState('Escenario garantía');
  const [garantia, setGarantia] = useState('180');
  const [duracion, setDuracion] = useState('36');
  const [porcentaje, setPorcentaje] = useState('50');
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [comparar, setComparar] = useState(false);
  const secuencia = useRef(1);
  const nombreInput = useRef<HTMLInputElement>(null);
  const m = modalidadEscenario(modalidad);
  const seleccion = value.escenarios.filter(e => value.seleccionados.includes(e.id));
  const bloqueados = seleccion.filter(e => !modalidadEscenario(e.modalidad).calculable);
  const lleno = value.escenarios.length >= MAX_ESCENARIOS;
  const nuevoId = () => `escenario-${secuencia.current++}`;
  const configurar = (tipo: ModalidadEscenario) => {
    setModalidad(tipo); setNombre(`Escenario ${modalidadEscenario(tipo).nombre}`); setEditando(null); setError('');
    nombreInput.current?.focus();
  };
  const guardar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    try {
      if (lleno && !editando) throw new Error(`El límite es ${MAX_ESCENARIOS} escenarios. Elimine uno para agregar otro.`);
      const config = validarConfiguracionEscenario({ id: editando ?? nuevoId(), nombre, modalidad,
        ...(m.garantia ? { mesesGarantizados: garantia === '' ? NaN : Number(garantia) } : {}),
        ...(m.aumento ? { mesesAumento: duracion === '' ? NaN : Number(duracion), porcentajeAumento: porcentaje === '' ? NaN : Number(porcentaje) } : {}) });
      onChange({ escenarios: editando ? value.escenarios.map(e => e.id === editando ? config : e) : [...value.escenarios, config],
        seleccionados: editando ? value.seleccionados : [...value.seleccionados, config.id] });
      setEditando(null); setAviso(`Escenario ${editando ? 'actualizado' : 'agregado'}: ${config.nombre}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Configuración inválida.'); }
  };
  const editar = (e: ConfiguracionEscenario) => {
    setEditando(e.id); setNombre(e.nombre); setModalidad(e.modalidad);
    setGarantia(String(e.mesesGarantizados ?? 180)); setDuracion(String(e.mesesAumento ?? 36)); setPorcentaje(String(e.porcentajeAumento ?? 50));
    setError(''); nombreInput.current?.focus();
  };
  const duplicar = (e: ConfiguracionEscenario) => {
    if (lleno) return;
    let indice = 1;
    let nombreCopia: string;
    do {
      const sufijo = indice === 1 ? ' copia' : ` copia ${indice}`;
      nombreCopia = `${e.nombre.slice(0, 60 - sufijo.length)}${sufijo}`;
      indice++;
    } while (value.escenarios.some(s => s.nombre === nombreCopia));
    const copia = { ...e, id: nuevoId(), nombre: nombreCopia };
    onChange({ escenarios: [...value.escenarios, copia], seleccionados: [...value.seleccionados, copia.id] });
    setAviso(`Escenario duplicado: ${copia.nombre}.`);
  };
  const eliminar = (e: ConfiguracionEscenario) => {
    onChange({ escenarios: value.escenarios.filter(s => s.id !== e.id), seleccionados: value.seleccionados.filter(id => id !== e.id) });
    if (editando === e.id) setEditando(null);
    setAviso(`Escenario eliminado: ${e.nombre}.`); setError('');
  };

  return <section className="pilot-panel min-w-0 overflow-hidden" aria-label="Constructor de escenarios">
    <div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><Layers size={18} className="text-teal-700" /><h2 className="text-base font-semibold">Constructor de escenarios</h2></div><p className="mt-2 text-xs leading-5 text-slate-500">Compare configuraciones ficticias. Solo RP simple y RV inmediata teórica admiten estimaciones. Las cláusulas se pueden preparar sin calcular pensiones.</p></div>
    <div className="space-y-5 p-5">
      <div><h3 className="pilot-label">Catálogo de modalidades</h3><div className="grid gap-2 sm:grid-cols-2">{CATALOGO_MODALIDADES.map(c => <button key={c.id} type="button" onClick={() => configurar(c.id)} aria-label={`Configurar ${c.nombre}`} className={`rounded-xl border p-3 text-left transition hover:border-teal-600 ${modalidad === c.id ? 'border-teal-600 bg-teal-50/50' : 'border-slate-200'}`}><span className="block text-xs font-semibold">{c.nombre}</span><span className={`mt-1 block text-[10px] ${c.calculable ? 'text-teal-800' : 'text-amber-800'}`}>{estado(c.id)}</span></button>)}</div></div>

      <form onSubmit={guardar} aria-label="Configurar escenario" className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <h3 className="text-sm font-semibold">{editando ? 'Editar escenario' : 'Nuevo escenario'}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className="pilot-label" htmlFor="escenario-modalidad">Modalidad</label><select id="escenario-modalidad" className="pilot-input" value={modalidad} onChange={e => setModalidad(e.target.value as ModalidadEscenario)}>{CATALOGO_MODALIDADES.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          <div><label className="pilot-label" htmlFor="escenario-nombre">Nombre ficticio del escenario</label><input ref={nombreInput} id="escenario-nombre" className="pilot-input" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} required autoComplete="off" aria-describedby="escenario-privacidad" /></div>
          {m.garantia && <div><label className="pilot-label" htmlFor="escenario-garantia">Período garantizado · meses</label><input id="escenario-garantia" className="pilot-input" type="number" min="1" max="360" step="1" value={garantia} onChange={e => setGarantia(e.target.value)} required /></div>}
          {m.aumento && <><div><label className="pilot-label" htmlFor="escenario-duracion">Duración del aumento · meses</label><input id="escenario-duracion" className="pilot-input" type="number" min="1" max="120" step="1" value={duracion} onChange={e => setDuracion(e.target.value)} required /></div><div><label className="pilot-label" htmlFor="escenario-porcentaje">Aumento solicitado · %</label><input id="escenario-porcentaje" className="pilot-input" type="number" min="0.01" max="100" step="0.01" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} required /></div></>}
        </div>
        <p id="escenario-privacidad" className="mt-3 text-[11px] leading-5 text-slate-500">Use etiquetas como Escenario A. No ingrese nombres de personas, RUT ni aseguradoras. Las configuraciones duran solo mientras esta página permanece abierta.</p>
        <p className={`mt-2 text-[11px] leading-5 ${m.calculable ? 'text-teal-800' : 'text-amber-900'}`}>{m.motivo}</p>
        {(m.garantia || m.aumento) && <p className="mt-2 text-[10px] leading-4 text-slate-500">Límites técnicos del constructor: garantía 1–360 meses, aumento 1–120 meses y 0,01–100%. No acreditan límites legales, disponibilidad ni condiciones contractuales. RV combinada significa aquí garantía más aumento temporal.</p>}
        {error && <p role="alert" className="mt-3 text-xs text-red-800">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><button type="submit" className="pilot-small-button" disabled={lleno && !editando}><Plus size={14} />{editando ? 'Guardar cambios' : 'Agregar escenario'}</button>{editando && <button type="button" className="pilot-small-button" onClick={() => { setEditando(null); setError(''); }}>Cancelar edición</button>}</div>
      </form>

      <div><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Lista de escenarios <span className="text-xs font-normal text-slate-500">{value.escenarios.length}/{MAX_ESCENARIOS}</span></h3><button type="button" className="pilot-small-button" disabled={seleccion.length < 2} aria-expanded={comparar} aria-controls="comparacion-configuraciones" onClick={() => setComparar(!comparar)}>{comparar ? 'Ocultar comparación' : 'Comparar configuraciones'}</button></div>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">Marque los escenarios a comparar. Comparten la valoración y los supuestos de tasas del estudio; duplicar una modalidad simple conserva su monto estimativo.</p>
        {!value.escenarios.length && <p className="mt-3 rounded-lg border border-dashed p-4 text-xs text-slate-500">Sin escenarios. Agregue una configuración desde el constructor.</p>}
        <div className="mt-3 space-y-2">{value.escenarios.map(e => <article key={e.id} className="rounded-xl border border-slate-200 p-3" aria-label={`Escenario ${e.nombre}`}>
          <div className="flex items-start gap-3"><input id={`comparar-${e.id}`} type="checkbox" className="mt-1 shrink-0 accent-teal-700" checked={value.seleccionados.includes(e.id)} onChange={event => onChange({ ...value, seleccionados: event.target.checked ? [...value.seleccionados, e.id] : value.seleccionados.filter(id => id !== e.id) })} aria-label={`Comparar ${e.nombre}`} /><div className="min-w-0 flex-1"><label htmlFor={`comparar-${e.id}`} className="block cursor-pointer break-words text-xs font-semibold">{e.nombre}</label><p className="mt-1 text-[11px] text-slate-500">{modalidadEscenario(e.modalidad).nombre}</p><p className={`mt-1 text-[10px] ${modalidadEscenario(e.modalidad).calculable ? 'text-teal-800' : 'text-amber-800'}`}>{estado(e.modalidad)}</p></div></div>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="pilot-small-button" onClick={() => editar(e)} aria-label={`Editar ${e.nombre}`}><Pencil size={13} />Editar</button><button type="button" className="pilot-small-button" disabled={lleno} onClick={() => duplicar(e)} aria-label={`Duplicar ${e.nombre}`}><Copy size={13} />Duplicar</button><button type="button" className="pilot-small-button" onClick={() => eliminar(e)} aria-label={`Eliminar ${e.nombre}`}><Trash2 size={13} />Eliminar</button></div>
        </article>)}</div>
        {lleno && <p className="mt-3 text-xs text-amber-800">Límite de {MAX_ESCENARIOS} escenarios alcanzado. Puede editar o eliminar configuraciones.</p>}
      </div>

      <div className="text-xs leading-5" aria-live="polite"><p className="text-slate-500">{aviso}</p>{!seleccion.length ? <p className="text-amber-900">Seleccione al menos un escenario para calcular.</p> : bloqueados.length ? <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-900"><LockKeyhole size={15} className="mt-0.5 shrink-0" />{bloqueados.length} escenario(s) pendiente(s) seleccionado(s). Puede comparar configuraciones; desmárquelos para habilitar el cálculo y el PDF de los escenarios calculables.</p> : <p className="text-teal-800">{seleccion.length} escenario(s) calculable(s) seleccionado(s). Montos estimativos pendientes de validación especializada.</p>}</div>
      {comparar && seleccion.length >= 2 && <div id="comparacion-configuraciones" className="overflow-x-auto rounded-lg border border-slate-200" tabIndex={0} role="region" aria-label="Comparación de configuraciones">
        <table className="w-full min-w-[640px] text-left text-xs"><caption className="px-3 py-3 text-left text-[11px] text-slate-500">Configuraciones solicitadas. Sin pensiones ni factores contractuales para cláusulas pendientes.</caption><thead className="bg-slate-50 text-[10px] text-slate-600"><tr>{['Escenario / modalidad', 'Garantía (meses)', 'Aumento (meses)', 'Aumento (%)', 'Cálculo'].map(t => <th key={t} scope="col" className="p-3 font-medium">{t}</th>)}</tr></thead><tbody>{seleccion.map(e => <tr key={e.id} className="border-t border-slate-100"><th scope="row" className="max-w-52 break-words p-3 font-medium">{e.nombre}<span className="mt-1 block font-normal text-slate-500">{modalidadEscenario(e.modalidad).nombre}</span></th><td className="p-3">{e.mesesGarantizados ?? 'No aplica'}</td><td className="p-3">{e.mesesAumento ?? 'No aplica'}</td><td className="p-3">{e.porcentajeAumento === undefined ? 'No aplica' : `+${e.porcentajeAumento}%`}</td><td className="p-3">{estado(e.modalidad)}</td></tr>)}</tbody></table>
      </div>}
    </div>
  </section>;
}
