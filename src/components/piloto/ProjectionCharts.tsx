'use client';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { ResultadoPiloto } from '@/lib/piloto';

const colores = ['#8a98ab', '#087f75', '#4267c7'];
const nombres = ['Conservador · 0%', 'Base · 2%', 'Optimista · 4%'];
const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
export function ProjectionCharts({ resultado }: { resultado: ResultadoPiloto }) {
  if (!resultado.proyecciones.disponibles || !resultado.proyecciones.puntos.length || resultado.datos.beneficiarios.length) {
    return <section className="pilot-panel p-6" aria-label="Proyecciones restringidas">
      <div className="pilot-eyebrow">Alcance de la proyección</div>
      <h2 className="mt-2 text-lg font-semibold">Sin curvas para este caso</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{resultado.proyecciones.motivo}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">No se dibujan curvas familiares futuras, líneas RV sintéticas ni saldos de aseguradoras.</p>
    </section>;
  }
  return <section aria-label="Proyecciones financieras de RP" className="pilot-panel overflow-hidden">
    <div className="border-b border-slate-100 p-6 pb-4">
      <div className="pilot-eyebrow">Sensibilidad del ahorro propio</div>
      <h2 className="mt-2 text-lg font-semibold">Evolución financiera del Retiro Programado</h2>
      <p className="mt-2 text-xs leading-5 text-slate-500">Flujos calculados y comprobados. CLP reales de la fecha de valoración, sin inflación nominal. Son escenarios condicionados, no pronósticos ni fechas de fallecimiento.</p>
    </div>
    {(['Pension', 'Saldo'] as const).map(tipo => <div className="min-w-0 px-3 pt-5 sm:px-6" key={tipo}>
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{tipo === 'Pension' ? 'Pensión mensual · CLP reales' : 'Saldo AFP al inicio de cada año · CLP reales'}</h3>
      <div className="h-60 w-full" data-testid={`grafico-${tipo.toLowerCase()}`} role="img" aria-label={tipo === 'Pension' ? 'Curvas de pensión mensual RP calculada' : 'Curvas de saldo AFP calculado'}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={resultado.proyecciones.puntos} margin={{ top: 8, right: 10, left: 0, bottom: 4 }} accessibilityLayer>
            <CartesianGrid stroke="#e9edf2" vertical={false} />
            <XAxis dataKey="ano" axisLine={false} tickLine={false} minTickGap={24} tick={{ fill: '#6c7b8d', fontSize: 10 }} />
            <YAxis width={65} axisLine={false} tickLine={false} tick={{ fill: '#6c7b8d', fontSize: 10 }} tickFormatter={v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)} M` : clp(v)} />
            <Tooltip formatter={(valor) => clp(Number(valor))} labelFormatter={v => `Año ${v}`} contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            {['conservador', 'base', 'optimista'].map((escenario, i) => <Line key={escenario} type="linear" dataKey={`${escenario}${tipo}`} name={nombres[i]} stroke={colores[i]} strokeWidth={escenario === resultado.datos.escenarioRP ? 2.6 : 1.6} dot={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>)}
    <details className="m-6 rounded-lg border border-slate-200 text-xs">
      <summary className="cursor-pointer px-4 py-3 font-medium text-slate-600">Ver datos numéricos de las curvas</summary>
      <div className="max-h-80 overflow-auto border-t border-slate-100">
        <table className="w-full whitespace-nowrap text-right tabular-nums"><caption className="sr-only">Datos calculados de pensión y saldo RP por escenario, en CLP reales</caption>
          <thead className="sticky top-0 bg-slate-50"><tr>{['Año', 'Edad', 'Pensión 0%', 'Pensión 2%', 'Pensión 4%', 'Saldo 0%', 'Saldo 2%', 'Saldo 4%'].map(t => <th className="px-3 py-3 font-medium" key={t}>{t}</th>)}</tr></thead>
          <tbody>{resultado.proyecciones.puntos.map(p => <tr key={p.ano} className="border-t border-slate-100">{[p.ano, p.edad, ...[p.conservadorPension, p.basePension, p.optimistaPension, p.conservadorSaldo, p.baseSaldo, p.optimistaSaldo].map(clp)].map((v, i) => <td className="px-3 py-2" key={i}>{v}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
    <p className="border-t border-slate-100 px-6 py-4 text-xs leading-5 text-slate-500">No se proyecta una RV: su monto es una estimación inicial teórica, sin oferta comercial. El CNU y las tasas conservan las limitaciones indicadas en este estudio.</p>
  </section>;
}
