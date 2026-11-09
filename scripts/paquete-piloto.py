"""Paquete determinista de una revisión Git; solo biblioteca estándar de Python 3."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile

RAIZ = Path(__file__).resolve().parents[1]
PREFIJO = 'simulador-rprv-piloto/'
BASE = '2dae5e018f55557bd8a0bad5c85939ec4fb475bd'
ARCHIVOS_RAIZ = {
    '.dockerignore', '.gitignore', '.nvmrc', 'README.md', 'components.json',
    'eslint.config.mjs', 'next.config.ts', 'package.json', 'package-lock.json',
    'postcss.config.mjs', 'tailwind.config.ts', 'tsconfig.json', 'version-piloto.json',
}
DIRECTORIOS = {'src', 'scripts', 'docs', 'public', 'prisma'}
PROHIBIDOS = {'.git', '.aws', '.ssh', '.codex', 'node_modules', '.next', '__pycache__',
              'coverage', 'entregables', 'upload', 'download', 'logs'}
EXTENSIONES = {'.md', '.json', '.ts', '.tsx', '.js', '.mjs', '.py', '.css', '.svg',
               '.txt', '.prisma', '.png', '.pdf'}
PATRONES = [
    rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    rb'gh[pousr]_[A-Za-z0-9]{30,}', rb'github_pat_[A-Za-z0-9_]{30,}',
    rb'AKIA[0-9A-Z]{16}', rb'https?://[^\s/:]+:[^\s/@]+@',
    rb'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',
    rb'(?<!\w)[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9kK]\b',
]


def sha(datos):
    return hashlib.sha256(datos).hexdigest()


def json_bytes(valor):
    return (json.dumps(valor, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()


def permitida(ruta):
    p = PurePosixPath(ruta)
    if p.is_absolute() or '..' in p.parts or str(p) != ruta or '\\' in ruta:
        return False
    if any(c in PROHIBIDOS or c.startswith('.env') for c in p.parts):
        return False
    if len(p.parts) == 1:
        return ruta in ARCHIVOS_RAIZ
    return p.parts[0] in DIRECTORIOS and p.suffix in EXTENSIONES


def revisar(ruta, datos, binarios):
    if not permitida(ruta):
        raise ValueError(f'Ruta no permitida: {ruta}')
    if PurePosixPath(ruta).suffix in {'.png', '.pdf'}:
        if binarios.get(ruta) != sha(datos):
            raise ValueError(f'Binario sin aprobación ficticia o modificado: {ruta}')
        return
    datos.decode('utf-8')
    # La identidad técnica de la URL SSH pública no es un correo personal.
    texto_revisado = datos.replace(b'git@github.com:', b'github-ssh:')
    if any(re.search(p, texto_revisado) for p in PATRONES):
        # Nunca imprimir la coincidencia: podría ser una credencial o dato personal.
        raise ValueError(f'Posible secreto o dato personal en {ruta}; revisar localmente.')


def tar_determinista(archivos):
    salida = io.BytesIO()
    with gzip.GzipFile(fileobj=salida, mode='wb', filename='', mtime=0, compresslevel=9) as gz:
        with tarfile.open(fileobj=gz, mode='w', format=tarfile.USTAR_FORMAT) as tar:
            for ruta, datos in sorted(archivos.items()):
                info = tarfile.TarInfo(PREFIJO + ruta)
                info.size = len(datos)
                info.mode = 0o644
                info.mtime = 0
                info.uid = info.gid = 0
                info.uname = info.gname = ''
                tar.addfile(info, io.BytesIO(datos))
    return salida.getvalue()


def git(*args):
    return subprocess.check_output(['git', '-C', str(RAIZ), *args])


def crear(ref, salida):
    revision = git('rev-parse', '--verify', ref).decode().strip()
    tipo = git('cat-file', '-t', revision).decode().strip()
    if tipo not in {'commit', 'tree'}:
        raise ValueError('La referencia debe identificar un commit o árbol Git.')
    arbol = git('rev-parse', revision + '^{tree}').decode().strip()
    archivos, excluidos = {}, []
    for registro in git('ls-tree', '-rz', '--full-tree', revision).split(b'\0'):
        if not registro:
            continue
        cabecera, nombre = registro.split(b'\t', 1)
        modo, clase, objeto = cabecera.decode().split()
        ruta = nombre.decode('utf-8')
        if not permitida(ruta):
            excluidos.append(ruta)
            continue
        if clase != 'blob' or modo not in {'100644', '100755'}:
            raise ValueError(f'Enlaces/submódulos no admitidos: {ruta}')
        archivos[ruta] = git('cat-file', 'blob', objeto)
    version = json.loads(archivos['version-piloto.json'])
    if version['commit_piloto'] != BASE or version['solo_datos_ficticios'] is not True:
        raise ValueError('La referencia no corresponde al cierre del piloto ficticio.')
    if 'package-lock.json' not in archivos:
        raise ValueError('Falta el lockfile de dependencias.')
    for ruta, datos in archivos.items():
        revisar(ruta, datos, version['binarios_ficticios_aprobados_sha256'])
    inventario = {
        'formato': 1, 'commit_piloto': BASE, 'revision_paquete': revision,
        'tipo_revision': tipo, 'arbol_fuente': arbol, 'solo_datos_ficticios': True,
        'archivos_fuente': len(archivos), 'excluidos_del_arbol': sorted(excluidos),
        'normalizacion': 'rutas ordenadas, uid/gid/mtime=0, modo 0644, gzip sin nombre ni fecha',
        'archivos': [{'ruta': p, 'bytes': len(d), 'sha256': sha(d)} for p, d in sorted(archivos.items())],
    }
    contenido_inventario = json_bytes(inventario)
    archivos['INVENTARIO.json'] = contenido_inventario
    destino = Path(salida)
    destino.mkdir(parents=True, exist_ok=True)
    nombre = f'simulador-rprv-piloto-2dae5e0-cierre-{revision[:7]}'
    paquete = destino / (nombre + '.tar.gz')
    paquete.write_bytes(tar_determinista(archivos))
    copia_inventario = destino / (nombre + '.inventario.json')
    copia_inventario.write_bytes(contenido_inventario)
    checksum = destino / (nombre + '.sha256')
    checksum.write_text(f'{sha(paquete.read_bytes())}  {paquete.name}\n'
                        f'{sha(contenido_inventario)}  {copia_inventario.name}\n')
    verificar(paquete)
    print(json.dumps({'paquete': str(paquete), 'archivos_fuente': len(archivos) - 1,
                      'sha256': sha(paquete.read_bytes()), 'revision': revision}))


def verificar(paquete):
    with tarfile.open(paquete, 'r:gz') as tar:
        archivos = {}
        for info in tar.getmembers():
            if not info.isfile() or not info.name.startswith(PREFIJO):
                raise ValueError('Miembro no regular o prefijo incorrecto.')
            ruta = info.name[len(PREFIJO):]
            if ruta in archivos or (ruta != 'INVENTARIO.json' and not permitida(ruta)):
                raise ValueError('Ruta duplicada o prohibida en el paquete.')
            if (info.uid, info.gid, info.mtime, info.mode, info.uname, info.gname) != (0, 0, 0, 0o644, '', ''):
                raise ValueError('Metadatos del paquete no normalizados.')
            archivos[ruta] = tar.extractfile(info).read()
    inventario = json.loads(archivos.pop('INVENTARIO.json'))
    esperados = {e['ruta']: e for e in inventario['archivos']}
    if len(esperados) != len(inventario['archivos']) or len(esperados) != inventario['archivos_fuente'] or set(archivos) != set(esperados):
        raise ValueError('Inventario incompleto o con archivos adicionales.')
    version = json.loads(archivos['version-piloto.json'])
    if version['commit_piloto'] != BASE or inventario['commit_piloto'] != BASE or version['solo_datos_ficticios'] is not True:
        raise ValueError('Identidad del piloto inválida.')
    for ruta, datos in archivos.items():
        e = esperados[ruta]
        if e['bytes'] != len(datos) or e['sha256'] != sha(datos):
            raise ValueError(f'Contenido discordante: {ruta}')
        revisar(ruta, datos, version['binarios_ficticios_aprobados_sha256'])
    return inventario


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    comandos = parser.add_subparsers(dest='accion', required=True)
    c = comandos.add_parser('crear')
    c.add_argument('--ref', default='HEAD')
    c.add_argument('--salida', required=True)
    v = comandos.add_parser('verificar')
    v.add_argument('paquete')
    args = parser.parse_args()
    if args.accion == 'crear':
        crear(args.ref, args.salida)
    else:
        resultado = verificar(args.paquete)
        print(json.dumps({'resultado': 'Paquete e inventario verificados',
                          'archivos_fuente': resultado['archivos_fuente']}))
