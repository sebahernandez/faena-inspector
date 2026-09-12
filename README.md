# Faena Inspector

Lista de chequeo de camión multiuso. **Funciona sin señal.**

Reemplaza la planilla de papel de inspección y convierte cada falla detectada
en una tarea con responsable y plazo.

---

## Las tres reglas del producto

1. **Sin señal es el caso normal, no la excepción.** Un camión trabaja en
   planta, faena o carretera. La red es una mejora, nunca un requisito.
2. **Cada `NO` es una tarea, no un comentario.** El documento original trae
   columnas de *Responsable* y *Fecha* junto a cada ítem.
3. **Una inspección firmada es un documento legal.** Al enviarse queda
   congelada. Ni su autor puede editarla.

## Comandos

```bash
npm run dev        # desarrollo
npm run build      # build de producción + service worker
npm run preview    # sirve dist/ (necesario para probar offline)
npm run test       # 39 tests
npm run typecheck  # tsc estricto
npm run lint       # oxlint
npm run check      # typecheck + lint + test
```

## Arquitectura

```
ui  →  application  →  domain
         ↑
   infrastructure
```

`domain/` no importa nada salvo `zod`. Los casos de uso corren sin navegador,
sin base de datos y sin red.

La regla **se hace cumplir con un test**: `src/test/architecture.test.ts`.
oxlint no tiene `no-restricted-paths`, así que la verificación vive en la suite.
Si alguien importa infraestructura en el dominio, falla el build.

```
src/
├── app/container.ts              Composition root. El ÚNICO que conoce implementaciones.
├── modules/
│   ├── inspection/
│   │   ├── domain/               Entidades y reglas. Cero dependencias.
│   │   ├── application/          Puertos y casos de uso.
│   │   ├── infrastructure/       Adaptador Dexie.
│   │   └── ui/
│   └── template/
├── shared/db/db.ts               Dexie: la fuente de verdad local.
└── routes/                       TanStack Router (rutas por archivo).
```

## Cómo funciona sin señal

| Necesidad | Quién la resuelve |
|---|---|
| Que la app **abra** sin red | `vite-plugin-pwa` (service worker precachea el shell) |
| Que **guarde** sin red | Dexie sobre IndexedDB |
| Que la pantalla refleje lo guardado | `dexie-react-hooks` / `useLiveQuery` |
| Que **suba** cuando haya red | Cola de salida (`outbox`) — fase 5 |
| Que no duplique al reintentar | IDs UUID v7 generados en el dispositivo + upsert |

**La base de datos local es el estado de la app.** Por eso no hay Redux ni
Zustand: duplicarían la verdad en dos lugares.

## Detalles que parecen triviales y no lo son

- **`isActive` es `0 | 1`, no booleano.** IndexedDB no indexa booleanos y no
  avisa: el índice simplemente no funciona.
- **Las firmas y fotos se guardan como bytes, no como `Blob`.** Safari arrastra
  bugs históricos con `Blob` en IndexedDB. El adaptador convierte en la
  frontera; el dominio sigue trabajando con `Blob`.
- **Las respuestas viven en su propia tabla.** Anidarlas reescribiría el
  documento completo en cada toque, 51 veces por inspección.
- **`submitInspection` no hace ninguna llamada de red.** Firmar es un hecho
  local. Si algún día aparece un `await fetch` ahí, el producto está roto — y
  hay un test que lo impide.
- **El texto libre se acumula, no se reemplaza.** Un debounce común guarda UN
  valor pendiente y cada llamada nueva lo pisa: escribir la observación y pasar
  a "Responsable" dentro del retardo cancelaba la observación. `usePatchBuffer`
  fusiona por ítem y descarga el buffer al desmontar y al bloquear la pantalla.
  Encontrado manejando la UI real, no en los tests.

## El PDF

`docs/muestra-checklist.pdf` es una salida real de la app, generada **sin
conexión**. Es lo que hay que mostrarle a Prevención antes de construir la
fase 4: si el formato no les sirve, todo lo demás da igual.

Dos decisiones del renderizador que no son cosméticas:

- **Solo fuentes integradas (Helvetica).** Registrar una fuente web haría que
  el PDF necesitara red, y todo el punto es producirlo en terreno.
- **Sin guionado.** Las reglas por defecto de react-pdf son inglesas y en
  español producen "instal-adas", "op-erativa", "es-tado". En un documento que
  Prevención compara contra el formulario en papel, eso se lee como una copia
  descuidada.

## La base de datos

El esquema vive en `supabase/migrations/`. **Se ejecuta en los tests**: PGlite
es Postgres compilado a WebAssembly, así que `src/test/supabase-schema.test.ts`
aplica la migración de verdad y comprueba las políticas contra el motor real,
no contra una suposición.

La regla que sostiene todo: **una inspección firmada no se puede editar.**
Está defendida en tres capas, porque una sola no alcanza:

| Capa | Qué cubre |
|---|---|
| Permisos | Por defecto solo hay `select`. Un `update` falla con "permission denied". |
| Políticas RLS | Si alguien concediera `update`, la política lo rechaza en voz alta. Sin ellas, RLS filtra las filas y el `update` *reporta éxito sobre cero filas* — silencio, justo lo que no querés en un documento legal. |
| Triggers | Se disparan para **todos**, incluido el dueño de la tabla y `service_role`, que saltan RLS por completo. Solo dejan pasar las columnas de aprobación. |

Las escrituras entran por dos funciones `security definer`:

- `submit_inspection(inspection, answers)` — **idempotente**. El id lo genera el
  teléfono, así que reintentar mil veces deja una sola inspección. El `org_id` y
  el autor los estampa el servidor; el cliente nunca elige su organización.
- `approve_inspection(id, firma)` — lo único que escribe las tres columnas de
  aprobación, y solo si quien llama es supervisor de esa organización.

`findings` es una **vista** sobre las respuestas `NO`, con `security_invoker`
para que el RLS de las tablas de abajo aplique al que consulta. Sin esa opción
una vista corre con los permisos de su dueño y filtra datos entre empresas.

## El seed

`supabase/seed.sql` se genera desde el seed de TypeScript con
`npm run seed:generate`. Los ids de los 51 ítems son UUIDs deterministas y
**tienen que ser los mismos en el teléfono y en el servidor**: una respuesta
apunta a un ítem por id. Si divergieran, toda inspección llenada antes de la
primera sincronización subiría apuntando a ítems inexistentes y el documento
firmado volvería en blanco. Hay un test que falla si los dos archivos se separan.

## La cola de salida

Firmar es un hecho **local**: escribe tres tablas y encola. Subir es trabajo de
otro, después. El worker (`src/modules/sync/`) drena la cola con estas reglas:

- **De a uno, en orden.** Veinte subidas simultáneas desde un teléfono con una
  barra de señal son veinte timeouts, no veinte éxitos.
- **Un registro envenenado no bloquea la cola.** Un fallo permanente se aparca
  y el drenaje sigue. Si no, una sola inspección malformada impediría que
  cualquier otra llegue jamás al servidor.
- **Quedarse sin sesión no es un fallo.** Sin sesión no se intenta nada y no se
  gasta intento, así que un teléfono deslogueado no quema su presupuesto de
  reintentos y aparca trabajo perfectamente válido.
- **Backoff exponencial con jitter.** El jitter importa más de lo que parece:
  una cuadrilla entera sale de la zona muerta en el mismo momento, y sin él
  todos los teléfonos golpearían el servidor en el mismo segundo.
- **Reintentar no duplica.** El id lo genera el teléfono y `submit_inspection`
  hace `on conflict do nothing`. Si la conexión se corta después de que el
  servidor confirmó pero antes de que llegue la respuesta, el siguiente intento
  es un no-op.

Cuándo se dispara: al abrir la app, al volver la red, al volver al primer plano,
y con un tick de respaldo mientras la app está abierta. **En iPhone no existe la
sincronización en segundo plano** — un teléfono en el bolsillo no sube nada. El
diseño asume eso en vez de fingir lo contrario.

`src/test/sync-roundtrip.test.ts` prueba el viaje completo con los dos extremos
reales: Dexie sobre fake-indexeddb y el servidor sobre PGlite ejecutando la
migración de verdad. Una columna renombrada falla ahí, no en un camión.

## Sin backend también funciona

Sin `VITE_SUPABASE_URL` la app arranca igual: se inspecciona, se firma y se
genera el PDF. Simplemente no sincroniza. Es un modo de operación válido, no un
estado roto.

## Estado

- [x] Fase 0 — proyecto, PWA, regla de arquitectura verificada
- [x] Fase 1 — dominio, base local, seed de 51 ítems
- [x] Fase 2 — captura completa offline, borrador reanudable
- [x] Fase 3 — firma en canvas + PDF fiel al Excel, generado sin red
- [x] Fase 4 — Supabase: esquema, RLS, aprobación, seed y auth
- [x] Fase 5 — cola de salida y worker de sincronización
- [ ] Fase 6 — fotos de evidencia
- [ ] Fase 7 — aprobación del supervisor
- [ ] Fase 8 — panel de hallazgos

## Pendiente con el cliente

1. ¿La firma con el dedo tiene validez legal, o exigen firma electrónica certificada?
2. ¿Cuánto tiempo se retienen las fotos de evidencia?
3. Validar el PDF de la fase 3 contra el Excel original **antes** de construir la fase 4.
