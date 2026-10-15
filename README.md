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
- `src/routes/PushContext.jsx` + `src/components/admin/Push*.jsx`: estado y UI.

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
anchos de 375, 768, 1280 y 1920 px. Playwright inicia Vite si no está ya ejecutándose.
Puede usarse `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para indicar un Chromium instalado
localmente y `CAPTURE_WORKSPACE=1` para guardar capturas en `test-results/` (ignorado).
