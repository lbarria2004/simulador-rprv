"""Regresiones de exclusión, privacidad, integridad y determinismo del paquete."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('paquete', Path(__file__).with_name('paquete-piloto.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class PaqueteTest(unittest.TestCase):
    def test_excluye_configuraciones_dependencias_y_datos(self):
        for ruta in ['.env', '.env.local', 'src/.env.prod', '.npmrc', '.git/config',
                     'node_modules/react/index.js', 'docs/clientes.csv', 'docs/clave.pem',
                     '.next/server/app.js', 'entregables/salida.tar.gz', '/tmp/x',
                     'src/../.env', 'docs/../../fuera.md', 'docs\\archivo.md']:
            with self.subTest(ruta=ruta):
                self.assertFalse(p.permitida(ruta))

    def test_incluye_codigo_documentacion_y_lock(self):
        for ruta in ['package-lock.json', '.nvmrc', 'version-piloto.json',
                     'src/lib/piloto.ts', 'docs/piloto/cierre.md', 'scripts/paquete-piloto.py']:
            self.assertTrue(p.permitida(ruta))

    def test_rechaza_credencial_sin_revelarla(self):
        dato = ('gh' + 'p_' + 'a' * 36).encode()
        with self.assertRaises(ValueError) as error:
            p.revisar('docs/ejemplo.md', dato, {})
        self.assertNotIn(dato.decode(), str(error.exception))

    def test_rechaza_correo_y_rut_sin_mostrarlos(self):
        for dato in [('ficticio' + '@' + 'ejemplo.test').encode(),
                     ('12.' + '345.' + '678-9').encode()]:
            with self.assertRaises(ValueError):
                p.revisar('docs/ejemplo.md', dato, {})
        p.revisar('docs/ejemplo.md', b'git@github.com:organizacion/repositorio.git', {})

    def test_binario_debe_coincidir_con_aprobacion(self):
        ruta, datos = 'docs/piloto/capturas/ejemplo.pdf', b'fixture'
        p.revisar(ruta, datos, {ruta: p.sha(datos)})
        with self.assertRaises(ValueError):
            p.revisar(ruta, datos + b'alterado', {ruta: p.sha(datos)})

    def test_tar_determinista_y_sin_propietario(self):
        a = p.tar_determinista({'README.md': b'a', 'package.json': b'{}'})
        b = p.tar_determinista({'package.json': b'{}', 'README.md': b'a'})
        self.assertEqual(a, b)

    def fixture(self):
        archivos = {'version-piloto.json': p.json_bytes({'commit_piloto': p.BASE,
                    'solo_datos_ficticios': True, 'binarios_ficticios_aprobados_sha256': {}})}
        inventario = {'commit_piloto': p.BASE, 'archivos_fuente': len(archivos),
                      'archivos': [{'ruta': r, 'bytes': len(d), 'sha256': p.sha(d)} for r, d in archivos.items()]}
        archivos['INVENTARIO.json'] = p.json_bytes(inventario)
        return archivos

    def test_verifica_sin_git_ni_dependencias(self):
        with tempfile.TemporaryDirectory() as carpeta:
            archivo = Path(carpeta) / 'paquete.tar.gz'
            archivo.write_bytes(p.tar_determinista(self.fixture()))
            self.assertEqual(p.verificar(archivo)['archivos_fuente'], 1)

    def test_detecta_alteracion_y_archivos_adicionales(self):
        for ruta in ['version-piloto.json', 'README.md']:
            archivos = self.fixture()
            archivos[ruta] = b'alterado'
            with tempfile.TemporaryDirectory() as carpeta:
                archivo = Path(carpeta) / 'paquete.tar.gz'
                archivo.write_bytes(p.tar_determinista(archivos))
                with self.assertRaises(ValueError):
                    p.verificar(archivo)


if __name__ == '__main__':
    unittest.main(verbosity=2)
