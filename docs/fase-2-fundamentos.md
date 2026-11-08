# Fase 2: fundamento previo a la implementación

Base: `8c7affa`, rama local `codex/desarrollo`. Fecha de auditoría: 2026-11-08.

Este documento se redacta antes de modificar fórmulas o selección de tablas en esta fase. Las correcciones siguen siendo un modelo orientativo, sin conexión a SCOMP ni certificación actuarial.

## Fuentes primarias consultadas

- [SP, Libro III, Título X, Capítulo IX](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10624.html): define las poblaciones CB-H, RV-M, B-M y MI y remite a la NCG SP 306 de 24-02-2023. RV-M corresponde a pensionadas de vejez; B-M, a beneficiarias no inválidas. La selección por modalidad RP/RV del código no refleja esta distinción de rol. Se corregirá la selección del rol, sin cambiar cifras de las tablas.
- [SP, Anexo 9 TM-2020](https://www.spensiones.cl/portal/institucional/594/w3-article-15659.html): confirma la existencia de qx y factores bidimensionales de mejora. No certifica la transcripción de los registros del repositorio. Deben cotejarse las cifras por edad con sus originales antes de declararlas verificadas.
- [SP, Anexo 7 Capitales necesarios](https://www.spensiones.cl/portal/institucional/594/w3-article-7253.html): diferencia situaciones familiares y agrega capitales por beneficiario; incluye reglas mensuales en casos de hijos próximos a 24. Nuestra suma anual descontada a mitad de año no reproduce integralmente esas expresiones, cuota mortuoria ni todas las transiciones. Se conserva esa aproximación y se identifica como tal.
- [ChileAtiende, sobrevivencia AFP](https://www.chileatiende.gob.cl/fichas/5258-pension-de-sobrevivencia-del-sistema-de-pensiones-afp): describe el límite menor de 24 para estudiantes y otras condiciones. El motor anual debe excluir pagos desde la edad de cese; el bucle inclusivo que agrega un año completo a los 18/24 es incompatible con su propia condición de elegibilidad. Se corregirá esa frontera, sin afirmar que resuelve los casos mensuales regulatorios.

Las citas heredadas «SP 2.164 / CMF 2.272» no se han acreditado como normas de TM-2020 y se retirarán de comentarios que las presentan como fundamento verificado. No se reemplazarán qx, matrices de mejora ni factores de garantía por nuevas calibraciones.

## Convención monetaria que se implementará

Una referencia UF inmutable por cálculo: valor positivo finito en CLP, fecha ISO válida y fuente. El supuesto inicial será explícitamente ilustrativo, nunca «UF de hoy». No habrá estado monetario global mutable entre peticiones.

Los importes internos y flujos se expresarán en CLP reales de la fecha de referencia. UF = CLP / valorUF; CLP = UF × valorUF. Las conversiones no redondearán valores intermedios. La presentación UF usará dos decimales y la de CLP, pesos enteros. Un cambio de referencia en pantalla conservará CLP como dato canónico y recalculará sus equivalentes UF; no cambiará el ahorro por una reconversión del valor UF redondeado.

La tasa técnica descuenta flujos reales del CNU; la rentabilidad real mueve el saldo real. No se incorporará inflación nominal a esas mismas series. Se retirará del PDF el incremento nominal lineal de UF que mezclaba unidades y beneficios reales. Entradas antiguas que intenten activarlo se rechazarán explícitamente.

## Corrección de sobrevivencia prevista

Se conservará el CNU familiar ponderado `C = suma(p_i × CNU_i)`, bajo la misma aproximación anual. La pensión base de reparto es `B = saldo / C`; el pago mensual agregado es `G = B × suma(p_i)`. El retiro de caja debe ser `12 × G`, limitado al saldo. El código actual confunde `B` con el total pagado y retira más de lo distribuido cuando la suma de porcentajes es menor que uno.

La salida diferenciará pensión base de reparto y total del grupo; la cifra principal y el gráfico mostrarán el total. Cada año se actualizarán edades, derechos, porcentajes automáticos y año calendario del CNU. Se conservarán los metadatos de cada beneficiario. El saldo evolucionará con el retorno real seleccionado, independiente del descuento. Las tres rutas existentes (motor individual, opciones y cliente) deberán usar una sola implementación. No se simularán fallecimientos y no se tratará el aumento de edad como un fallecimiento.

Se verificará por regresión la identidad de caja, suma de pagos, cese de hijos, invalidez, independencia del orden y equivalencia de la referencia UF entre motor, API, gráfico y PDF. Los resultados no acreditan la implementación completa de la normativa.

## Precisión del reparto

El prorrateo conserva la relación `p_i = porcentajeOriginal_i / sumaOriginal`. Redondear cada porcentaje a cuatro decimales antes de valorar el CNU puede dejar la suma por encima o por debajo de uno. Se retirará ese redondeo intermedio; los porcentajes y conversiones se redondearán únicamente al presentarlos. En variantes RV de sobrevivencia se conservará la base de reparto sin redondear para evitar reutilizar el total del grupo o una pensión de presentación en una segunda distribución.
