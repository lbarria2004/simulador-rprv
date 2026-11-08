"""Regresión del piloto en producción local. Solo fixtures; capturas e informe ficticio."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--salida', default='/tmp/piloto-navegador')
args = parser.parse_args()
salida = Path(args.salida)
salida.mkdir(parents=True, exist_ok=True)
base = 'http://127.0.0.1:3000'

def clp(n):
    return '$' + f'{int(n):,}'.replace(',', '.')

def unidades(n):
    return f'{n:,.2f}'.replace(',', '@').replace('.', ',').replace('@', '.')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1100}, locale='es-CL', accept_downloads=True)
    errores = []
    solicitudes = []
    page.on('pageerror', lambda error: errores.append(str(error)))
    page.on('request', lambda req: solicitudes.append(req.url))
    page.goto(base, wait_until='networkidle')
    expect(page.get_by_role('heading', name='Comparador previsional', exact=True)).to_be_visible()
    assert 'Piloto interno' in page.title()
    boton = page.get_by_role('button', name='Calcular comparación', exact=True)
    pdf = page.get_by_role('button', name='Descargar informe PDF', exact=True)
    expect(boton).to_be_disabled()
    expect(pdf).to_be_disabled()
    expect(page.get_by_test_id('comparacion')).to_have_count(0)
    expect(page.locator('path.recharts-line-curve')).to_have_count(0)
    for nombre in ['Ofertas y tasas de aseguradoras', 'Proyecciones familiares futuras', 'Garantías, aumentos y combinaciones']:
        expect(page.get_by_role('heading', name=nombre, exact=True)).to_be_visible()
    page.screenshot(path=str(salida / '01-inicio-escritorio.png'), full_page=True)
    page.get_by_label(re.compile('Confirmo que usaré datos ficticios')).check()

    def calcular():
        with page.expect_response(lambda r: r.url.endswith('/api/pension') and r.request.method == 'POST') as respuesta:
            boton.click()
        r = respuesta.value
        assert r.ok, r.text()
        cuerpo = r.json()
        assert cuerpo['success'] is True
        expect(page.get_by_test_id('comparacion')).to_be_visible()
        return cuerpo['resultado']

    def comprobar_montos(r):
        for tipo in ['rp', 'rv']:
            expect(page.get_by_test_id(f'{tipo}-clp')).to_have_text(clp(r['comparacion'][tipo]['pensionMensual']))
            expect(page.get_by_test_id(f'{tipo}-uf')).to_contain_text(unidades(r['comparacion'][tipo]['pensionEnUF']))
            assert r['comparacion'][tipo]['validacionIndividual'] == 'pendiente_validacion_especializada'

    r = calcular()
    comprobar_montos(r)
    expect(page.locator('path.recharts-line-curve')).to_have_count(6)
    assert len(set(page.locator('path.recharts-line-curve').evaluate_all('(nodes) => nodes.map(n => n.getAttribute("d"))'))) == 6
    page.get_by_text('Ver datos numéricos de las curvas', exact=True).click()
    primera = page.get_by_role('table').locator('tbody tr').first
    expect(primera).to_contain_text('2026')
    expect(primera).to_contain_text(clp(r['datos']['fondos']))
    expect(primera).to_contain_text(clp(r['comparacion']['rp']['pensionMensual']))
    page.get_by_text('Ver datos numéricos de las curvas', exact=True).click()
    page.screenshot(path=str(salida / '02-comparacion-escritorio.png'), full_page=True)

    # Editar no modifica el ahorro propio ni deja visibles resultados anteriores.
    saldo = page.get_by_label('Saldo AFP · CLP', exact=True)
    valor_uf = page.get_by_label('Valor UF · CLP', exact=True)
    saldo_original = saldo.input_value()
    valor_uf.fill('50000.25')
    page.get_by_label('Fecha UF / valoración', exact=True).fill('2026-10-01')
    assert saldo.input_value() == saldo_original
    expect(page.get_by_test_id('comparacion')).to_have_count(0)
    expect(page.locator('path.recharts-line-curve')).to_have_count(0)
    expect(pdf).to_be_disabled()
    expect(page.get_by_role('status')).to_contain_text('Parámetros modificados')
    r2 = calcular()
    comprobar_montos(r2)
    assert r2['comparacion']['rp']['pensionMensual'] == r['comparacion']['rp']['pensionMensual']
    assert r2['datos']['referenciaUF']['valor'] == 50000.25
    assert r2['datos']['fechaValoracion'] == '2026-10-01'
    with page.expect_request('**/api/reporte') as peticion, page.expect_download() as descarga:
        pdf.click()
    payload = peticion.value.post_data_json
    assert set(payload) == {'datos'}
    assert payload['datos'] == r2['datos']
    descarga.value.save_as(str(salida / 'informe-piloto-ficticio.pdf'))

    # Selección explícita: conserva los tres escenarios, cambia el supuesto destacado.
    page.locator('label').filter(has=page.locator('input[type=radio][value=optimista]')).click()
    expect(pdf).to_be_disabled()
    r3 = calcular()
    assert r3['datos']['escenarioRP'] == 'optimista'
    assert r3['proyecciones']['puntos'] == r2['proyecciones']['puntos']
    comprobar_montos(r3)

    # Un saldo cero no puede habilitar curvas; borrar el campo no equivale a ese cero.
    saldo.fill('0')
    rz = calcular()
    assert rz['proyecciones']['disponibles'] is False
    expect(page.get_by_role('heading', name='Sin curvas para este caso')).to_be_visible()
    expect(page.locator('path.recharts-line-curve')).to_have_count(0)
    saldo.fill('')
    expect(page.get_by_test_id('comparacion')).to_have_count(0)
    expect(pdf).to_be_disabled()
    saldo.fill(saldo_original)

    # Grupo admitido: comparación inicial, ningún flujo familiar en la respuesta ni gráficos.
    page.get_by_role('button', name='Cónyuge', exact=True).click()
    page.get_by_role('button', name='Hijo/a común', exact=True).click()
    expect(boton).to_be_disabled()
    page.get_by_label(re.compile('Confirmo como hipótesis')).check()
    familia = calcular()
    assert familia['proyecciones']['puntos'] == []
    assert familia['proyecciones']['disponibles'] is False
    assert [b['porcentaje'] for b in familia['porcentajesActuales']] == [.5, .15]
    expect(page.locator('path.recharts-line-curve')).to_have_count(0)
    expect(page.get_by_role('heading', name='Sin curvas para este caso')).to_be_visible()
    page.screenshot(path=str(salida / '03-familia-restringida.png'), full_page=True)
    with page.expect_download() as familiar:
        pdf.click()
    familiar.value.save_as(str(salida / 'informe-familia-ficticia.pdf'))
    page.get_by_label('Edad beneficiario 2', exact=True).fill('20')
    with page.expect_response(lambda response: response.url.endswith('/api/pension')) as invalida:
        boton.click()
    assert invalida.value.status == 400
    expect(page.get_by_role('alert').filter(has_text='hipótesis explícita de estudios')).to_be_visible()
    expect(pdf).to_be_disabled()
    page.get_by_label(re.compile('Hipótesis de estudios con derecho')).check()
    assert calcular()['porcentajesActuales'][1]['edad'] == 20
    page.get_by_role('button', name='Quitar beneficiario 1', exact=True).click()
    expect(boton).to_be_disabled()
    expect(pdf).to_be_disabled()
    page.get_by_role('button', name='Quitar beneficiario 1', exact=True).click()
    calcular()

    # Un fallo local no produce valores de respaldo ni conserva una comparación obsoleta.
    page.route('**/api/pension', lambda route: route.fulfill(status=503, json={'success': False, 'error': 'Fallo simulado del servicio local'}))
    saldo.fill('80000001')
    boton.click()
    expect(page.get_by_role('alert').filter(has_text='Fallo simulado')).to_be_visible()
    expect(pdf).to_be_disabled()
    expect(page.get_by_test_id('comparacion')).to_have_count(0)
    page.unroute('**/api/pension')
    saldo.fill(saldo_original)
    calcular()

    # Responsive sin desborde horizontal; solo contenido verificable del cálculo actual.
    page.set_viewport_size({'width': 390, 'height': 844})
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=str(salida / '04-inicio-movil.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Desborde horizontal en móvil'
    page.get_by_test_id('comparacion').scroll_into_view_if_needed()
    page.screenshot(path=str(salida / '05-comparacion-movil.png'))
    expect(page.locator('path.recharts-line-curve')).to_have_count(6)
    assert errores == [], errores
    externas = [u for u in solicitudes if urlparse(u).hostname not in ['127.0.0.1', 'localhost']]
    assert externas == [], externas
    assert not any('scomp' in u.lower() for u in solicitudes)
    resumen = {'resultado': 'Navegador del piloto aprobado', 'casos': ['inicio sin resultados', 'RP/RV y tres escenarios', 'UF y PDF coherentes', 'datos obsoletos bloqueados', 'saldo cero y campo vacío', 'familia sin curvas', 'estudios y grupo restringido', 'fallo sin respaldo', 'móvil 390px'], 'errores_JS': errores, 'solicitudes_externas': externas, 'solicitudes_SCOMP': 0}
    (salida / 'resumen.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(resumen, ensure_ascii=False))
    browser.close()
