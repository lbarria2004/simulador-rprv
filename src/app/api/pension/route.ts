import { validarReferenciaUF, UF_REFERENCIA_EJEMPLO } from '@/lib/moneda';
import { NextRequest, NextResponse } from 'next/server';
import {
  calcularRetiroProgramado,
  calcularEscenariosRetiroProgramado,
  ESCENARIOS_RENTABILIDAD_RP,
  AVISO_SIMULACION,
  calcularRVInmediata,
  calcularRVPeriodoGarantizado,
  calcularRVAumentoTemporal,
  calcularRVConAmbasClausulas,
  calcularPensionInvalidez,
  calcularRetiroProgramadoInvalidez,
  calcularRVInmediataInvalidez,
  calcularRVPeriodoGarantizadoInvalidez,
  calcularRVAumentoTemporalInvalidez,
  calcularRVConAmbasClausulasInvalidez,
  calcularPensionSobrevivencia,
  calcularOpcionesSobrevivencia,
  calcularRVInmediataSobrevivencia,
  calcularRVGarantizadoSobrevivencia,
  calcularRVAumentoSobrevivencia,
  calcularRVAmbasSobrevivencia,
  calcularRetiroProgramadoSobrevivencia,
  calcularExpectativaVida,
  Sexo,
  GradoInvalidez,
  MesesGarantizados,
  MesesAumento,
  TASAS_INTERES,
  EDAD_JUBILACION,
  ResultadoEscenario,
  BeneficiarioPension
} from '@/lib/pension-calculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tipo, datos } = body;
    if (!datos || typeof datos !== 'object') throw new RangeError('Se requieren datos del cálculo');
    if (datos.unidadMonetaria && datos.unidadMonetaria !== 'CLP_REALES') throw new RangeError('Los importes deben expresarse en CLP_REALES');
    if ('valorUF' in datos || 'uf' in datos) throw new RangeError('Use referenciaUF con valor, fecha y fuente');
    const referenciaUF = validarReferenciaUF('referenciaUF' in datos ? datos.referenciaUF : UF_REFERENCIA_EJEMPLO);

    const sexo = datos.sexo as Sexo;
    const edad = datos.edad as number;
    const fondos = datos.fondos as number;
    const beneficiarios = datos.beneficiarios as BeneficiarioPension[] | undefined;
    if (!Number.isFinite(fondos) || fondos < 0) throw new RangeError('Fondos deben ser CLP finitos y no negativos');
    if (!Number.isInteger(edad) || edad < 0 || edad > 110 || !['M', 'F'].includes(sexo)) throw new RangeError('Edad o sexo inválidos');
    if (beneficiarios !== undefined && !Array.isArray(beneficiarios)) throw new RangeError('Beneficiarios debe ser una lista');
    
    // Permitir tasas personalizadas o usar las por defecto
    const tasaInteres = datos.tasaTecnicaCNU ?? datos.tasaRP ?? datos.tasaInteres ?? TASAS_INTERES.RETIRO_PROGRAMADO;
    const tasaRV = datos.tasaRV ?? datos.tasaInteres ?? (String(tipo).startsWith('sobrevivencia') ? TASAS_INTERES.SOBREVIVENCIA : TASAS_INTERES.RENTA_VITALICIA_VEJEZ);
    if (![tasaInteres, tasaRV].every(tasa => Number.isFinite(tasa) && tasa > -1)) throw new RangeError('Tasa de descuento inválida');
    const opcionesRP = { rentabilidadRealAnual: datos.rentabilidadRealAnual, anoCalculo: datos.anoCalculo };

    let resultado: ResultadoEscenario;

    switch (tipo) {
      // ========== VEJEZ ==========
      case 'escenarios_rp':
        return NextResponse.json({
          success: true,
          aviso: AVISO_SIMULACION,
          resultados: calcularEscenariosRetiroProgramado(fondos, edad, sexo, tasaInteres, beneficiarios, datos.esInvalido ?? false, datos.anoCalculo, referenciaUF)
        });
      case 'retiro_programado':
        resultado = calcularRetiroProgramado(fondos, edad, sexo, tasaInteres, beneficiarios, datos.esInvalido ?? false, opcionesRP, referenciaUF);
        break;

      case 'inmediata':
        resultado = calcularRVInmediata(fondos, edad, sexo, tasaRV, beneficiarios, undefined, referenciaUF);
        break;

      case 'periodo_garantizado':
        resultado = calcularRVPeriodoGarantizado(
          fondos,
          edad,
          sexo,
          datos.mesesGarantizados as MesesGarantizados,
          tasaRV,
          beneficiarios, undefined, referenciaUF
        );
        break;

      case 'aumento_temporal':
        resultado = calcularRVAumentoTemporal(
          fondos,
          edad,
          sexo,
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          tasaRV,
          beneficiarios, undefined, referenciaUF
        );
        break;

      case 'ambas':
        resultado = calcularRVConAmbasClausulas(
          fondos,
          edad,
          sexo,
          datos.mesesGarantizados as MesesGarantizados,
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          tasaRV,
          beneficiarios, undefined, referenciaUF
        );
        break;

      // ========== INVALIDEZ ==========
      case 'invalidez':
        resultado = calcularPensionInvalidez(
          fondos,
          edad,
          sexo,
          (datos.gradoInvalidez || 'total') as GradoInvalidez,
          datos.ingresoBase || 800000, // Default si no se proporciona
          datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
          beneficiarios,
          datos.cubiertoSIS ?? true, referenciaUF
        );
        break;

      case 'invalidez_rp':
        resultado = calcularRetiroProgramadoInvalidez(
          fondos,
          edad,
          sexo,
          tasaInteres,
          beneficiarios,
          opcionesRP, referenciaUF
        );
        break;

      // ========== RENTA VITALICIA PARA INVALIDEZ ==========
      case 'invalidez_rv_inmediata':
        resultado = calcularRVInmediataInvalidez(
          fondos,
          edad,
          sexo,
          datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
          beneficiarios, referenciaUF
        );
        break;

      case 'invalidez_rv_garantizado':
        resultado = calcularRVPeriodoGarantizadoInvalidez(
          fondos,
          edad,
          sexo,
          datos.mesesGarantizados as MesesGarantizados,
          datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
          beneficiarios, referenciaUF
        );
        break;

      case 'invalidez_rv_aumento':
        resultado = calcularRVAumentoTemporalInvalidez(
          fondos,
          edad,
          sexo,
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
          beneficiarios, referenciaUF
        );
        break;

      case 'invalidez_rv_ambas':
        resultado = calcularRVConAmbasClausulasInvalidez(
          fondos,
          edad,
          sexo,
          datos.mesesGarantizados as MesesGarantizados,
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
          beneficiarios, referenciaUF
        );
        break;

      // ========== SOBREVIVENCIA ==========
      case 'sobrevivencia':
        resultado = calcularPensionSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          datos.tasaInteres ?? TASAS_INTERES.SOBREVIVENCIA,
          datos.cubiertoSIS ?? true, referenciaUF
        );
        break;

      case 'sobrevivencia_opciones':
        // Este caso retorna múltiples opciones
        const opciones = calcularOpcionesSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante, tasaInteres, tasaRV, referenciaUF, opcionesRP
        );
        return NextResponse.json({ success: true, aviso: AVISO_SIMULACION, resultados: opciones });

      case 'sobrevivencia_rp':
        resultado = calcularRetiroProgramadoSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          tasaInteres, referenciaUF, opcionesRP
        );
        break;

      case 'sobrevivencia_rv_inmediata':
        resultado = calcularRVInmediataSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          tasaRV, referenciaUF
        );
        break;

      case 'sobrevivencia_rv_garantizado':
        resultado = calcularRVGarantizadoSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.mesesGarantizados as MesesGarantizados,
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          tasaRV, referenciaUF
        );
        break;

      case 'sobrevivencia_rv_aumento':
        resultado = calcularRVAumentoSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          tasaRV, referenciaUF
        );
        break;

      case 'sobrevivencia_rv_ambas':
        resultado = calcularRVAmbasSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.mesesGarantizados as MesesGarantizados,
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          tasaRV, referenciaUF
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Tipo de cálculo no válido' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, aviso: AVISO_SIMULACION, resultado });
  } catch (error) {
    console.error('Error en cálculo:', error);
    return NextResponse.json(
      { success: false, error: 'Error al procesar el cálculo: ' + (error instanceof Error ? error.message : 'Error desconocido') },
      { status: error instanceof RangeError ? 400 : 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    aviso: AVISO_SIMULACION,
    parametros: {
      escenariosRentabilidadRP: ESCENARIOS_RENTABILIDAD_RP,
      tasasInteres: {
        retiroProgramado: (TASAS_INTERES.RETIRO_PROGRAMADO * 100).toFixed(2) + '%',
        rentaVitaliciaVejez: (TASAS_INTERES.RENTA_VITALICIA_VEJEZ * 100).toFixed(2) + '%',
        rentaVitaliciaInvalidez: (TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ * 100).toFixed(2) + '%',
        sobrevivencia: (TASAS_INTERES.SOBREVIVENCIA * 100).toFixed(2) + '%'
      },
      edadesJubilacion: EDAD_JUBILACION,
      ufReferencia: UF_REFERENCIA_EJEMPLO,
      tiposPension: {
        vejez: ['retiro_programado', 'inmediata', 'periodo_garantizado', 'aumento_temporal', 'ambas'],
        invalidez: ['invalidez', 'invalidez_rp'],
        sobrevivencia: ['sobrevivencia', 'sobrevivencia_opciones']
      },
      gradosInvalidez: [
        { value: 'total', label: 'Total (70%)', descripcion: 'Invalidez total - 70% del ingreso base' },
        { value: 'total_2_3', label: 'Total 2/3 (50%)', descripcion: 'Invalidez total 2/3 - 50% del ingreso base' },
        { value: 'parcial', label: 'Parcial (35%)', descripcion: 'Invalidez parcial - 35% del ingreso base' }
      ],
      porcentajesSobrevivencia: {
        conyugeSinHijos: '60%',
        conyugeConHijos: '50%',
        convivienteSinHijos: '60%',
        convivienteConHijos: '50%',
        hijo: '15% cada uno',
        padreMadre: '15% cada uno (si no hay cónyuge ni hijos)'
      },
      opciones: {
        mesesGarantizados: [60, 120, 180, 240, 300, 360],
        mesesAumento: [12, 24, 36, 48, 60, 84, 108, 120],
        porcentajesAumento: [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00]
      },
      fechaActualizacion: 'Enero 2025'
    }
  });
}
