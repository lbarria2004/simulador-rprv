import json
from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000}, accept_downloads=True)
    errores=[]; solicitudes=[]
    page.on('pageerror',lambda e:errores.append(str(e)))
    page.on('request',lambda r:solicitudes.append(r.url))
    page.goto('http://127.0.0.1:3000',wait_until='networkidle')
    assert page.get_by_role('heading',name='Simulador de Orientación Previsional').is_visible()
    assert 'CNU aproximado; montos pendientes de validación especializada.' in page.locator('body').inner_text()
    fondos=page.get_by_placeholder('$40.000.000')
    clp=fondos.input_value()
    ref=page.get_by_label('UF en CLP',exact=True)
    assert ref.input_value()=='40000'
    assert page.get_by_label('Fecha de referencia UF').input_value()=='2026-01-01'
    ref.fill('50000.25');ref.press('Tab')
    page.wait_for_timeout(300)
    assert fondos.input_value()==clp, 'Cambiar UF no debe cambiar los fondos canónicos CLP'
    page.get_by_label('Fecha de referencia UF').fill('2026-10-01')
    assert fondos.input_value()==clp
    curva=page.locator('path.recharts-line-curve')
    curvas=[]
    for opcion in ['conservador','base','optimista']:
        page.get_by_label('Rentabilidad real hipotética del fondo AFP').select_option(opcion)
        page.wait_for_timeout(1700)
        curvas.append(curva.get_attribute('d'))
    assert len(set(curvas))==3
    with page.expect_request('**/api/reporte') as peticion, page.expect_download() as descarga:
        page.get_by_role('button',name='Descargar Estudio Orientativo (PDF)').click()
    payload=peticion.value.post_data_json
    assert payload['parametros']['referenciaUF']=={'valor':50000.25,'fecha':'2026-10-01','fuente':'Configuración manual'}
    for r in payload['resultados']:
        assert r['referenciaUF']['valor']==50000.25
        assert r['referenciaUF']['fecha']=='2026-10-01'
        assert abs(r['pensionEnUF']-r['pensionMensual']/50000.25)<1e-12
    descarga.value.save_as('/tmp/rprv-f4-browser.pdf')
    page.get_by_role('button',name='Pensión de Sobrevivencia').click()
    page.wait_for_timeout(1700)
    assert page.get_by_label('Rentabilidad real hipotética del fondo AFP').is_visible()
    texto = page.locator('body').inner_text()
    assert 'Hipótesis: con SIS' in texto
    assert 'El modelo supone un aporte SIS' in texto
    assert 'La aseguradora del SIS entera' not in texto
    page.get_by_label('Rentabilidad real hipotética del fondo AFP').select_option('base')
    with page.expect_request('**/api/reporte') as peticion2, page.expect_download() as descarga2:
        page.get_by_role('button',name='Descargar Estudio Orientativo (PDF)').click()
    payload2=peticion2.value.post_data_json
    rp=next(r for r in payload2['resultados'] if 'Retiro Programado' in r['nombre'])
    assert rp['pensionMensual']==sum(b['pensionMensual'] for b in rp['pensionPorBeneficiario'])
    assert rp['rentabilidadRealAnual']==.02
    assert rp['proyeccion'][1]['beneficiarios'][0]['edad']==rp['proyeccion'][0]['beneficiarios'][0]['edad']+1
    descarga2.value.save_as('/tmp/rprv-f4-sobrevivencia.pdf')
    # Un fallo remoto no reemplaza la referencia configurada ni su fecha por un respaldo falso.
    page.route('**/api/uf',lambda route:route.fulfill(status=503,json={'success':False,'error':'Fallo simulado'}))
    page.get_by_title('Actualizar valor UF desde SII').click()
    page.get_by_text('No se obtuvo una referencia UF fechada; se conserva la seleccionada', exact=True).wait_for()
    assert ref.input_value()=='50000.25'
    assert page.get_by_label('Fecha de referencia UF').input_value()=='2026-10-01'
    assert errores==[], errores
    assert not any('scomp' in url.lower() for url in solicitudes)
    page.screenshot(path='/tmp/rprv-f4-browser.png',full_page=True)
    browser.close()
    print(json.dumps({'interfaz':'CLP conservados al cambiar UF; fecha y referencia coherentes en PDF; 3 curvas distintas','sobrevivencia':'total distribuido y edades verificados','fallo_UF':'conserva referencia manual','errores_JS':errores,'solicitudes_SCOMP':0},ensure_ascii=False))
