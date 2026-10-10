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
| `Drawer` | Panel lateral deslizante (`wide` para detalle de tareas) |
| `ConfirmDialog` | Confirmación de acciones destructivas (en vez de `window.confirm`) |
| `SearchInput` | Buscador con botón para limpiar |
| `StatCard` | Métrica con icono, tono y barra de progreso opcional |
| `Tabs` | Pestañas `pill` o `underline`, con contadores |
| `TableSkeleton` / `CardsSkeleton` | Esqueletos de carga |
| `ProgressRing` / `BarChart` / `RankBars` | Gráficos SVG sin dependencias |
| `Field` | Etiqueta + ayuda + error para formularios |
| `ToastProvider` / `useToast` | Notificaciones (`notify("Mensaje", "success" \| "error" \| "info")`) |
| `CommandPalette` | Buscador global con `Ctrl+K` (secciones + proyectos) |

## Capas de apoyo

- `src/services/admin.js` — todas las llamadas a la API del panel
  (proyectos, tareas, usuarios, productos, dashboard) con normalizadores
  de respuesta. Si el backend cambia, se ajusta solo aquí.
- `src/hooks/useDashboard.js` — datos agregados (KPIs, productividad,
  vencimientos) compartidos por Dashboard y Reportes.
- `src/utils/format.js` — moneda, fechas, estados, prioridades y CSV.
- `src/utils/prefs.js` — preferencias en `localStorage`.
- `src/index.css` (`@layer components`) — clases base `.admin-card`,
  `.admin-input`, `.btn-primary`, etc.

## Agregar una sección nueva

1. Crea `src/pages/admin/MiSeccion.jsx` usando `LayoutAdmin` + este kit.
2. Añade la ruta en `src/main.jsx` dentro de `<ProtectedRoute>`.
3. Añade el enlace en `src/components/partials/Aside.jsx` y en
   `PALETTE_SECTIONS` de `CommandPalette.jsx`.
