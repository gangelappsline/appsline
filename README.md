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

### Previsualización de archivos

En la pestaña **Archivos** del proyecto (y en los adjuntos del detalle de
tarea) casi todo se puede ver sin descargar, igual que las imágenes:

- **PDF** con el visor nativo del navegador e **imágenes** como hasta ahora.
- **DOCX, XLSX, PPTX, CSV y TXT/MD** se convierten **en el navegador**:
  el archivo se descarga y se procesa en el cliente (`mammoth`,
  `read-excel-file` y `jszip`, cargados bajo demanda solo al previsualizar
  ese tipo; `src/pages/admin/project/FilePreview.jsx`). Nada se sube a
  servicios de terceros. El XLSX se muestra por hojas como tabla, el CSV
  igual, y el PPTX como una vista simplificada con el texto y las imágenes
  de cada diapositiva (sin el diseño original de PowerPoint).
- Límite de **20 MB** para convertir en el navegador; por encima (o si la
  lectura falla) se ofrece abrir/descargar el original.
- Los formatos sin parser web (**.doc/.xls/.ppt antiguos**, .odt, etc.) no
  se convierten: muestran el respaldo con su icono y, si la URL del archivo
  es pública, el botón **“Ver con el visor de Office”** (el visor en línea
  de Microsoft descarga el archivo desde su URL; no sirve en localhost ni
  con archivos privados).
- Cada tipo tiene su **icono con los colores de su aplicación** (Word azul,
  Excel verde, PowerPoint naranja, PDF rojo…) y la extensión en la tarjeta,
  tanto en el explorador como en los adjuntos de la tarea.
- La clasificación y los parsers puros viven en `src/utils/filePreview.js`
  (cubiertos por `tests/unit/file-preview.test.mjs`) y la e2e que genera
  documentos reales y los previsualiza está en `tests/file-preview.spec.mjs`.

> **Requisito del backend:** para convertir DOCX/XLSX/PPTX/TXT el panel lee
> los bytes del archivo con `fetch`, así que el servidor que sirve los
> archivos (p. ej. `/storage/...`) debe mandar CORS para el origen del
> panel (o servirlos a través de la API, que ya lo manda). Las imágenes y
> el PDF no lo necesitan porque los pinta el navegador directamente. Si la
> lectura falla, la vista previa cae al respaldo sin romperse.

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

## Varias personas por tarea

Una tarea puede tener **varias personas asignadas** (contrato en
[`docs/API-TASKS.md` §4](docs/API-TASKS.md)). El panel manda `assignees: [ids]`
y, por compatibilidad, `assigned_to` con la primera persona; de vuelta acepta
`assignees` como objetos o ids y, si no viene, usa `assigned_to`.

- Selector múltiple (`UserMultiSelect`) al crear la tarea y en el detalle (chips
  con quitar, búsqueda, avatares).
- Pila de avatares en tarjetas del tablero, lista de `/admin/tasks`, calendario,
  dashboard y analítica. El filtro por persona y "Solo mis tareas" consideran a
  **toda** la lista, no solo al primero.
- La carga por persona cuenta una tarea compartida para cada integrante.
- "Programar siguiente" (recurrencia) conserva a todas las personas.
- Lógica sin DOM en `src/utils/assignees.js`, con pruebas unitarias.

> Mientras la API no guarde `assignees`, solo se conserva la primera persona
> (`assigned_to`) al recargar. Los pasos para la API están en el documento.

## Diagramas de flujo

Editor de diagramas de flujo integrado en el panel, guardado **por proyecto** o
**por tarea**. Contrato y pasos para la API en
[`docs/API-DIAGRAMS.md`](docs/API-DIAGRAMS.md).

- **Dónde**: pestaña **Diagramas** de cada proyecto, sección **Diagramas** en el
  detalle de la tarea, vista global `/admin/diagrams` (menú lateral y paleta de
  comandos) y el editor a pantalla completa en
  `/admin/projects/:id/diagrams/:diagramId` (`new` para crear).
- **Editor** (`src/components/admin/flowchart/`, sobre `@xyflow/react`):
  15 formas de flujo (inicio/fin, proceso, decisión, entrada/salida, subproceso,
  documento, base de datos, operación manual, preparación, espera, conector,
  fuera de página, nota, texto libre y carril), conexiones por cualquier lado
  con tipo de línea, flechas, etiqueta, color, grosor, guiones y animación;
  panel de propiedades con relleno, borde, radio, opacidad, sombra, tipografía,
  alineación, icono, enlace, descripción, bloqueo y capas; alinear/distribuir,
  auto-acomodo con Dagre (vertical u horizontal, separación entre nodos/niveles
  y flechas de retorno exteriores), cuadrícula/imán, fondos, minimapa, temas
  de color aplicables a todo el diagrama, plantillas (proceso básico,
  aprobación, bug, onboarding), deshacer/rehacer, copiar/pegar/duplicar, menú
  contextual, atajos de teclado, autoguardado y aviso de cambios sin guardar.
- **Recursos propios**: pestaña **Recursos** de la biblioteca (o botón de imagen
  en la barra). Carga o suelta imágenes PNG/JPG/WebP, hasta **5 MB por archivo**;
  se optimizan a 1600 px y se guardan embebidas en el JSON, sin URLs temporales
  ni endpoints extra. Se pueden reemplazar, redimensionar conservando proporción
  y ajustar a «completa» o «recortada». Catálogo visual de **47 iconos de React
  Icons** con búsqueda, como elementos independientes o dentro de las formas.
- **Paneles**: biblioteca con Formas/Recursos/Plantillas y propiedades con
  Selección/Lienzo. Organización y posición/tamaño accesibles sin recorrer
  todos los estilos; paneles superpuestos y cerrables en pantallas pequeñas.
- **Guardado**: conserva el ID tanto con respuestas directas como envueltas en
  `data`. Solo la creación usa POST; las ediciones usan PUT sobre el mismo ID.
  No se reinicia el editor al pasar de `/new` a `/ID`; se conservan historial
  y cambios hechos mientras guarda. Los errores pausan el autoguardado y se
  avisa si falta espacio local, en vez de informar un guardado inexistente.
- **Exportar**: PNG, SVG, JSON (reimportable) y **adjuntar** PNG + JSON como
  archivo del proyecto o de la tarea con los endpoints de archivos ya existentes.
- **Sin API todavía**: si `/projects/{id}/diagrams` responde 404/405/501, los
  diagramas se guardan en el navegador (`localStorage`) y el panel lo avisa con
  una franja ámbar. Al activar la API no hay que cambiar nada en el frontend.
- `src/utils/diagrams.js` (modelo, normalización, plantillas, auto-acomodo,
  alineación) está cubierto por pruebas unitarias; el flujo completo está en
  `tests/diagrams-assignees.spec.mjs` y `tests/diagrams-editor.spec.mjs` (Playwright).

## Mockups de pantallas (web, iPhone, Android y tablet)

Dentro de la sección de diagramas se pueden diseñar **pantallas** y conectarlas
con el mismo lienzo para validar flujos en equipo. Contrato y pasos para la API
en [`docs/API-MOCKUPS.md`](docs/API-MOCKUPS.md).

- **Biblioteca «Pantallas»** (barra superior → **Pantallas**, o clic derecho en
  el lienzo): 12 marcos reales —iPhone 15 Pro/15/SE, Pixel 8, Galaxy S24,
  Android compacto, iPad, tablet Android, escritorio 1440, laptop 1280, web
  móvil 390 y tamaño libre— con su isla, barra de estado, indicador de inicio y
  barra de navegador.
- **34 elementos 100 % configurables**: títulos, textos, enlaces, etiquetas,
  valoraciones, campos, textarea, buscador, selector, casilla, radio,
  interruptor, deslizador, botones (primario, secundario, icono y flotante),
  imagen, avatar, icono, video, tarjeta, lista, tabla, gráfica, progreso, mapa,
  galería, barra superior, barra inferior, divisor, diálogo, teclado y barra de
  navegador. Cada uno con posición, tamaño, rotación, relleno, borde, esquinas,
  opacidad, sombra, tipografía, alineación, icono, imagen propia y estado.
- **Edición directa en el lienzo**: arrastrar, redimensionar, doble clic para
  escribir el texto, duplicar, ordenar capas, guías de área segura y panel de
  propiedades de la pantalla o del elemento.
- **Flujos entre pantallas**: flechas entre pantallas o **desde un botón/campo
  concreto** (`sourceHandle: "w:<id>"`), con etiqueta, color y estilo. El
  prototipo (**Probar**) navega esas conexiones a tamaño de dispositivo.
- **Revisión del equipo**: panel **Comentarios** con hilos anclados a una
  pantalla o a un elemento, estado abierto/resuelto, salto al lienzo y borrado.
  Se guardan con el diagrama (`data.comments`), así que los ve todo el equipo.
- **Sin tablas nuevas**: pantallas, elementos y comentarios viajan dentro de
  `diagrams.data` y se guardan con los endpoints de diagramas ya documentados.
  La tabla opcional `diagram_comments` (notificaciones/historial) está lista en
  [`docs/backend-diagrams/`](docs/backend-diagrams/).
- **Plantillas** «App móvil · 3 pantallas» y «Web · landing y panel», miniaturas
  con las pantallas y exportación PNG/SVG/JSON como el resto del diagrama; la
  imagen exportada sale limpia (sin nombre de pantalla, pines de comentarios,
  guías de área segura ni resaltado de selección).

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
