# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Panel administrativo: KPIs, analítica y reportes

El panel creció con tres vistas de análisis, todas alimentadas por
`src/hooks/useAnalytics.js`:

- **`/admin/dashboard`** — resumen ejecutivo con selector de periodo (7/30/90/365 días),
  8 tarjetas de KPI con tendencias y sparklines, y pestañas navegables
  (`?tab=resumen|proyectos|equipo`).
- **`/admin/analytics`** — análisis profundo con explorador de series
  (mensual/acumulado), burbujas presupuesto vs. avance, radar de salud,
  Pareto de clientes y mapa de calor. Pestañas: `?tab=portafolio|clientes|equipo|avanzado`.
- **`/admin/reports`** — centro de reportes con pestañas (resumen, proyectos, equipo,
  financiero) y exportación a CSV y JSON desde el navegador.

Las gráficas se construyen con SVG puro en `src/components/admin/DataViz.jsx`
(área/línea, dona, barras, barras apiladas, radar, medidor, heatmap, burbujas,
sparkline y embudo), sin dependencias externas.

### Contrato con la API

Todo funciona hoy con los endpoints existentes porque las métricas se calculan
en el cliente. Si el backend expone `GET /analytics/*`, esos valores pasan a ser
la fuente de verdad sin tocar el frontend. El contrato completo (campos,
formatos, ejemplos de Laravel y checklist) está en
[`docs/API-ANALYTICS.md`](docs/API-ANALYTICS.md).

## Espacio de trabajo de proyectos

- `/admin/projects`: resumen del portafolio plegable y tarjetas compactas o ampliadas.
- `/admin/projects/:id`: información del proyecto y filtros plegables, tarjetas con
  detalles individuales y **Modo enfoque** para ocultar la barra lateral en escritorio.
- El buscador, el conteo de resultados y la acción para limpiar filtros permanecen
  disponibles aunque se oculten los filtros avanzados. En móvil, el tablero se
  desplaza horizontalmente sin ensanchar toda la página.
- Las preferencias generales se guardan en el navegador con el prefijo
  `appsline.display.`. Expandir una tarjeta individual es temporal; el control global
  aplica la misma densidad a todas las tarjetas. No se modifican datos del proyecto.

## Tareas continuas (ongoing) y texto enriquecido

Dos mejoras del tablero de tareas, ambas con el contrato de la API en
[`docs/API-TASKS.md`](docs/API-TASKS.md):

- **Tareas continuas / recurrentes**: al crear (o editar) una tarea se elige
  **Puntual** o **Continua (recurrente)**. Las continuas **no tienen fecha de
  entrega**: se quedan en el tablero con una insignia (`Continua · semanal`,
  `Continua · mensual`…) hasta que alguien las finalice, tienen una **cadencia**
  opcional y, con cadencia, el detalle ofrece **“Programar siguiente”** para
  crear la siguiente ronda con la fecha que toca (diaria, semanal, quincenal,
  mensual o trimestral). Quedan fuera de los avisos de “vence esta semana” y
  “vencida”, y el calendario las lista aparte porque no se agendan.
  - Filtros nuevos: en el proyecto (**Tipo: continuas / puntuales**) y en
    `/admin/tasks` (pestaña **Continuas** + tarjeta de resumen).
- **Descripciones y comentarios con formato**: `RichTextEditor`
  (`src/components/admin/`) es un editor con negritas, cursivas, subrayado,
  tachado, encabezado, listas con viñetas/numeradas, cita, código y enlaces, más
  atajos (⌘B, ⌘U, ⌘I) y pegado como texto plano. El valor guardado es **HTML
  sencillo**; al pintarlo, `<RichText />` lo sanea (lista blanca de etiquetas,
  sin `script`/`iframe`/`on*`, enlaces solo `http(s)`/`mailto`/`tel`/relativos) y
  resalta las **@menciones**, que se siguen detectando desde el texto visible
  para avisar a las personas mencionadas.
  - Los textos antiguos (comentarios en texto plano) se siguen viendo igual.
  - Los buscadores comparan contra el **texto plano** (`taskDescriptionText`), así
    que buscar "tickets" encuentra una tarea aunque esté en negritas.
  - `src/utils/richText.js` y `src/utils/tasks.js` no tocan el DOM y están
    cubiertos por pruebas unitarias (`npm run test:unit`).

## Notificaciones push web (Firebase Cloud Messaging)

Los usuarios con sesión iniciada pueden recibir notificaciones del panel en el
navegador. Se activan con un clic (campana 🔔 del encabezado o
**Configuración → Preferencias → Notificaciones push**) y el navegador queda
registrado en la API con su token de FCM.

- `public/firebase-messaging-sw.js`: service worker que muestra la notificación
  y abre la ruta indicada al hacer clic.
- `src/firebase/`: configuración (`VITE_FIREBASE_*`) y manejo del SDK (permiso,
  token, revocación, mensajes con la pestaña abierta). El SDK se carga bajo
  demanda: no pesa en la parte pública del sitio.
- `src/services/push.js`: `POST/DELETE/GET /push/devices` y `POST /push/devices/test`.
- `src/routes/PushContext.jsx` + `src/components/admin/NotificationBell.jsx` y
  `Push*.jsx`: estado y UI.
- **Centro de notificaciones** (campana 🔔 del encabezado): cada aviso recibido
  se guarda en `localStorage` (`src/utils/notificationInbox.js`, una bandeja por
  usuario), así que sigue disponible después de que el *toast* desaparece. La
  campana muestra cuántos hay sin leer, al pulsarla se abre la lista completa
  (título, cuerpo, categoría, hora y destino) y **al abrirla todo queda marcado
  como leído**, con lo que el contador de la pestaña (`(3) Appsline · Tareas` +
  punto en el favicon) desaparece. Los avisos nuevos se resaltan como *Nueva*
  mientras la lista está abierta, cada uno se puede quitar y la lista se puede
  vaciar (pide confirmación). Si el backend quiere que el historial viaje entre
  dispositivos, el contrato opcional está en `docs/API-PUSH.md` (§2.4).
- **Diagnóstico de notificaciones** (Configuración → Preferencias): comprueba
  HTTPS, permiso, variables de Firebase, que el service worker se sirva como
  JavaScript (no como el `index.html` de la SPA), el registro del service worker
  y si el token del navegador está guardado en la API. Permite lanzar tres
  pruebas —**notificación local**, **push simulado por el service worker** y
  **`POST /push/devices/test`**— y aquí es donde se puede **pegar un token de
  `push_devices`** para ver la respuesta cruda del servidor (útil para errores
  como `SENDER_ID_MISMATCH`), copiar un `curl` equivalente y abrir la consola de
  Firebase con el mismo token.

Requisitos: HTTPS (o `localhost`), las variables `VITE_FIREBASE_*` y cuatro
endpoints en la API. **La guía completa —qué agregar en Firebase Console, en el
`.env` y en el backend Laravel— está en
[`docs/API-PUSH.md`](docs/API-PUSH.md).**

### Pruebas del panel

```bash
npm ci
npx playwright install --with-deps chromium
npm run test:e2e     # panel completo (API interceptada)
npm run test:unit    # service worker de push y variables de Firebase
```

Las pruebas usan datos ficticios e interceptan las peticiones de la API, sin requerir
una cuenta real. Cubren preferencias, teclado, filtros ocultos, enfoque, tarjetas,
arrastre de tareas, apertura del detalle y del formulario, estados vacíos/error y
anchos de 375, 768, 1280 y 1920 px.

Archivos añadidos con las tareas continuas y el push:

- `tests/tasks-ongoing-rich-text.spec.mjs` — crear/convertir tareas continuas
  (sin fecha de entrega), insignias, búsqueda que ignora las etiquetas HTML y
  comentarios con formato y @menciones.
- `tests/push-diagnostics.spec.mjs` — el panel de diagnóstico y la prueba de un
  token de la base de datos contra `POST /push/devices/test`.
- `tests/unit/rich-text.test.mjs`, `tests/unit/tasks.test.mjs`,
  `tests/unit/push-diagnostics.test.mjs` y
  `tests/unit/notification-inbox.test.mjs` — saneado de HTML, aritmética de la
  recurrencia, utilidades del token de FCM y la bandeja de notificaciones
  (guardado, sin duplicados, "sin leer" y una bandeja por usuario). Playwright inicia Vite si no está ya ejecutándose.
Puede usarse `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para indicar un Chromium instalado
localmente y `CAPTURE_WORKSPACE=1` para guardar capturas en `test-results/` (ignorado).
