"""Constructor multimodalidad en producción local; etiquetas y datos ficticios."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--salida', default='/tmp/escenarios-navegador')
args = parser.parse_args()
salida = Path(args.salida)
salida.mkdir(parents=True, exist_ok=True)
casos, errores, solicitudes = [], [], []

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1100}, locale='es-CL', accept_downloads=True)
    page.on('pageerror', lambda error: errores.append(str(error)))
    page.on('request', lambda req: solicitudes.append(req.url))
    page.goto('http://127.0.0.1:3000', wait_until='networkidle')
    builder = page.get_by_role('region', name='Constructor de escenarios', exact=True)
    form = page.get_by_role('form', name='Configurar escenario', exact=True)
    calcular = page.get_by_role('button', name='Calcular comparación', exact=True)
    pdf = page.get_by_role('button', name='Descargar informe PDF', exact=True)
    nombre = page.get_by_label('Nombre ficticio del escenario', exact=True)

    def articulo(n):
        return builder.get_by_role('article', name=f'Escenario {n}', exact=True)

    def guardar():
        form.get_by_role('button', name=re.compile('Agregar escenario|Guardar cambios')).click()

    def calcular_valido():
        with page.expect_response(lambda r: r.url.endswith('/api/pension') and r.request.method == 'POST') as response:
            calcular.click()
        assert response.value.ok, response.value.text()
        expect(page.get_by_test_id('comparacion')).to_be_visible()
        return response.value.json()

    expect(builder.get_by_role('button', name=re.compile('^Configurar '))).to_have_count(5)
    expect(page.get_by_role('heading', name='Tasas comerciales · no disponibles')).to_be_visible()
    expect(page.get_by_label(re.compile('RUT|Aseguradora|Tasa especial', re.I))).to_have_count(0)
    expect(calcular).to_be_disabled()
    page.get_by_label(re.compile('Confirmo que usaré datos ficticios')).check()
    inicial = calcular_valido()
    assert len(inicial['cotizaciones']) == 2
    casos.append('catálogo y dos estimaciones del piloto')

    page.get_by_role('button', name='Configurar RV con período garantizado', exact=True).click()
    expect(nombre).to_be_focused()
    nombre.fill('Garantía A')
    page.get_by_label('Período garantizado · meses', exact=True).fill('180')
    guardar()
    expect(articulo('Garantía A')).to_contain_text('Pendiente de validación actuarial')
    expect(calcular).to_be_disabled()
    expect(pdf).to_be_disabled()
    expect(page.get_by_test_id('comparacion')).to_have_count(0)
    expect(page.locator('path.recharts-line-curve')).to_have_count(0)
    page.get_by_role('button', name='Comparar configuraciones', exact=True).click()
    tabla = page.get_by_role('region', name='Comparación de configuraciones', exact=True)
    expect(tabla).to_be_visible()
    expect(tabla.get_by_role('row').filter(has_text='Garantía A')).to_contain_text('180')
    assert '$' not in tabla.inner_text()
    casos.append('garantía configurable sin pensión ni PDF')

    articulo('Garantía A').get_by_role('button', name='Duplicar Garantía A', exact=True).click()
    articulo('Garantía A copia').get_by_role('button', name='Editar Garantía A copia', exact=True).click()
    nombre.fill('Garantía B')
    page.get_by_label('Período garantizado · meses', exact=True).fill('240')
    guardar()
    expect(tabla.get_by_role('row').filter(has_text='Garantía B')).to_contain_text('240')
    expect(tabla.get_by_role('row').filter(has_text='Garantía A')).to_contain_text('180')
    articulo('Garantía B').get_by_role('button', name='Editar Garantía B', exact=True).click()
    page.get_by_label('Período garantizado · meses', exact=True).fill('0')
    guardar()
    assert page.get_by_label('Período garantizado · meses', exact=True).evaluate('(e) => !e.checkValidity()')
    expect(tabla.get_by_role('row').filter(has_text='Garantía B')).to_contain_text('240')
    page.get_by_role('button', name='Cancelar edición', exact=True).click()
    casos.append('duplicación independiente, edición, límites y cancelación')

    page.get_by_role('button', name='Configurar RV con aumento temporal', exact=True).click()
    nombre.fill('Aumento A')
    expect(page.get_by_label('Período garantizado · meses', exact=True)).to_have_count(0)
    page.get_by_label('Duración del aumento · meses', exact=True).fill('24')
    page.get_by_label('Aumento solicitado · %', exact=True).fill('37.5')
    guardar()
    expect(tabla.get_by_role('row').filter(has_text='Aumento A')).to_contain_text('+37.5%')
    page.get_by_role('button', name='Configurar RV combinada', exact=True).click()
    nombre.fill('Combinada A')
    page.get_by_label('Período garantizado · meses', exact=True).fill('180')
    page.get_by_label('Duración del aumento · meses', exact=True).fill('36')
    page.get_by_label('Aumento solicitado · %', exact=True).fill('50')
    guardar()
    expect(articulo('Combinada A')).to_contain_text('Pendiente de validación actuarial')
    expect(calcular).to_be_disabled()
    casos.append('aumento y combinación con porcentaje personalizable')

    for width in [1440, 768, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'Desborde a {width}px'
        tabla.scroll_into_view_if_needed()
        assert tabla.evaluate('(e) => e.clientWidth <= window.innerWidth')
        page.screenshot(path=str(salida / f'configuraciones-{width}.png'))
    casos.append('escritorio, tableta y móviles 390/320 sin desborde')
    page.set_viewport_size({'width': 1440, 'height': 1100})

    for n in ['Garantía A', 'Garantía B', 'Aumento A', 'Combinada A']:
        page.get_by_role('checkbox', name=f'Comparar {n}', exact=True).uncheck()
    expect(calcular).to_be_enabled()
    articulo('Renta Vitalicia teórica').get_by_role('button', name='Duplicar Renta Vitalicia teórica', exact=True).click()
    body = calcular_valido()
    assert len(body['cotizaciones']) == 3
    assert body['cotizaciones'][1]['monto'] == body['cotizaciones'][2]['monto']
    with page.expect_download() as descarga, page.expect_request('**/api/reporte') as request:
        pdf.click()
    assert request.value.post_data_json['escenarios'] == [e['config'] for e in body['cotizaciones']]
    assert all(e['modalidad'] in ['retiro_programado', 'renta_vitalicia_simple'] for e in request.value.post_data_json['escenarios'])
    descarga.value.save_as(str(salida / 'escenarios-ficticios.pdf'))
    casos.append('selección calculable y PDF coherente con duplicados')

    articulo('Renta Vitalicia teórica copia').get_by_role('button', name='Editar Renta Vitalicia teórica copia', exact=True).click()
    nombre.fill('RV B')
    guardar()
    expect(pdf).to_be_disabled()
    expect(page.get_by_test_id('comparacion')).to_have_count(0)
    articulo('RV B').get_by_role('button', name='Editar RV B', exact=True).click()
    page.get_by_label('Modalidad', exact=True).select_option('rv_combinada')
    guardar()
    expect(calcular).to_be_disabled()
    expect(articulo('RV B')).to_contain_text('Pendiente de validación actuarial')
    articulo('RV B').get_by_role('button', name='Eliminar RV B', exact=True).click()
    expect(calcular).to_be_enabled()
    casos.append('editar modalidad invalida resultados y no hereda autorización')

    page.get_by_role('button', name='Configurar RV inmediata simple', exact=True).click()
    expect(page.get_by_label('Período garantizado · meses', exact=True)).to_have_count(0)
    expect(page.get_by_label('Aumento solicitado · %', exact=True)).to_have_count(0)
    nombre.fill('<script>')
    guardar()
    expect(form.get_by_role('alert')).to_contain_text('Nombre ficticio')
    nombre.fill('RV C')
    guardar()
    nuevo = calcular_valido()['cotizaciones'][-1]['config']
    assert set(nuevo) == {'id', 'nombre', 'modalidad'}
    casos.append('nombres seguros y cambio a simple sin parámetros residuales')

    # Una respuesta tardía jamás revive resultados para otros supuestos.
    pendientes = []
    page.route('**/api/pension', lambda route: pendientes.append(route))
    calcular.click()
    expect(page.get_by_test_id('comparacion')).to_have_count(0)
    page.get_by_label('Saldo AFP · CLP', exact=True).fill('81000000')
    assert len(pendientes) == 1
    respuesta = pendientes[0].fetch()
    pendientes[0].fulfill(response=respuesta)
    page.unroute('**/api/pension')
    expect(calcular).to_be_enabled()
    expect(pdf).to_be_disabled()
    expect(page.get_by_test_id('comparacion')).to_have_count(0)
    casos.append('respuesta tardía no muestra resultados obsoletos')

    # Ninguna selección y lista vacía bloquean cálculo y exportación.
    for checkbox in builder.get_by_role('checkbox').all():
        checkbox.uncheck()
    expect(calcular).to_be_disabled()
    expect(pdf).to_be_disabled()
    while builder.get_by_role('button', name=re.compile('^Eliminar ')).count():
        builder.get_by_role('button', name=re.compile('^Eliminar ')).first.click()
    expect(builder.get_by_text('Sin escenarios. Agregue una configuración desde el constructor.')).to_be_visible()
    page.get_by_role('button', name='Configurar Retiro Programado', exact=True).click()
    nombre.fill('RP nuevo')
    guardar()
    for _ in range(11):
        articulo('RP nuevo').get_by_role('button', name='Duplicar RP nuevo', exact=True).click()
    expect(form.get_by_role('button', name='Agregar escenario', exact=True)).to_be_disabled()
    expect(builder.get_by_role('button', name=re.compile('^Duplicar ')).first).to_be_disabled()
    expect(builder.get_by_text(re.compile('Límite de 12 escenarios alcanzado'))).to_be_visible()
    maximo = calcular_valido()
    assert len(maximo['cotizaciones']) == 12
    articulo('RP nuevo').get_by_role('button', name='Editar RP nuevo', exact=True).click()
    largo = 'W' * 60
    nombre.fill(largo)
    guardar()
    page.get_by_label('Saldo AFP · CLP', exact=True).fill('1000000000000')
    page.get_by_label('Edad declarada', exact=True).fill('90')
    with page.expect_response(lambda r: r.url.endswith('/api/pension') and r.request.method == 'POST') as ultima:
        page.get_by_role('button', name='Calcular escenarios seleccionados', exact=True).click()
    assert ultima.value.ok
    expect(page.get_by_test_id('comparacion')).to_be_visible()
    for width in [320, 390, 768]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'Desborde en etiquetas largas a {width}px'
    casos.append('etiquetas largas, saldo máximo y cálculo desde el constructor')
    articulo(largo).get_by_role('button', name=f'Eliminar {largo}', exact=True).click()
    expect(pdf).to_be_disabled()
    expect(form.get_by_role('button', name='Agregar escenario', exact=True)).to_be_enabled()
    casos.append('selección vacía, eliminación y límite de doce escenarios')

    assert errores == [], errores
    externas = [u for u in solicitudes if urlparse(u).hostname not in ['127.0.0.1', 'localhost']]
    assert externas == [], externas
    assert not any('scomp' in u.lower() for u in solicitudes)
    resumen = {'resultado': 'Navegador de escenarios aprobado', 'casos': casos, 'errores_JS': errores, 'solicitudes_externas': externas, 'solicitudes_SCOMP': 0}
    (salida / 'resumen.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(resumen, ensure_ascii=False))
    browser.close()
