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

## Estado

- [x] Fase 0 — proyecto, PWA, regla de arquitectura verificada
- [x] Fase 1 — dominio, base local, seed de 51 ítems
- [x] Fase 2 — captura completa offline, borrador reanudable
- [ ] Fase 3 — firma + PDF
- [ ] Fase 4 — Supabase (esquema, RLS, auth)
- [ ] Fase 5 — cola de sincronización
- [ ] Fase 6 — fotos de evidencia
- [ ] Fase 7 — aprobación del supervisor
- [ ] Fase 8 — panel de hallazgos

## Pendiente con el cliente

1. ¿La firma con el dedo tiene validez legal, o exigen firma electrónica certificada?
2. ¿Cuánto tiempo se retienen las fotos de evidencia?
3. Validar el PDF de la fase 3 contra el Excel original **antes** de construir la fase 4.
