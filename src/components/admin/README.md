# UI Kit del panel administrativo

Todo el panel (`/admin/*`) está construido con **Tailwind CSS** y estos
componentes reutilizables. Si necesitas cambiar un estilo, hazlo aquí una
sola vez y se reflejará en todo el panel.

```jsx
import { Card, Modal, Badge, Button, useToast } from "../../components/admin";
```

## Componentes

| Componente | Uso |
|---|---|
| `Avatar` / `AvatarStack` | Foto o iniciales de usuario, pila de equipo |
| `Badge` | Etiquetas de estado (`tone`: brand, green, amber, red, violet, sky, slate) |
| `Button` | Botón con `variant` (primary, secondary, danger, ghost, subtle) y `loading` |
| `Card` / `CardHeader` | Tarjeta y su encabezado con acciones |
| `EmptyState` | Estado vacío con icono, título, descripción y acción |
| `Modal` | Diálogo accesible (`size`: sm–2xl, `footer`) |
| `MonthGrid` | Vista mensual (eventos por día, arrastrar y soltar entre días, leyenda) |
| `MiniStat` | Métrica compacta para franjas de resumen (`icon`, `label`, `value`, `hint`, `tone`) |
| `Drawer` | Panel lateral deslizante (`wide` para detalle de tareas) |
| `ConfirmDialog` | Confirmación de acciones destructivas (en vez de `window.confirm`) |
| `SearchInput` | Buscador con botón para limpiar |
| `StatCard` | Métrica con icono, tono y barra de progreso opcional |
| `Tabs` | Pestañas `pill` o `underline`, con contadores |
| `TableSkeleton` / `CardsSkeleton` | Esqueletos de carga |
| `ProgressRing` / `BarChart` / `RankBars` | Gráficos SVG sin dependencias |
| `AreaChart` / `LineChart` | Series temporales multi-línea/área con degradado, tooltips y leyenda |
| `DonutChart` | Dona con leyenda, porcentaje y valor central |
| `BarsChart` | Barras verticales con línea de objetivo (meta) |
| `StackedBars` | Barras horizontales apiladas por categoría (carga del equipo) |
| `RadarChart` | Radar multidimensional (salud del portafolio) |
| `GaugeChart` | Medidor semicircular con zonas de color |
| `Heatmap` | Mapa de calor tipo calendario (actividad diaria) |
| `BubbleChart` | Burbujas: presupuesto vs. avance, tamaño = volumen |
| `Sparkline` | Miniatura de tendencia para tarjetas de KPI |
| `FunnelChart` | Embudo de conversión |
| `TrendBadge` | Variación de KPI (▲/▼) con color semántico |
| `Field` | Etiqueta + ayuda + error para formularios |
| `ToastProvider` / `useToast` | Notificaciones (`notify("Mensaje", "success" \| "error" \| "info")`). El provider se monta en `main.jsx`, por encima de las rutas |
| `CommandPalette` | Buscador global con `Ctrl+K` (secciones + proyectos) |

## Capas de apoyo

- `src/services/admin.js` — todas las llamadas a la API del panel
  (proyectos, clientes, tareas, usuarios, productos, dashboard) con
  normalizadores de respuesta. Si el backend cambia, se ajusta solo aquí.
  Los clientes usan `fetchClientsPage({ search, status, client_type,
  country, page, per_page, sort_by, sort_dir, with_projects_count })`, que
  devuelve `{ items, meta }` con la paginación de Laravel ya normalizada.
- `src/utils/clients.js` — catálogos (estados, tipos, países) y
  normalizadores de clientes: acepta la forma plana y la anidada
  (`contact: { name, email, phone }`), lee `country` como string o como
  objeto y vincula proyectos por id, correo o razón social.
- `src/utils/apiErrors.js` — lectura de errores de Laravel: `fieldErrors()`
  para pintar un mensaje por campo (422) y `apiErrorMessage()` para el
  toast.
- `src/hooks/useDashboard.js` — datos agregados (KPIs, productividad,
  vencimientos) compartidos por Dashboard y Reportes.
- `src/hooks/useAnalytics.js` — motor analítico del panel. Calcula en el
  cliente todos los KPIs, series y distribuciones (para que el panel nunca
  quede vacío) y usa `GET /analytics/*` como fuente de verdad cuando el
  backend lo expone. Devuelve además el indicador `source`
  (`"server"` | `"local"`).
- `src/hooks/useUrlTab.js` — pestañas sincronizadas con la URL (`?tab=...`)
  para poder compartir enlaces a una sección concreta.
- `src/utils/analytics.js` — cálculos analíticos puros: fechas (mes/semana
  ISO), series mensuales y semanales, mapa de calor, antigüedad de tareas,
  carga por persona, concentración de cartera (HHI), salud de proyecto y KPIs.
- `src/utils/format.js` — moneda, fechas, estados, prioridades y CSV.
- `src/utils/calendar.js` — utilidades de calendario (`dayKey`, `calendarCells`,
  `monthLabel`, tonos de evento) compartidas por el Calendario global y la
  pestaña Calendario del proyecto.
- `src/utils/files.js` — lectura tolerante de los adjuntos que devuelve la API
  (`normalizeProjectFile`), tipo por extensión/MIME, peso legible
  (`formatBytes`) y URL de descarga (`resolveFileUrl`).
- `src/utils/prefs.js` — preferencias en `localStorage`.
- `src/index.css` (`@layer components`) — clases base `.admin-card`,
  `.admin-input`, `.btn-primary`, etc.

## Agregar una sección nueva

1. Crea `src/pages/admin/MiSeccion.jsx` usando `LayoutAdmin` + este kit.
2. Añade la ruta en `src/main.jsx` dentro de `<ProtectedRoute>`.
3. Añade el enlace en `src/components/partials/Aside.jsx` y en
   `PALETTE_SECTIONS` de `CommandPalette.jsx`.

## Gráficas

Todas las gráficas viven en `src/components/admin/DataViz.jsx` (SVG puro, sin
dependencias). Son responsivas vía `viewBox`, admiten estados vacíos y usan la
paleta de marca.

```jsx
import { AreaChart, DonutChart, SERIES_COLORS } from "../../components/admin";

<AreaChart
  data={[{ label: "Ene", creadas: 12, completadas: 8 }]}
  series={[
    { key: "creadas", label: "Creadas", color: SERIES_COLORS[0] },
    { key: "completadas", label: "Completadas", color: SERIES_COLORS[1] },
  ]}
  height={280}
/>
```

### Contrato de datos de la API

Las gráficas se alimentan de `useAnalytics()`. Si el backend expone
`GET /analytics/*`, sus valores mandan; si no, se calculan en el cliente.
El contrato completo está en [`docs/API-ANALYTICS.md`](../../../docs/API-ANALYTICS.md).
