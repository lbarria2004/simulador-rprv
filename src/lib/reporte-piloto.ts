/** PDF del piloto: siempre recalcula desde entradas sometidas a la misma política que la API. */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { calcularPiloto, leerSolicitudPiloto, LIMITACION_CNU, AVISO_TASA_RP_HISTORICA, type PuntoPiloto } from './piloto.ts';
import { clpAUf } from './moneda.ts';

const navy = rgb(.075, .16, .24), teal = rgb(.035, .42, .39), slate = rgb(.32, .39, .46), light = rgb(.94, .96, .97);
const colores = [rgb(.49, .56, .65), teal, rgb(.23, .40, .77)];
const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const porcentaje = (n: number) => `${(n * 100).toFixed(2)}%`;

export async function generarReportePilotoPDF(body: unknown): Promise<Uint8Array> {
  const resultado = calcularPiloto(leerSolicitudPiloto(body, true));
  const { datos: d, comparacion } = resultado;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`RP / RV · Piloto interno · ${d.caso}`);
  pdf.setSubject('Estimación con datos ficticios. Sin certificación normativa ni oferta comercial.');
  pdf.setAuthor('Simulador RP / RV · Piloto interno');
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const paginas: PDFPage[] = [];
  let page: PDFPage;
  let y = 0;
  const texto = (s: string, x: number, top: number, size = 10, font: PDFFont = normal, color = navy) => page.drawText(s, { x, y: top, size, font, color });
  const lineas = (s: string, ancho: number, size = 10, font = normal): string[] => {
    const salida: string[] = []; let actual = '';
    for (const palabra of s.split(/\s+/)) {
      if (font.widthOfTextAtSize(`${actual} ${palabra}`.trim(), size) > ancho && actual) { salida.push(actual); actual = ''; }
      if (font.widthOfTextAtSize(palabra, size) > ancho) {
        for (const c of palabra) {
          if (font.widthOfTextAtSize(actual + c, size) > ancho) { salida.push(actual); actual = ''; }
          actual += c;
        }
      } else actual = `${actual} ${palabra}`.trim();
    }
    if (actual) salida.push(actual);
    return salida;
  };
  const nueva = (titulo: string, subtitulo: string) => {
    page = pdf.addPage([595.28, 841.89]); paginas.push(page); y = 745;
    page.drawRectangle({ x: 0, y: 792, width: 596, height: 50, color: navy });
    texto('RP / RV', 42, 812, 17, bold, rgb(1, 1, 1));
    texto('PILOTO INTERNO  /  DATOS FICTICIOS', 270, 814, 8, bold, rgb(.68, .87, .84));
    texto(titulo, 42, 765, 20, bold);
    let subtituloY = 745;
    for (const linea of lineas(subtitulo, 511, 9)) { texto(linea, 42, subtituloY, 9, normal, slate); subtituloY -= 13; }
    y = subtituloY - 13;
  };
  const parrafo = (s: string, size = 9, color = slate) => {
    for (const linea of lineas(s, 511, size)) { if (y < 83) nueva('Continuación del informe', `Caso ${d.caso} · Valoración ${d.fechaValoracion}`); texto(linea, 42, y, size, normal, color); y -= size + 4; }
    y -= 5;
  };
  const titulo = (s: string) => { if (y < 115) nueva('Continuación del informe', `Caso ${d.caso} · Valoración ${d.fechaValoracion}`); y -= 7; texto(s, 42, y, 11, bold); y -= 21; };
  const tabla = (filas: string[][], anchos: number[]) => {
    const altoTotal = filas.reduce((suma, fila, i) => suma + Math.max(...fila.map((c, j) => lineas(c, anchos[j] - 14, 8.5, i ? normal : bold).length)) * 12 + 12, 0);
    if (y - altoTotal < 83) nueva('Detalle del estudio', `Caso ${d.caso} · Valoración ${d.fechaValoracion}`);
    filas.forEach((fila, i) => {
      let x = 42;
      const contenido = fila.map((celda, c) => lineas(celda, anchos[c] - 14, 8.5, i ? normal : bold));
      const alto = Math.max(...contenido.map(c => c.length)) * 12 + 12;
      page.drawRectangle({ x: 42, y: y - alto + 7, width: anchos.reduce((a, b) => a + b, 0), height: alto, color: i ? (i % 2 ? light : rgb(1, 1, 1)) : navy });
      contenido.forEach((ls, c) => {
        ls.forEach((l, j) => texto(l, x + 7, y - 9 - j * 12, 8.5, i ? normal : bold, i ? navy : rgb(1, 1, 1)));
        x += anchos[c];
      }); y -= alto;
    }); y -= 12;
  };
  nueva('Comparación previsional orientativa', `Caso ${d.caso}  |  Valoración ${d.fechaValoracion}  |  Perfil ${resultado.perfil}`);
  page!.drawRectangle({ x: 42, y: y - 49, width: 511, height: 57, color: light });
  texto('ESTIMACIÓN / NO ES OFERTA COMERCIAL', 53, y - 7, 10, bold, teal);
  texto('Sin certificación normativa. Montos pendientes de validación especializada.', 53, y - 25, 8.5);
  y -= 74;
  tabla([
    ['Dato de valoración', 'Supuesto del ejercicio'],
    ['Afiliado hipotético', `${d.sexo === 'M' ? 'Hombre' : 'Mujer'}, ${d.edad} años enteros declarados`],
    ['Ahorro propio AFP', `${pesos(d.fondos)} CLP / ${clpAUf(d.fondos, d.referenciaUF).toFixed(2)} UF`],
    ['UF de referencia', `${d.referenciaUF.valor.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} CLP por UF, fecha ${d.referenciaUF.fecha}`],
    ['Fuente UF declarada', d.referenciaUF.fuente],
    ['Descuentos reales anuales', `RP ${porcentaje(d.tasaTecnicaCNU)} / RV teórica ${porcentaje(d.tasaRV)}`],
    ['Retorno AFP seleccionado', `${d.escenarioRP}: ${porcentaje(resultado.escenarios.find(e => e.id === d.escenarioRP)!.rentabilidadRealAnual)} real anual hipotético`]
  ], [160, 351]);
  titulo('Comparación inicial · montos brutos');
  tabla([
    ['Modelo estimativo', 'CLP / mes', 'UF / mes', 'CNU aprox.'],
    ['Retiro Programado simple', pesos(comparacion.rp.pensionMensual), comparacion.rp.pensionEnUF.toFixed(2), comparacion.rp.cnu.toFixed(4)],
    ['RV inmediata teórica, sin aseguradora', pesos(comparacion.rv.pensionMensual), comparacion.rv.pensionEnUF.toFixed(2), comparacion.rv.cnu.toFixed(4)]
  ], [211, 110, 90, 100]);
  parrafo('Los montos no incluyen salud, impuestos, comisiones, SIS ni beneficios estatales. La RV es un ejemplo financiero, no una renta ofrecida o garantizada. No se recomienda una modalidad solo por esta comparación.');
  parrafo(LIMITACION_CNU);
  if (d.beneficiarios.length) {
    titulo('Grupo familiar hipotético · solo situación inicial');
    tabla([['Persona', 'Edad / sexo', 'Porcentaje de referencia actual'], ...resultado.porcentajesActuales.map(b => [b.tipo === 'conyuge' ? 'Cónyuge' : 'Hijo/a común', `${b.edad} / ${b.sexo}`, porcentaje(b.porcentaje)])], [160, 110, 241]);
    parrafo('Vínculos, estudios y requisitos son supuestos declarados; no acreditan derecho a pensión. Curvas familiares futuras bloqueadas.');
  }

  nueva('Escenarios y alcance de la proyección', 'Rentabilidad real AFP separada de la tasa de descuento del CNU');
  tabla([['Escenario RP', 'Retorno real anual', 'Pensión inicial (CLP)'], ...resultado.escenarios.map(e => [e.nombre, porcentaje(e.rentabilidadRealAnual), pesos(e.pensionInicial)])], [180, 160, 171]);
  parrafo(resultado.proyecciones.motivo);
  if (resultado.proyecciones.disponibles) {
    const puntos = resultado.proyecciones.puntos;
    const grafico = (nombre: string, campos: (keyof PuntoPiloto)[]) => {
      if (y < 290) nueva('Evolución financiera RP', `Caso ${d.caso} · Flujos calculados, sin proyección familiar`);
      titulo(nombre);
      const x0 = 86, w = 452, h = 128, arriba = y - 8, abajo = arriba - h;
      const maximo = Math.max(1, ...puntos.flatMap(p => campos.map(k => p[k])));
      for (let t = 0; t <= 4; t++) {
        const yy = abajo + t / 4 * h;
        page.drawLine({ start: { x: x0, y: yy }, end: { x: x0 + w, y: yy }, color: rgb(.85, .89, .91), thickness: .5 });
        texto(`${(maximo * t / 4 / 1e6).toFixed(1)} M`, 43, yy - 3, 7, normal, slate);
      }
      campos.forEach((campo, c) => {
        for (let i = 1; i < puntos.length; i++) {
          page.drawLine({ start: { x: x0 + (i - 1) / (puntos.length - 1) * w, y: abajo + puntos[i - 1][campo] / maximo * h },
            end: { x: x0 + i / (puntos.length - 1) * w, y: abajo + puntos[i][campo] / maximo * h }, color: colores[c], thickness: 1.5 });
        }
      });
      for (let i = 0; i <= 4; i++) {
        const p = puntos[Math.round((puntos.length - 1) * i / 4)];
        texto(String(p.ano), x0 + w * i / 4 - 9, abajo - 15, 7, normal, slate);
      }
      y = abajo - 36;
    };
    parrafo('Solo RP: flujos obtenidos del motor y comprobados con la identidad del saldo. CLP reales de la fecha UF; M = millones de pesos. Se muestra saldo al inicio de cada año.');
    grafico('Pensión mensual RP · CLP reales', ['conservadorPension', 'basePension', 'optimistaPension']);
    grafico('Saldo AFP al inicio del año · CLP reales', ['conservadorSaldo', 'baseSaldo', 'optimistaSaldo']);
    resultado.escenarios.forEach((e, i) => texto(`${e.nombre} ${porcentaje(e.rentabilidadRealAnual)}`, 44 + i * 170, y, 8, bold, colores[i]));
    y -= 25;
    parrafo('Curvas condicionadas a los supuestos del modelo, no pronósticos. No representan fechas de fallecimiento ni liquidaciones futuras. No se genera curva RV ni saldo de aseguradora.');
  } else {
    titulo('Gráficos no habilitados');
    parrafo('No se generan curvas sintéticas, proyecciones familiares ni una línea RV fija. Los montos iniciales no validan el cálculo de derechos futuros.');
  }

  nueva('Metodología, restricciones y fuentes', `Fuentes revisadas al ${resultado.fechaRevision} · matriz de trazabilidad M01–M27`);
  titulo('Método resumido y límites');
  parrafo('Se conserva el CNU anual local con supervivencia generacional TM-2020 y descuento a mitad de año. Capital expresado por unidad de pensión mensual. No se incorporan nuevas fórmulas actuariales ni la corrección completa del Anexo 7.');
  parrafo('RP: recálculo anual, retiros limitados al saldo y retorno real constante sobre el remanente. RV inmediata teórica: ahorro dividido por CNU local, con descuento hipotético explícito; sin tarifa de compañía.');
  parrafo('La fecha UF es la base monetaria y de valoración del ejercicio. Las edades enteras son declaradas, no edades actuariales certificadas. No se selecciona una circular de tasas automáticamente.');
  if (resultado.supuestos.includes(AVISO_TASA_RP_HISTORICA)) parrafo(AVISO_TASA_RP_HISTORICA);
  titulo('Funciones restringidas en el piloto');
  for (const r of resultado.restricciones) parrafo(`${r.titulo} (${r.componentes.join(', ')}). ${r.motivo}`, 8);
  titulo('Fuentes documentales · no certificación del monto');
  for (const f of resultado.fuentes) {
    parrafo(`${f.titulo}. ${f.alcance}`, 8);
    parrafo(f.url, 7, teal);
  }
  parrafo('Referencia interna: docs/fase-4-matriz-trazabilidad.md. La conformidad normativa del monto individual requiere un especialista y antecedentes oficiales fuera del simulador.', 8);
  paginas.forEach((p, i) => {
    p.drawLine({ start: { x: 42, y: 49 }, end: { x: 553, y: 49 }, color: rgb(.83, .87, .9), thickness: .5 });
    p.drawText('Uso interno · Datos ficticios · Sin certificación normativa · No es oferta comercial · Sin SCOMP', { x: 42, y: 34, size: 7, font: normal, color: slate });
    p.drawText(`${d.caso} | Valoración ${d.fechaValoracion} | ${i + 1} / ${paginas.length}`, { x: 42, y: 21, size: 7, font: normal, color: slate });
  });
  return pdf.save();
}
