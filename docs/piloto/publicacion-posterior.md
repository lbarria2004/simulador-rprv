# Pasos posteriores para una Pull Request

**No ejecutados en este cierre.** No se creó una PR, no se hizo push y no se modificó `master`. Esta guía no constituye autorización para publicar: esperar una instrucción posterior expresa.

1. Revisar el [cierre](cierre.md), las evidencias, el [checklist](seguridad-y-privacidad.md) y el [texto preparado para la PR](pull-request-propuesta.md). Asegurar que el repositorio y su visibilidad sean los deseados; no adjuntar `.env`, logs, llaves, dependencias, historial exportado ni datos personales a la PR.
2. Configurar SSH de GitHub con una llave administrada fuera del repositorio. No utilizar tokens personales ni incrustar credenciales en URLs. Los siguientes comandos fuerzan SSH sin modificar permanentemente la configuración remota:

   ```bash
   cd /ruta/al/repositorio/simulador-rprv
   git switch codex/desarrollo
   git status --short --branch
   git log -1 --oneline
   git rev-parse piloto-rprv-2dae5e0
   git -c remote.origin.url=git@github.com:lbarria2004/simulador-rprv.git fetch origin master
   git diff --check origin/master...codex/desarrollo
   git diff --stat origin/master...codex/desarrollo
   git log --oneline origin/master..codex/desarrollo
   ```

   Detenerse si hay cambios pendientes inesperados o la referencia del piloto no coincide con `2dae5e018f55557bd8a0bad5c85939ec4fb475bd`. `fetch` actualiza la referencia remota local, no la rama `master`. Revisar el diff completo hacia la base real de la futura PR: puede incluir fases anteriores que aún no estén integradas. No describir la PR como únicamente documental si incluye todo el piloto.
3. Repetir las verificaciones de la [guía](instalacion-y-demostracion.md). Si `origin/master` cambió o hay conflictos, resolverlos exclusivamente en la rama de desarrollo después de revisar su alcance y volver a probar; no reescribir ni actualizar `master` local como parte de este procedimiento. No usar `--force`.
4. Solo después de la autorización para publicar y de que todo pase:

   ```bash
   git -c remote.origin.url=git@github.com:lbarria2004/simulador-rprv.git -c remote.origin.pushurl=git@github.com:lbarria2004/simulador-rprv.git push origin codex/desarrollo
   ```

   Este comando publica únicamente la rama de desarrollo; no empuja `master` ni etiquetas. La etiqueta del piloto permanece local salvo autorización separada.
5. Abrir manualmente en GitHub:

   `https://github.com/lbarria2004/simulador-rprv/compare/master...codex/desarrollo?expand=1`

   Comprobar **base: master** y **compare: codex/desarrollo**, revisar todos los archivos y usar el título/cuerpo preparado en `pull-request-propuesta.md`. Preferir una PR en borrador, sin merge ni despliegue automático. Revisar los workflows existentes del repositorio antes de publicar; el piloto no añade un despliegue público.
6. Solicitar revisión técnica y actuarial según el alcance final. La aprobación de una PR no valida normativamente las pensiones ni habilita clientes reales. No hacer merge, publicar el paquete o activar hosting sin la autorización correspondiente y los controles pendientes.

Si se entrega el paquete por otro canal, cotejar su inventario y checksum con el commit de cierre y usar un canal privado autorizado. El archivo reproducible no lleva `.git` ni credenciales; para una PR se trabaja sobre el repositorio original, no importando el comprimido sobre `master`.
