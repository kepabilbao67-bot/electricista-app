---
name: autonomo360-project-guardian
description: Protocolo seguro para auditar y trabajar en Autónomo360 (electricista-app). Verifica estado real, clasifica riesgos mediante semáforo, propone bloque mínimo y entrega informe estructurado antes de cualquier cambio.
inclusion: manual
---

# autonomo360-project-guardian

## Propósito

Garantizar que toda intervención en Autónomo360 comience con una verificación real del estado del proyecto, clasifique los riesgos de cada acción y entregue un informe estructurado. Evita actuar sobre suposiciones, tocar producción sin autorización o modificar zonas sensibles sin diagnóstico previo.

## Roles

- ChatGPT dirige, prioriza, diseña el alcance y realiza la validación final.
- Kiro inspecciona, modifica y ejecuta las pruebas dentro del alcance autorizado.
- Kepa autoriza costes, credenciales, producción y acciones sensibles de Git.
- Qwen o Kimi actúan como revisores independientes cuando aporten valor; no modifican ni aprueban automáticamente.
- Ningún informe de otra IA se considera verificado hasta que ChatGPT revise su evidencia.

## Cuándo activar

- Antes de iniciar un sprint o implementación
- Antes de mergear una PR
- Antes de restaurar datos o ejecutar migraciones
- Cuando se retoma el proyecto después de una pausa
- Cuando se sospecha de estado inconsistente
- Cuando se necesita evaluar impacto funcional o comercial

## Cuándo no activar

- Para otros proyectos (Fincas360, admin-fincas, Chaos Automation)
- Para cambios triviales ya validados (typo en un único archivo sin lógica)
- Cuando ya existe un informe válido de menos de 24 horas y no hay cambios nuevos
- Para tareas de diseño puro sin modificación de código

## Verificación inicial obligatoria

Antes de cualquier acción, confirmar:

1. Ruta exacta del workspace (debe ser `electricista-app`)
2. Repositorio remoto (debe ser `kepabilbao67-bot/electricista-app.git`)
3. Rama activa
4. HEAD (hash)
5. `git status` — identificar cambios pendientes
6. Leer AGENTS.md si existe
7. No abrir, copiar ni mostrar `.env`, claves, tokens o datos personales

Si cualquier punto falla o no corresponde a Autónomo360, detenerse inmediatamente.

## Semáforo de seguridad

### VERDE — Sin autorización

- Lectura de archivos
- Inspección de código y estructura
- Consultas SELECT a base de datos local
- Diagnóstico e informe
- Propuesta de plan

### AMARILLO — Solo cuando el usuario lo solicita expresamente en el turno

- Crear archivos nuevos en local
- Modificar archivos existentes en local
- Ejecutar tests y build
- Crear ramas locales

### ROJO — Requiere autorización explícita por escrito

- Producción (Vercel, endpoints remotos)
- Turso remoto (cualquier operación)
- Migraciones de base de datos
- Restauraciones de datos
- `git commit`
- `git push`
- Crear PR
- `git merge`
- Deploy
- Cambio de variables de entorno en servicios
- Borrados masivos o acciones irreversibles
- `git reset`, `git rebase`, `git push --force`
- Instalación o actualización de dependencias

## Flujo de trabajo

### FASE 1 — DIAGNÓSTICO

1. Confirmar objetivo del turno
2. Verificar estado real (ruta, repo, rama, HEAD, status)
3. Identificar qué ya está hecho (informes recientes, PRs, ramas)
4. Detectar cambios locales sin modificarlos
5. Clasificar riesgos según semáforo
6. Proponer bloque mínimo útil

### FASE 2 — PLAN

Entregar antes de ejecutar:

- HECHOS VERIFICADOS
- NO VERIFICADO
- RIESGOS
- RECOMENDACIÓN
- ARCHIVOS PREVISTOS
- PRUEBAS PREVISTAS
- ACCIÓN ÚNICA SIGUIENTE

### FASE 3 — AUTORIZACIÓN

Esperar confirmación del usuario antes de ejecutar acciones AMARILLAS o ROJAS.

### FASE 4 — EJECUCIÓN

- Modificar únicamente archivos necesarios
- No ampliar alcance sin autorización
- No instalar dependencias sin justificación y autorización
- No tocar producción
- Registrar cada archivo modificado

### FASE 5 — VALIDACIÓN

Según corresponda:

- `git diff --check`
- TypeScript (`npx tsc --noEmit` si disponible)
- Tests relevantes (`npx tsx --test ...`)
- Build (`npx next build`)
- Revisión de seguridad (sin secretos en diff)
- Solo archivos del sprint modificados

### FASE 6 — INFORME FINAL

Usar plantilla de `templates/audit-report.md`.

## Condiciones de parada

Detenerse e informar si:

1. La carpeta no corresponde a `electricista-app`
2. El repositorio no es `kepabilbao67-bot/electricista-app.git`
3. Hay cambios ajenos no identificados en archivos que se necesita modificar
4. Se detectan secretos expuestos
5. Se detecta un conflicto de merge activo
6. Se solicita una acción ROJA sin autorización explícita
7. El build falla por una causa ajena al sprint actual
8. No hay backup verificado antes de una operación de datos
9. No se puede confirmar si una conexión es a desarrollo o producción
10. El riesgo excede el beneficio del cambio propuesto
11. Falta información crítica para continuar con seguridad

## Prohibiciones permanentes

- No inventar archivos, funciones, pruebas, resultados ni estados
- No mostrar claves, tokens, contraseñas, NIF, IBAN, teléfonos ni datos personales
- No mezclar con otros proyectos
- No fijar información temporal como permanente
- No afirmar cumplimiento legal (RGPD, fiscal) sin auditoría profesional

## Áreas de auditoría

1. Repositorio: rama, HEAD, status, PRs, ramas activas
2. Seguridad: auth, middleware, headers
3. Base de datos: schema en código, relaciones, migraciones
4. Clientes, leads y CRM
5. Presupuestos y líneas
6. Facturas (inspección, sin modificar lógica fiscal)
7. Partes de trabajo, materiales, horas
8. Comunicaciones y WhatsApp
9. IA: corrector, filtro sensible, disponibilidad
10. UI: navegación, móvil, textos profesionales
11. Impresión A4
12. Build, typecheck, tests
13. Producción y deploy

## Graphify y ahorro de contexto

- Antes de cada sprint, comprobar si Graphify está disponible y corresponde a Autónomo360.
- Usar únicamente el grafo del proyecto correcto.
- Reutilizar el grafo existente para reducir lecturas, tiempo y créditos.
- Actualizarlo solo cuando existan cambios relevantes que vuelvan obsoleto el mapa.
- No regenerarlo innecesariamente.
- No utilizar grafos de KAOS, admin-fincas ni otros proyectos.
- Si no está disponible o no puede verificarse, informar "GRAPHIFY NO VERIFICADO" y continuar mediante inspección dirigida.
- No inventar información que Graphify no haya demostrado.
- Instalar, configurar o ejecutar una regeneración con efectos requiere autorización previa.

## Plan de Ahorro Global

Aplicar eficiencia en el uso de herramientas:

- Reutilizar informes existentes válidos
- No releer archivos ya conocidos en la misma sesión
- No repetir auditorías recientes sin cambios nuevos
- Permitir comprobaciones adicionales cuando sean necesarias para evitar errores

## Referencias

- #[[file:references/autonomo360-rules.md]]

## Plantilla de informe

- #[[file:templates/audit-report.md]]
