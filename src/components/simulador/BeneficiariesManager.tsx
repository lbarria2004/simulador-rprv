'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Heart, 
  GraduationCap, 
  Accessibility, 
  ShieldCheck, 
  AlertCircle,
  Baby,
  UserCheck,
  Scale
} from 'lucide-react';
import { BeneficiarioPension, Sexo, TipoBeneficiario, calcularPorcentajesBeneficiarios } from '@/lib/pension-calculator';
import { calcularEdadDesdeFecha, calcularFechaDesdeEdad } from '@/lib/date-utils';

interface BeneficiariesManagerProps {
  beneficiarios: BeneficiarioPension[];
  onChange: (beneficiarios: BeneficiarioPension[]) => void;
}

interface ParentescoOpcion {
  id: string;
  tipo: TipoBeneficiario;
  label: string;
  sublabel: string;
  icono: React.ReactNode;
  sexoDefecto: Sexo;
  edadDefecto: number;
  esEstudiante?: boolean;
  esInvalido?: boolean;
  colorBorder: string;
  colorBg: string;
}

const OPCIONES_PARENTESCO: ParentescoOpcion[] = [
  {
    id: 'conyuge',
    tipo: 'conyuge',
    label: 'Cónyuge',
    sublabel: 'Esposo(a) legal (50%-60%)',
    icono: <Heart className="w-3.5 h-3.5 text-rose-500" />,
    sexoDefecto: 'F',
    edadDefecto: 62,
    colorBorder: 'hover:border-rose-300',
    colorBg: 'bg-rose-50/40 text-rose-900'
  },
  {
    id: 'conviviente',
    tipo: 'conviviente',
    label: 'Conviviente Civil',
    sublabel: 'Acuerdo Unión Civil (50%-60%)',
    icono: <UserCheck className="w-3.5 h-3.5 text-indigo-500" />,
    sexoDefecto: 'F',
    edadDefecto: 60,
    colorBorder: 'hover:border-indigo-300',
    colorBg: 'bg-indigo-50/40 text-indigo-900'
  },
  {
    id: 'hijo_menor',
    tipo: 'hijo',
    label: 'Hijo Menor (< 18)',
    sublabel: 'Soltero menor de 18 años (15%)',
    icono: <Baby className="w-3.5 h-3.5 text-blue-500" />,
    sexoDefecto: 'M',
    edadDefecto: 14,
    esEstudiante: false,
    colorBorder: 'hover:border-blue-300',
    colorBg: 'bg-blue-50/40 text-blue-900'
  },
  {
    id: 'hijo_estudiante',
    tipo: 'hijo',
    label: 'Hijo Estudiante (18-24)',
    sublabel: 'Cursos regulares reconocidos (15%)',
    icono: <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />,
    sexoDefecto: 'M',
    edadDefecto: 20,
    esEstudiante: true,
    colorBorder: 'hover:border-emerald-300',
    colorBg: 'bg-emerald-50/40 text-emerald-900'
  },
  {
    id: 'hijo_invalido',
    tipo: 'hijo',
    label: 'Hijo Inválido',
    sublabel: 'Dictamen Comisión Médica (15%)',
    icono: <Accessibility className="w-3.5 h-3.5 text-amber-500" />,
    sexoDefecto: 'M',
    edadDefecto: 28,
    esInvalido: true,
    colorBorder: 'hover:border-amber-300',
    colorBg: 'bg-amber-50/40 text-amber-900'
  },
  {
    id: 'madre_padre_nm',
    tipo: 'madre_padre_hijos_nm',
    label: 'Madre/Padre No Matrimonial',
    sublabel: 'Con hijos comunes reconocidos (30%-36%)',
    icono: <Users className="w-3.5 h-3.5 text-purple-500" />,
    sexoDefecto: 'F',
    edadDefecto: 50,
    colorBorder: 'hover:border-purple-300',
    colorBg: 'bg-purple-50/40 text-purple-900'
  },
  {
    id: 'padre_madre',
    tipo: 'padre',
    label: 'Padres del Causante',
    sublabel: 'Causante Asig. Familiar sin otros beneficiarios (15%)',
    icono: <Scale className="w-3.5 h-3.5 text-slate-500" />,
    sexoDefecto: 'M',
    edadDefecto: 85,
    colorBorder: 'hover:border-slate-300',
    colorBg: 'bg-slate-50 text-slate-800'
  }
];

export function BeneficiariesManager({
  beneficiarios,
  onChange
}: BeneficiariesManagerProps) {
  const defaultOption = OPCIONES_PARENTESCO[0];
  const [opcionSeleccionada, setOpcionSeleccionada] = useState<string>(defaultOption.id);
  const [nombre, setNombre] = useState<string>('');
  const [fechaNacimiento, setFechaNacimiento] = useState<string>(() => calcularFechaDesdeEdad(defaultOption.edadDefecto));
  const [sexo, setSexo] = useState<Sexo>(defaultOption.sexoDefecto);
  const [esEstudiante, setEsEstudiante] = useState<boolean>(false);
  const [esInvalido, setEsInvalido] = useState<boolean>(false);

  // Calcular edad en tiempo real basada en la fecha de nacimiento
  const edadCalculada = calcularEdadDesdeFecha(fechaNacimiento);

  // Manejar cambio de opción en la grilla
  const handleSelectOpcion = (opcion: ParentescoOpcion) => {
    setOpcionSeleccionada(opcion.id);
    setSexo(opcion.sexoDefecto);
    setFechaNacimiento(calcularFechaDesdeEdad(opcion.edadDefecto));
    setEsEstudiante(opcion.esEstudiante || false);
    setEsInvalido(opcion.esInvalido || false);
    if (!nombre) {
      setNombre(opcion.label);
    }
  };

  // Incorporar nuevo beneficiario a la lista
  const handleAgregarBeneficiario = () => {
    const opcion = OPCIONES_PARENTESCO.find(o => o.id === opcionSeleccionada) || defaultOption;
    
    // Determinar tipo real
    let tipoReal: TipoBeneficiario = opcion.tipo;
    if (opcion.id === 'padre_madre') {
      tipoReal = sexo === 'F' ? 'madre' : 'padre';
    }

    const nuevo: BeneficiarioPension = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      nombre: nombre.trim() || opcion.label,
      tipo: tipoReal,
      fechaNacimiento,
      edad: edadCalculada,
      sexo,
      porcentajePension: 0, // Se calcula dinámicamente según normativa
      esEstudiante: opcion.id === 'hijo_estudiante' ? true : esEstudiante,
      esInvalido: opcion.id === 'hijo_invalido' ? true : esInvalido
    };

    const nuevaLista = [...beneficiarios, nuevo];
    onChange(nuevaLista);

    // Resetear nombre para la siguiente incorporación
    setNombre('');
  };

  // Eliminar un beneficiario
  const handleEliminarBeneficiario = (idAEliminar?: string, indexAEliminar?: number) => {
    const filtrados = beneficiarios.filter((b, idx) => {
      if (idAEliminar && b.id) return b.id !== idAEliminar;
      return idx !== indexAEliminar;
    });
    onChange(filtrados);
  };

  // Cálculo de porcentajes legales y prorrateo de la lista actual
  const porcentajesCalculados = calcularPorcentajesBeneficiarios(beneficiarios);
  const sumaPorcentajesTeoricos = porcentajesCalculados.reduce((acc, r) => acc + r.porcentajeOriginal, 0);
  const hayProrrateo = sumaPorcentajesTeoricos > 1.0;

  return (
    <Card className="shadow-sm border-slate-200 overflow-hidden">
      <CardHeader className="pb-3 pt-4 px-4 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-indigo-600 text-white shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">
                Beneficiarios Legales de Pensión (D.L. 3.500)
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Cónyuge, conviviente, hijos y cargas legales para sobrevivencia
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] bg-white text-indigo-700 border-indigo-200 font-semibold">
            {beneficiarios.length} {beneficiarios.length === 1 ? 'Carga' : 'Cargas'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-4 py-4 space-y-4">
        {/* 1. GRILLA SELECTORA DE PARENTESCO LEGAL */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <span>1. Seleccionar Tipo de Beneficiario Legal</span>
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            {OPCIONES_PARENTESCO.map(opc => {
              const isSelected = opcionSeleccionada === opc.id;
              return (
                <button
                  key={opc.id}
                  type="button"
                  onClick={() => handleSelectOpcion(opc)}
                  className={`text-left p-2 rounded-lg border text-xs transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-600/30 font-medium'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                    {opc.icono}
                    <span className="truncate">{opc.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-1">
                    {opc.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. FORMULARIO DE INCORPORACIÓN DEL BENEFICIARIO */}
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Nombre o Identificador (opcional) */}
            <div className="sm:col-span-12 space-y-1">
              <Label className="text-xs text-slate-600">Nombre o Parentesco (Opcional)</Label>
              <Input
                type="text"
                placeholder="Ej: Cónyuge, Hijo Mayor, etc."
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="h-8 text-xs bg-white"
              />
            </div>

            {/* Fecha de Nacimiento */}
            <div className="sm:col-span-7 space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-600">Fecha de Nacimiento</Label>
                <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 font-semibold py-0 h-4">
                  {edadCalculada} años
                </Badge>
              </div>
              <Input
                type="date"
                value={fechaNacimiento}
                onChange={e => setFechaNacimiento(e.target.value)}
                className="h-8 text-xs bg-white font-mono"
              />
            </div>

            {/* Sexo */}
            <div className="sm:col-span-5 space-y-1">
              <Label className="text-xs text-slate-600">Sexo Legal</Label>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  type="button"
                  variant={sexo === 'F' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSexo('F')}
                  className={`h-8 text-xs ${sexo === 'F' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-white'}`}
                >
                  Mujer (F)
                </Button>
                <Button
                  type="button"
                  variant={sexo === 'M' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSexo('M')}
                  className={`h-8 text-xs ${sexo === 'M' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white'}`}
                >
                  Hombre (M)
                </Button>
              </div>
            </div>
          </div>

          {/* Condiciones Especiales (Invalidez y Estudios) */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200/60 text-xs text-slate-600">
            {opcionSeleccionada.startsWith('hijo') && (
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={esEstudiante}
                  onChange={e => setEsEstudiante(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Estudiante regular (hasta 24 años)</span>
              </label>
            )}

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={esInvalido}
                onChange={e => setEsInvalido(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
              />
              <span className="flex items-center gap-1">
                <span>Invalidez calificada</span>
                <Badge variant="outline" className="text-[9px] py-0 h-3.5 bg-amber-50 text-amber-800 border-amber-200 font-normal">
                  Tabla MI-2020
                </Badge>
              </span>
            </label>
          </div>

          {/* Botón Incorporar Beneficiario */}
          <Button
            type="button"
            onClick={handleAgregarBeneficiario}
            className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 mt-1"
          >
            <UserPlus className="w-4 h-4" />
            <span>Incorporar Beneficiario</span>
          </Button>
        </div>

        {/* 3. LISTA DE BENEFICIARIOS INCORPORADOS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Beneficiarios Incorporados al Cálculo</span>
            </Label>
            {beneficiarios.length > 0 && (
              <span className="text-[11px] text-slate-500 font-medium">
                Pensión Sobrevivencia: {Math.round(porcentajesCalculados.reduce((a, b) => a + b.porcentaje, 0) * 100)}%
              </span>
            )}
          </div>

          {beneficiarios.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50 space-y-1">
              <Users className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-medium text-slate-600">No hay beneficiarios incorporados</p>
              <p className="text-[11px] text-slate-400">
                La pensión se simulará como afiliado sin cargas legales de sobrevivencia.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {beneficiarios.map((ben, idx) => {
                const info = porcentajesCalculados[idx];
                const pctMostrar = info ? Math.round(info.porcentaje * 100) : 0;
                const pctOriginal = info ? Math.round(info.porcentajeOriginal * 100) : 0;

                return (
                  <div
                    key={ben.id || idx}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-md bg-slate-100 text-slate-700 flex-shrink-0">
                        {ben.tipo === 'conyuge' && <Heart className="w-3.5 h-3.5 text-rose-500" />}
                        {ben.tipo === 'conviviente' && <UserCheck className="w-3.5 h-3.5 text-indigo-500" />}
                        {ben.tipo === 'hijo' && (ben.esEstudiante ? <GraduationCap className="w-3.5 h-3.5 text-emerald-500" /> : ben.esInvalido ? <Accessibility className="w-3.5 h-3.5 text-amber-500" /> : <Baby className="w-3.5 h-3.5 text-blue-500" />)}
                        {ben.tipo === 'madre_padre_hijos_nm' && <Users className="w-3.5 h-3.5 text-purple-500" />}
                        {(ben.tipo === 'padre' || ben.tipo === 'madre') && <Scale className="w-3.5 h-3.5 text-slate-500" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-slate-900 truncate">
                            {ben.nombre || ben.tipo.toUpperCase()}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 h-4 border-slate-200 text-slate-600">
                            {ben.edad} años ({ben.sexo})
                          </Badge>
                          {ben.esEstudiante && (
                            <Badge variant="outline" className="text-[9px] py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200">
                              Estudiante
                            </Badge>
                          )}
                          {ben.esInvalido && (
                            <Badge variant="outline" className="text-[9px] py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                              Inválido
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Nac: {ben.fechaNacimiento || 'No registrada'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-bold text-indigo-700 font-mono block">
                          {pctMostrar}%
                        </span>
                        {hayProrrateo && (
                          <span className="text-[9px] text-slate-400 block line-through">
                            teórico {pctOriginal}%
                          </span>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEliminarBeneficiario(ben.id, idx)}
                        className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Eliminar beneficiario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Banner de Prorrateo si excede 100% */}
              {hayProrrateo && (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Prorrateo Legal Aplicado: </span>
                    La suma teórica de las pensiones de sobrevivencia era de{' '}
                    <strong>{Math.round(sumaPorcentajesTeoricos * 100)}%</strong>. Por ley (Art. 58 D.L. 3.500),
                    se prorratean proporcionalmente para no exceder el 100%.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
