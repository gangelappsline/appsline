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
