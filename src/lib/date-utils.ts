/**
 * Utilidades de fecha para el cálculo de edad actuarial en el sistema previsional chileno
 */

export function calcularEdadDesdeFecha(fechaNacStr: string, fechaReferencia: Date = new Date()): number {
  if (!fechaNacStr) return 0;
  const fechaNac = new Date(fechaNacStr + 'T00:00:00');
  if (isNaN(fechaNac.getTime())) return 0;
  
  let edad = fechaReferencia.getFullYear() - fechaNac.getFullYear();
  const mesDif = fechaReferencia.getMonth() - fechaNac.getMonth();
  if (mesDif < 0 || (mesDif === 0 && fechaReferencia.getDate() < fechaNac.getDate())) {
    edad--;
  }
  return Math.max(0, edad);
}

export function calcularFechaDesdeEdad(edad: number, fechaReferencia: Date = new Date()): string {
  const year = fechaReferencia.getFullYear() - edad;
  const month = String(fechaReferencia.getMonth() + 1).padStart(2, '0');
  const day = String(Math.min(fechaReferencia.getDate(), 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
