"""Navegación del constructor y política de estimaciones. Solo datos ficticios."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--salida', default='/tmp/escenarios-navegador')
salida = Path(parser.parse_args().salida)
salida.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1080}, locale='es-CL')
    errores, peticiones, calculos = [], [], []
    page.on('pageerror', lambda e: errores.append(str(e)))
    page.on('request', lambda r: peticiones.append(r.url))
    page.on('request', lambda r: calculos.append(r.post_data_json) if r.url.endswith('/api/escenarios') and r.method == 'POST' else None)
    page.goto('http://127.0.0.1:3000', wait_until='networkidle')
    page.get_by_role('link', name='Escenarios', exact=True).click()
    expect(page.get_by_role('heading', name='Constructor de escenarios', exact=True)).to_be_in_viewport()
    catalogo = page.get_by_role('region', name='Catálogo de modalidades')
    expect(catalogo.get_by_role('article')).to_have_count(5)
    expect(page.get_by_role('button', name=re.compile('^Configurar '))).to_have_count(5)
    comparar = page.get_by_role('button', name='Comparar seleccionados', exact=True)
    expect(comparar).to_be_disabled()
    expect(page.get_by_test_id('comparacion-escenarios')).to_have_count(0)
    page.get_by_label(re.compile('Confirmo que usaré datos ficticios')).check()
    comparar.click()
    tabla = page.get_by_test_id('comparacion-escenarios')
    expect(tabla).to_be_visible()
    expect(tabla.get_by_role('row')).to_have_count(3)
    assert [e['modalidad'] for e in calculos[-1]['escenarios']] == ['retiro_programado', 'rv_inmediata']

    # Duplicar, editar una sensibilidad, validar nombre y comparar sin oferta comercial.
    page.get_by_role('button', name='Duplicar RV simple de referencia', exact=True).click()
    expect(tabla).to_have_count(0)
    page.get_by_role('button', name='Editar RV simple de referencia copia 1', exact=True).click()
    editor = page.get_by_role('form', name='Editor de escenario')
    nombre = page.get_by_label('Nombre descriptivo del escenario', exact=True)
    nombre.fill('<script>alert(1)</script>')
    page.get_by_role('button', name='Guardar escenario', exact=True).click()
    expect(editor.get_by_role('alert')).to_contain_text('nombre descriptivo')
    nombre.fill('RV sensibilidad 4')
    page.get_by_label('Supuesto de tasa', exact=True).select_option('sensibilidad')
    page.get_by_label('Descuento de sensibilidad · % real anual', exact=True).fill('4')
    page.get_by_role('button', name='Guardar escenario', exact=True).click()
    comparar.click()
    expect(tabla.get_by_role('row')).to_have_count(4)
    expect(tabla).to_contain_text('4.00%')
    expect(tabla).to_contain_text('Sensibilidad hipotética')
    assert calculos[-1]['escenarios'][-1]['tasaSensibilidad'] == .04

    # Agregar y editar las tres cláusulas, siempre sin importes ni envío al cálculo.
    for modalidad, etiqueta, nombre_nuevo in [
        ('rv_garantizada', 'RV con período garantizado', 'Garantía 180'),
        ('rv_aumento', 'RV con aumento temporal', 'Aumento 13'),
        ('rv_combinada', 'RV combinada', 'Combinada editable'),
    ]:
        page.get_by_role('button', name=f'Configurar {etiqueta}', exact=True).click()
        page.get_by_label('Nombre descriptivo del escenario', exact=True).fill(nombre_nuevo)
        if modalidad != 'rv_aumento': page.get_by_label('Período garantizado · meses', exact=True).fill('180')
        if modalidad != 'rv_garantizada':
            page.get_by_label('Duración del aumento · meses', exact=True).fill('13')
            page.get_by_label('Porcentaje de aumento · %', exact=True).fill('50')
        expect(editor).to_contain_text('sin pensión ni PDF')
        page.get_by_role('button', name='Guardar escenario', exact=True).click()
    comparar.click()
    expect(tabla.get_by_role('row')).to_have_count(7)
    assert len(calculos[-1]['escenarios']) == 3
    assert all(e['modalidad'] in ['retiro_programado', 'rv_inmediata'] for e in calculos[-1]['escenarios'])
    for n in ['Garantía 180', 'Aumento 13', 'Combinada editable']:
        fila = tabla.get_by_role('row').filter(has=page.get_by_text(n, exact=True))
        expect(fila).to_contain_text('Sin cálculo')
        expect(fila).to_contain_text('Pendiente actuarial')
        assert '$' not in fila.inner_text()
    page.locator('#constructor-escenarios').evaluate('(e) => e.scrollIntoView({block: \"start\"})')
    page.screenshot(path=str(salida / 'constructor-escritorio.png'))
    tabla.scroll_into_view_if_needed()
    page.screenshot(path=str(salida / 'comparacion-escritorio.png'))

    # Editor no modifica una configuración guardada al cancelar.
    page.get_by_role('button', name='Editar Garantía 180', exact=True).click()
    page.get_by_label('Nombre descriptivo del escenario', exact=True).fill('No guardada')
    page.get_by_role('button', name='Cancelar edición', exact=True).click()
    expect(page.get_by_role('button', name='Editar Garantía 180', exact=True)).to_be_visible()
    page.get_by_role('button', name='Editar Garantía 180', exact=True).click()
    page.get_by_label('Nombre descriptivo del escenario', exact=True).fill('Garantía 240')
    page.get_by_label('Período garantizado · meses', exact=True).fill('240')
    page.get_by_role('button', name='Guardar escenario', exact=True).click()
    comparar.click()
    expect(tabla).to_contain_text('Garantía 240')
    expect(tabla).to_contain_text('240 meses')

    # Solo configuraciones pendientes: no se hace petición de cálculo ni se inventa un cero.
    for n in ['RP de referencia', 'RV simple de referencia', 'RV sensibilidad 4']:
        page.get_by_label(f'Comparar {n}', exact=True).uncheck()
    antes = len(calculos)
    comparar.click()
    expect(tabla.get_by_role('row')).to_have_count(4)
    assert len(calculos) == antes
    assert '$' not in tabla.inner_text()
    page.get_by_role('button', name='Eliminar Garantía 240', exact=True).click()
    expect(page.get_by_role('button', name='Editar Garantía 240', exact=True)).to_have_count(0)

    # Los datos comunes invalidan las estimaciones y no sobreviven a un fallo del servicio.
    page.get_by_label('Comparar RP de referencia', exact=True).check()
    comparar.click()
    expect(tabla).to_be_visible()
    page.get_by_label('Valor UF · CLP', exact=True).fill('50000.25')
    expect(tabla).to_have_count(0)
    page.route('**/api/escenarios', lambda route: route.fulfill(status=503, json={'success': False, 'error': 'Fallo de comparación simulado'}))
    comparar.click()
    expect(page.get_by_role('alert').filter(has_text='Fallo de comparación simulado')).to_be_visible()
    expect(tabla).to_have_count(0)
    page.unroute('**/api/escenarios')
    comparar.click()
    expect(tabla).to_be_visible()

    page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('#constructor-escenarios').evaluate('(e) => e.scrollIntoView({block: \"start\"})')
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    page.screenshot(path=str(salida / 'constructor-movil.png'))
    tabla.scroll_into_view_if_needed()
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    page.screenshot(path=str(salida / 'comparacion-movil.png'))
    region = page.get_by_role('region', name='Tabla de escenarios, desplazable horizontalmente')
    assert region.evaluate('(e) => e.scrollWidth > e.clientWidth')
    region.evaluate('(e) => e.scrollLeft = e.scrollWidth')
    page.screenshot(path=str(salida / 'comparacion-movil-desplazada.png'))
    # Navegación por teclado y restablecimiento de modalidad sin cláusulas ocultas.
    page.get_by_role('button', name='Editar Combinada editable', exact=True).click()
    page.get_by_label('Modalidad del escenario', exact=True).select_option('rv_inmediata')
    expect(page.get_by_label('Período garantizado · meses', exact=True)).to_have_count(0)
    page.get_by_label('Nombre descriptivo del escenario', exact=True).focus()
    page.keyboard.press('Tab')
    expect(page.get_by_label('Modalidad del escenario', exact=True)).to_be_focused()
    page.get_by_role('button', name='Guardar escenario', exact=True).click()
    comparar.click()
    expect(tabla).to_be_visible()
    actualizado = next(e for e in calculos[-1]['escenarios'] if e['nombre'] == 'Combinada editable')
    assert actualizado['mesesGarantizados'] == actualizado['mesesAumento'] == actualizado['porcentajeAumento'] == 0
    externas = [u for u in peticiones if urlparse(u).hostname not in ['127.0.0.1', 'localhost']]
    assert not errores, errores
    assert not externas, externas
    # Recargar descarta todos los escenarios personalizados: sin persistencia accidental.
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('button', name='Editar Combinada editable', exact=True)).to_have_count(0)
    expect(page.get_by_role('button', name='Editar RP de referencia', exact=True)).to_have_count(1)
    resumen = {'resultado': 'Navegador de escenarios aprobado', 'flujos': 10, 'errores_JS': errores,
               'solicitudes_externas': externas, 'clausulas_enviadas_al_calculo': 0, 'movil': 390}
    (salida / 'resumen.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=2))
    print(json.dumps(resumen, ensure_ascii=False))
    browser.close()
