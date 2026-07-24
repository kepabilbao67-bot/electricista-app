# Flujo KAOS de Desarrollo — V1

Protocolo obligatorio para todas las sesiones de trabajo en proyectos KAOS.

---

## Principios fundamentales

- Kiro ejecuta codigo y operaciones tecnicas.
- ChatGPT dirige, valida y toma decisiones.
- Kepa pega prompts y devuelve informes.
- Ninguna accion destructiva o irreversible se ejecuta sin autorizacion explicita.

---

## FASE 1 — Verificacion inicial del repositorio

Ejecutar SIEMPRE al inicio de cada sesion:

1. Confirmar ruta del workspace.
2. `git branch --show-current` — identificar rama actual.
3. `git status --short` — debe estar vacio (limpio).
4. `git remote -v` — confirmar repositorio oficial.
5. `git fetch origin` — sincronizar referencias.
6. Comparar HEAD con origin — up-to-date, ahead, behind o diverged.
7. Verificar que `.env`, claves y tokens NO estan rastreados por git.
8. Verificar que `.gitignore` excluye: `node_modules/`, `dist/`, `graphify-out/`, `.env`.

Si el repositorio NO esta limpio, detenerse y entregar inventario sin modificar nada.

---

## FASE 2 — Grafo de conocimiento (Graphify)

- Si `graphify-out/graph.json` existe: usar `graphify query` directamente.
- Si no existe: ejecutar pipeline completo.
- Si el codigo cambio significativamente: ejecutar con `--update`.

Usar el grafo para:
- Identificar god nodes (abstracciones centrales).
- Detectar comunidades y modulos.
- Evaluar impacto de cambios antes de ejecutarlos.

---

## FASE 3 — Inspeccion de arquitectura

Leer sin modificar:
- package.json / composer.json / Cargo.toml (segun stack).
- Configuraciones de build y test.
- Estructura de directorios.
- README y documentacion.
- Vulnerabilidades (`npm audit --json` o equivalente, solo lectura).

---

## FASE 4 — Definicion de tarea unica

Cada tarea debe cumplir TODOS estos criterios:
- Objetivo concreto y verificable.
- Minimo de archivos afectados.
- No rompe funcionalidad existente.
- Reversible (rama + PR revertible).
- Forma clara de validacion (build, tests, typecheck).
- Conserva datos de usuarios existentes.

Formato:
```
TAREA: [descripcion]
ARCHIVOS AUTORIZADOS: [lista]
VALIDACION: [criterio de exito]
RAMA: [nombre propuesto]
```

---

## FASE 5 — Evaluacion previa de riesgos

Antes de tocar codigo, evaluar:

| Riesgo | Accion si positivo |
|--------|-------------------|
| Afecta datos de usuario | Requiere aprobacion |
| Involucra claves o autenticacion | Requiere aprobacion |
| Cambia interfaces publicas | Requiere aprobacion |
| Toca god node (>10 conexiones) | Requiere tests previos |
| Anade/actualiza dependencias | Requiere justificacion y aprobacion |
| Modifica >3 archivos | Documentar razon |

Resultado: RIESGO BAJO / MEDIO / ALTO

---

## FASE 6 — Creacion de rama segura

```
git checkout -b [tipo]/[descripcion-corta]
```

Tipos: `fix/`, `feat/`, `refactor/`, `test/`, `docs/`, `chore/`

Crear siempre desde la rama canonica actualizada.

---

## FASE 7 — Implementacion limitada

Reglas:
1. Solo modificar archivos de la lista AUTORIZADOS.
2. No tocar archivos fuera del scope sin nueva autorizacion.
3. No instalar paquetes sin autorizacion.
4. No cambiar configuraciones globales salvo autorizacion explicita.
5. El codigo debe pasar typecheck y build sin errores.
6. Mantener el estilo del proyecto existente.
7. No dejar console.log temporales, TODO sueltos ni codigo comentado.

---

## FASE 8 — Pruebas

| Stack | Validacion minima |
|-------|-------------------|
| TypeScript/React (Vite) | `npx tsc --noEmit` + `npm run build` |
| Con tests configurados | + `npm run test` |
| PHP | Syntax check + tests si existen |
| Python | pytest o equivalente |
| Cualquiera | `git diff --check` (whitespace) |

---

## FASE 9 — Revision pre-commit

Verificar ANTES de solicitar autorizacion para commit:

1. `git diff --stat` — solo archivos autorizados modificados.
2. `git diff --check` — sin trailing whitespace ni conflictos.
3. `git status` — no hay archivos inesperados.
4. Busqueda de patrones de secretos en el diff (`sk-`, `AKIA`, `password=`, tokens).
5. Tamano razonable (<100 lineas ideal para tarea atomica).
6. `.env` y similares NO estan staged.

---

## FASE 10 — Informe y solicitud de commit

**Kiro NO hace commit automaticamente.**

Entregar informe completo (ver plantilla abajo) y esperar autorizacion explicita de Kepa.

Solo tras recibir autorizacion:
```
git add [archivos especificos]
git commit -m "[tipo]: [descripcion concisa]"
```

NUNCA usar `git add .` ni `git add -A`.

---

## FASE 11 — Push y PR (solo con autorizacion)

**Kiro NO hace push ni crea PR sin autorizacion explicita.**

Cuando se autoriza:
```
git push -u origin [rama]
gh pr create --base [rama-canonica] --title "[titulo]" --body "[descripcion]"
```

---

## FASE 12 — Validacion de checks

Despues del push, verificar:
```
gh pr view [numero] --json mergeable,statusCheckRollup
```

Documentar: mergeable, checks, conflictos.

---

## FASE 13 — Acciones prohibidas

Las siguientes acciones estan SIEMPRE prohibidas sin autorizacion explicita:

- `git merge`
- `git rebase`
- `git reset --hard`
- `git push --force`
- `git branch -D`
- `git clean -fd`
- `npm audit fix`
- `npm ci` (requiere autorizacion)
- `npm install` (requiere autorizacion)
- Despliegue a produccion
- Cerrar o fusionar PRs
- Cambiar rama predeterminada en GitHub
- Borrado masivo de archivos
- Modificar configuracion de CI/CD

---

## FASE 14 — Informe final

Usar esta plantilla para CADA tarea:

```
# INFORME — [PROYECTO] / [RAMA]

## Contexto
- Proyecto: [nombre]
- Repositorio: [URL]
- Rama base: [rama canonica]
- Rama de trabajo: [rama creada]
- Fecha: [YYYY-MM-DD]

## Tarea
[Descripcion]

## Estado previo
- Ruta: [confirmada]
- Git status: [limpio/con cambios]
- Sincronizacion: [up-to-date/ahead/behind]

## Implementacion
- Archivos modificados: [lista]
- Lineas: [+N / -N]
- Dependencias anadidas: [ninguna / lista]

## Validacion
| Prueba | Resultado | Exit code |
|--------|-----------|-----------|
| typecheck | OK/FALLO | 0/1 |
| build | OK/FALLO | 0/1 |
| tests | OK/FALLO/N/A | 0/1/- |
| diff --check | OK/FALLO | 0/1 |

## Seguridad
- Secretos en diff: NO
- Archivos inesperados: NO
- .env rastreado: NO

## Git
- Commit: [pendiente de autorizacion / SHA mensaje]
- Push: [pendiente / realizado]
- PR: [no creada / #numero]

## Clasificacion
[APROBADO / CORREGIR / NO EJECUTAR / BLOQUEADO]

## Siguiente accion
[UNA recomendacion]

## Integridad
- No se fusiono PR
- No se cambio rama predeterminada
- No se desplego
- No se expusieron secretos
- Repositorio en rama [X], status limpio
```

---

## FASE 15 — Retorno seguro

```
git checkout [rama-inicial]
git status --short
```

Confirmar repositorio limpio en la rama donde estaba al inicio.

---

## Roles

| Herramienta | Rol |
|-------------|-----|
| ChatGPT | Dirige, valida, decide |
| Kiro | Ejecuta codigo, git, builds, tests, Graphify, informes |
| Graphify | Mapa de arquitectura, impacto, god nodes |
| GitHub | PRs, checks, historial |
| Kepa | Interfaz, autorizaciones |
| Vercel | Despliegue automatico (no interactuar directamente) |

---

## Resumen de permisos

| Accion | Permiso |
|--------|---------|
| Leer archivos, git log/status/diff/fetch | Automatico |
| Crear rama local | Automatico |
| Editar archivos autorizados | Automatico |
| Ejecutar typecheck/build/test | Automatico |
| Generar/consultar grafo Graphify | Automatico |
| npm ci / npm install | Requiere autorizacion |
| git commit | Requiere autorizacion |
| git push | Requiere autorizacion |
| gh pr create | Requiere autorizacion |
| Merge, rebase, reset, force-push, deploy | Prohibido |
