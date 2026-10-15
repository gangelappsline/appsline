# API de Analítica — Contrato para el backend

> Documento de referencia para el equipo de backend (Laravel).
> El panel administrativo (`/admin/dashboard`, `/admin/analytics`, `/admin/reports`)
> consume estos endpoints para construir KPIs, gráficas y reportes.
>
> **Regla de oro:** mientras un endpoint no exista, el panel **no se rompe**.
> Calcula todo en el cliente y lo muestra igual. En cuanto el endpoint exista,
> el backend pasa a ser la fuente de verdad sin tocar el frontend.

---

## 1. Autenticación y formato de las respuestas

| Tema | Regla |
|---|---|
| **Auth** | `Authorization: Bearer {token}` (Laravel Passport). El cliente ya lo envía automáticamente. |
| **Base URL** | `https://api.appsline.com.mx/api` (variable `VITE_API_URL`). |
| **Envelope** | Todo lo nuevo debe venir envuelto en `data`: `{ "data": { ... } }`. |
| **Listas** | `{ "data": [ ... ] }` o `{ "data": { "data": [ ... ] } }` (paginador Laravel). Ambas formas se aceptan. |
| **Fechas** | ISO-8601 con zona horaria: `"2026-10-15T14:30:00-06:00"`. Para fechas sin hora se acepta `"2026-10-15"`. |
| **Ratios** | **Siempre entre 0 y 1** (`0.87` = 87 %). El frontend convierte a porcentaje. Si envías `87`, el panel lo detecta y lo divide entre 100. |
| **Dinero** | Número decimal plano en la moneda del proyecto (MXN). Sin símbolo ni separador de miles. |
| **Nulos** | Usa `null` (no `0`) cuando el dato no existe. `0` significa "cero real". |
| **Errores** | `4xx`/`5xx` con `{ "message": "..." }`. Si un endpoint opcional no existe, responde `404` y el panel lo ignora. |

---

## 2. Endpoints nuevos

Todos son **opcionales**: el panel funciona sin ellos. Si implementas solo uno,
ese es el que manda; los demás se siguen calculando en el cliente.

### 2.1 `GET /analytics/overview`

Resumen ejecutivo de un periodo. Es el endpoint más importante.

**Query params (todos opcionales)**

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `from` | `YYYY-MM-DD` | −30 días | Inicio del periodo. |
| `to` | `YYYY-MM-DD` | hoy | Fin del periodo. |
| `days` | `int` | `30` | Longitud del periodo en días (alternativa a `from`/`to`). |
| `client_id` | `int` | — | Filtra por cliente. |
| `status` | `string` | — | Filtra por estado de proyecto. |
| `project_id` | `int` | — | Filtra por proyecto. |

**Respuesta esperada**

```jsonc
{
  "data": {
    "period": {
      "from": "2026-09-15",
      "to": "2026-10-15",
      "days": 30
    },
    "previous_period": {
      "from": "2026-08-16",
      "to": "2026-09-14",
      "days": 30
    },

    // ---- KPIs (los que alimentan las tarjetas del dashboard) ----
    "kpis": {
      "total_projects": 12,
      "active_projects": 7,          // no cerrados (active / in_progress / pending)
      "completed_projects": 4,
      "total_tasks": 318,
      "completed_tasks": 210,
      "pending_tasks": 94,           // tareas sin cerrar
      "overdue_tasks": 14,           // sin cerrar y con due_date < hoy
      "on_time_rate": 0.87,          // 0..1  (completadas a tiempo / cerradas)
      "completion_rate": 0.66,       // 0..1  (completadas / total)
      "avg_cycle_days": 6.4,         // promedio días entre created_at y completed_at
      "total_budget": 1250000,       // suma de projects.budget
      "spent": 830000,               // consumido real (si no hay, = budget * progress)
      "billed_amount": 830000,       // facturado
      "collected_amount": 715000,    // cobrado
      "margin": 0.34,                // 0..1  (1 - spent/budget)
      "active_clients": 9,
      "team_size": 8,                // personas con tareas asignadas
      "utilization": 0.74            // 0..1  (personas a tiempo / equipo)
    },

    // ---- Tendencias vs. el periodo anterior ----
    // Cada valor puede ser un número (%) o { "value": 12.5, "direction": "up" }
    "deltas": {
      "total_tasks": 12.5,
      "completed_tasks": 8.2,
      "created_tasks": 4.1,
      "on_time_rate": 2.4,           // en puntos porcentuales
      "total_budget": 0,
      "overdue_tasks": -3.2
    },

    // ---- Distribuciones (donas) ----
    "status_distribution": [
      { "key": "active",       "label": "En curso",     "value": 7, "tone": "green" },
      { "key": "in_progress",  "label": "En progreso",  "value": 3, "tone": "sky" },
      { "key": "completed",    "label": "Finalizados",  "value": 2, "tone": "slate" }
    ],
    "task_status_distribution": [
      { "key": "pending",    "label": "Pendientes",  "value": 94 },
      { "key": "in_progress","label": "En progreso", "value": 14 },
      { "key": "completed",  "label": "Finalizadas", "value": 210 }
    ],

    // ---- Series mensuales (gráfico de áreas) ----
    "timeline": [
      {
        "date": "2026-10-01",   // o "key": "2026-10"
        "label": "Oct 26",      // etiqueta lista para pintar
        "created": 24,          // tareas creadas en el mes
        "completed": 22,        // tareas completadas en el mes
        "due": 7,               // tareas con vencimiento en el mes
        "value": 22             // valor principal de la serie
      }
    ],

    // ---- Velocidad semanal ----
    "velocity": [
      {
        "week": "2026-W42",     // clave ISO-8601
        "label": "S42",
        "completed": 12,
        "created": 15,
        "net": -3                // completed - created
      }
    ],

    // ---- Actividad diaria (mapa de calor) ----
    "activity": [
      { "date": "2026-10-15", "value": 7 }
    ],

    // ---- Antigüedad de tareas abiertas ----
    "aging": [
      { "bucket": "0-3",   "label": "0-3 días",  "value": 40 },
      { "bucket": "4-7",   "label": "4-7 días",  "value": 22 },
      { "bucket": "8-14",  "label": "8-14 días", "value": 14 },
      { "bucket": "15-30", "label": "15-30 días","value": 10 },
      { "bucket": "30+",   "label": "+30 días",  "value": 8 }
    ],

    // ---- Cartera por cliente ----
    "clients": [
      {
        "client_id": 3,
        "name": "Acme",
        "projects": 3,
        "active": 2,
        "budget": 320000,
        "billed": 200000,
        "progress": 62,          // % de avance promedio
        "share": 26              // % del presupuesto total (opcional: lo calculamos)
      }
    ],
    "client_hhi": 2130,          // índice Herfindahl (0..10000). Opcional.

    // ---- Embudo de proyectos ----
    "funnel": [
      { "label": "Proyectos registrados", "value": 12 },
      { "label": "Con presupuesto",      "value": 10 },
      { "label": "En ejecución",         "value": 7 },
      { "label": "Entregados",          "value": 4 }
    ],

    // ---- Salud multidimensional (radar). Claves = etiquetas de los ejes ----
    "portfolio_health": {
      "Avance": 68,
      "Puntualidad": 87,
      "Presupuesto": 74,
      "Salud": 79,
      "Sin retrasos": 91
    },

    // ---- Presupuesto vs. consumido por mes (opcional) ----
    "budget_timeline": [
      { "date": "2026-10-01", "label": "Oct 26", "budget": 180000, "spent": 132000 }
    ],

    "generated_at": "2026-10-15T10:00:00-06:00"
  }
}
```

---

### 2.2 `GET /analytics/timeseries`

Serie temporal de una métrica concreta (alimenta el "Explorador de series").

**Query params**

| Param | Tipo | Default | Valores posibles |
|---|---|---|---|
| `metric` | `string` | `completed_tasks` | `created_tasks`, `completed_tasks`, `due_tasks`, `overdue_tasks`, `billed_amount`, `collected_amount` |
| `granularity` | `string` | `week` | `day`, `week`, `month` |
| `from` / `to` | `YYYY-MM-DD` | — | Rango. |

**Respuesta**

```jsonc
{
  "data": {
    "metric": "completed_tasks",
    "granularity": "week",
    "series": [
      { "date": "2026-09-28", "label": "S40", "value": 12, "cumulative": 118 }
    ]
  }
}
```

> `label` es opcional: si no lo mandas, el panel usa el mes o la semana ISO.

---

### 2.3 `GET /analytics/projects`

Métricas por proyecto (tabla de "Métricas por proyecto" y burbujas).

**Respuesta** — `data` es un arreglo:

```jsonc
[
  {
    "project_id": 1,
    "name": "Portal de clientes",
    "client": "Acme",
    "status": "active",
    "budget": 45000,
    "spent": 28000,
    "invoiced": 30000,
    "progress": 72,             // % 0..100
    "tasks_total": 24,
    "tasks_completed": 17,
    "overdue": 2,
    "on_time_rate": 0.88,       // 0..1
    "avg_cycle_days": 4.2,
    "days_remaining": 12,       // puede ser negativo (retrasado)
    "health_score": 82,         // 0..100
    "health_level": "good"      // good | watch | risk
  }
]
```

> **Atajo:** si prefieres no crear este endpoint, el panel calcula todo
> combinando `GET /projects` + `GET /projects/{id}/tasks`.

---

### 2.4 `GET /analytics/team`

Métricas por persona del equipo.

**Respuesta** — `data` es un arreglo:

```jsonc
[
  {
    "user_id": 1,
    "name": "Ana García",
    "role": "dev",              // opcional
    "assigned": 24,            // total de tareas asignadas
    "completed": 17,
    "in_progress": 4,
    "pending": 3,
    "overdue": 2,
    "on_time": 15,
    "late": 2,
    "on_time_rate": 0.88,      // 0..1
    "productivity": 88,        // 0..100 (alias de on_time_rate en %)
    "avg_cycle_days": 4.2,
    "utilization": 92,         // % de ocupación
    "workload": 17             // % de tareas en progreso
  }
]
```

---

### 2.5 `GET /analytics/financial`

Resumen económico del portafolio (pestaña "Financiero" de Reportes).

**Respuesta**

```jsonc
{
  "data": {
    "currency": "MXN",
    "billed_amount": 830000,      // facturado
    "collected_amount": 715000,   // cobrado
    "pending_amount": 115000,    // facturado y no cobrado
    "costs": 545000,             // costos/consumo
    "margin": 0.34,              // 0..1
    "margin_percent": 34,        // 0..100 (alternativa)
    "by_client": [
      { "client_id": 3, "name": "Acme", "budget": 320000, "billed": 200000, "collected": 180000, "pending": 20000 }
    ],
    "monthly": [
      { "date": "2026-10-01", "label": "Oct 26", "billed": 95000, "collected": 82000 }
    ]
  }
}
```

---

### 2.6 `GET /analytics/export`

Exportación server-side de reportes (opcional; el panel ya exporta CSV y JSON
en el cliente, así que este endpoint es solo un extra).

**Query params**

| Param | Tipo | Default | Valores |
|---|---|---|---|
| `type` | `string` | `projects` | `projects`, `team`, `clients`, `financial`, `overview` |
| `format` | `string` | `csv` | `csv`, `xlsx`, `pdf`, `json` |
| `from` / `to` | `YYYY-MM-DD` | — | Rango. |

**Respuesta**

- `format=csv|xlsx|pdf` → el **archivo binario** directamente
  (`Content-Type` adecuado + `Content-Disposition: attachment; filename="reporte.csv"`).
- `format=json` → `{ "data": { ... } }` con el mismo contenido del reporte.

---

## 3. Endpoint existente: `GET /dashboard`

Sigue funcionando igual, pero puedes **enriquecerlo** para que el panel muestre
más información sin necesidad de los endpoints nuevos.

**Campos que el panel ya lee** (no cambies sus nombres):

| Clave | Tipo | Notas |
|---|---|---|
| `tasks_by_status` | `object` | `{ pending: 12, in_progress: 8, completed: 30 }` |
| `tasks_per_user` | `array` | `{ id, name, total, on_time, late, total_completed }` |
| `projects_forecast` | `array` | `{ id, name, on_time_percent }` (0..1) |
| `overall.on_time_rate` | `number` | 0..1 |
| `projects` | `array` | Proyectos con sus `tasks` anidadas (opcional) |
| `tasks` | `array` | Tareas planas (opcional) |

**Campos nuevos recomendados** (el panel los detecta y los usa si aparecen):

```jsonc
{
  "data": {
    "overall": {
      "on_time_rate": 0.87,
      "total_tasks": 318,
      "completed_tasks": 210,
      "overdue_tasks": 14,
      "avg_cycle_days": 6.4
    },
    "projects_forecast": [
      { "id": 1, "name": "Portal de clientes", "on_time_percent": 0.92, "progress": 72, "budget": 45000 }
    ]
  }
}
```

---

## 4. Endpoint existente: `GET /projects` y `GET /projects/{id}/tasks`

Para que los cálculos locales (y los nuevos) sean precisos, añade estos campos
**a los proyectos**:

| Campo | Tipo | Ejemplo | Para qué sirve |
|---|---|---|---|
| `client_id` | `int` | `3` | Agrupar la cartera por cliente (si no, se usa `client_name`). |
| `client.name` | `string` | `"Acme"` | Nombre real del cliente. |
| `start_date` | `date` | `"2026-09-01"` | **Importante**: permite calcular el avance esperado vs. real. |
| `end_date` | `date` | `"2026-11-20"` | Fecha de entrega. |
| `budget` | `number` | `45000` | Presupuesto del proyecto. |
| `spent` | `number` | `28000` | **Importante**: consumo real (costo acumulado). |
| `invoiced` | `number` | `30000` | Facturado al cliente. |
| `status` | `string` | `"active"` | `active`, `in_progress`, `pending`, `completed`, `rejected`, `paused`. |
| `tasks_count` | `int` | `24` | Total de tareas (atajo al conteo). |
| `completed_tasks` | `int` | `17` | Tareas completadas (atajo). |

Y a las **tareas**:

| Campo | Tipo | Ejemplo | Para qué sirve |
|---|---|---|---|
| `created_at` | `datetime` | `"2026-10-01T10:00:00-06:00"` | **Imprescindible**: series mensuales, ciclo y antigüedad. |
| `completed_at` | `datetime` | `"2026-10-18T15:00:00-06:00"` | **Imprescindible**: puntualidad y velocidad. |
| `due_date` | `date` | `"2026-10-20"` | Vencimientos y tareas atrasadas. |
| `assigned_to` | `object` | `{ "id": 1, "name": "Ana" }` | Carga por persona (también acepta el id suelto). |
| `status` | `string` | `"in_progress"` | `pending`, `in_progress`, `completed`, `rejected`. |
| `priority` | `string` | `"high"` | `high`, `medium`, `low`. |
| `project_id` | `int` | `1` | Para agrupar tareas por proyecto. |

> Si `created_at` / `completed_at` no existen, el panel funciona pero las
> gráficas de evolución, velocidad y antigüedad quedan vacías.

---

## 5. Cálculos que hace el panel (para que los compares con los del backend)

| KPI | Fórmula del cliente |
|---|---|
| `on_time_rate` | tareas cerradas con `completed_at <= due_date` ÷ tareas cerradas |
| `completion_rate` | tareas `completed` ÷ total de tareas |
| `avg_cycle_days` | promedio de (`completed_at` − `created_at`) en días |
| `overdue_tasks` | no cerradas **y** `due_date` < hoy |
| `health_score` | 70 base ± desviación de calendario (±30) − penalización por vencidas (≤20) − penalización por impuntualidad (≤20) − penalización por sobreconsumo de presupuesto (12). Rango 0..100. |
| `health_level` | `good` ≥ 75, `watch` ≥ 50, `risk` < 50 |
| `margin` | 1 − (`spent` ÷ `total_budget`) |
| `client_hhi` | Σ (participación²) de cada cliente, × 10000 |

---

## 6. Ejemplo mínimo en Laravel

### `routes/api.php`

```php
Route::middleware('auth:api')->prefix('analytics')->group(function () {
    Route::get('overview',  [AnalyticsOverviewController::class, 'index']);
    Route::get('timeseries',[AnalyticsTimeseriesController::class, 'index']);
    Route::get('projects',  [AnalyticsProjectsController::class, 'index']);
    Route::get('team',      [AnalyticsTeamController::class, 'index']);
    Route::get('financial', [AnalyticsFinancialController::class, 'index']);
    Route::get('export',    [AnalyticsExportController::class, 'index']);
});
```

### `AnalyticsOverviewController`

```php
public function index(Request $request)
{
    $days  = (int) $request->integer('days', 30);
    $to    = Carbon::parse($request->input('to', Carbon::today()));
    $from  = Carbon::parse($request->input('from', $to->copy()->subDays($days)));

    $prevTo   = $from->copy()->subDay();
    $prevFrom = $prevTo->copy()->subDays($days);

    $tasks = Task::query()
        ->whereBetween('created_at', [$prevFrom, $to])
        ->with('project')
        ->get();

    $closed   = $tasks->whereNotNull('completed_at');
    $onTime   = $closed->filter(fn ($t) => $t->due_date && $t->completed_at->lte($t->due_date))->count();
    $today    = Carbon::today();
    $overdue  = $tasks->filter(fn ($t) => !$t->completed_at && $t->due_date && $t->due_date->lt($today))->count();
    $cycleAvg = $closed->filter(fn ($t) => $t->created_at)
        ->avg(fn ($t) => $t->created_at->diffInDays($t->completed_at));

    $projects = Project::with('tasks')->get();

    return response()->json(['data' => [
        'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'days' => $days],
        'previous_period' => ['from' => $prevFrom->toDateString(), 'to' => $prevTo->toDateString(), 'days' => $days],

        'kpis' => [
            'total_projects'    => $projects->count(),
            'active_projects'   => $projects->whereNotIn('status', ['completed', 'rejected'])->count(),
            'completed_projects'=> $projects->where('status', 'completed')->count(),
            'total_tasks'       => Task::count(),
            'completed_tasks'   => Task::where('status', 'completed')->count(),
            'pending_tasks'     => Task::whereNull('completed_at')->count(),
            'overdue_tasks'     => $overdue,
            'on_time_rate'      => $closed->count() ? round($onTime / $closed->count(), 4) : 0,
            'completion_rate'   => Task::count() ? round(Task::where('status', 'completed')->count() / Task::count(), 4) : 0,
            'avg_cycle_days'    => round((float) $cycleAvg, 1),
            'total_budget'      => (float) $projects->sum('budget'),
            'spent'             => (float) $projects->sum('spent'),
            'billed_amount'     => (float) $projects->sum('invoiced'),
            'collected_amount'  => (float) $projects->sum('collected'),
            'margin'            => $projects->sum('budget') > 0
                                     ? round(1 - $projects->sum('spent') / $projects->sum('budget'), 4) : 0,
            'active_clients'    => $projects->pluck('client_id')->filter()->unique()->count(),
            'team_size'         => Task::whereNotNull('assigned_to')->distinct('assigned_to')->count('assigned_to'),
        ],

        'deltas' => [
            'total_tasks'     => $this->delta($current, $previous),
            'completed_tasks' => $this->delta($currentCompleted, $previousCompleted),
        ],

        'status_distribution' => $projects->groupBy('status')->map(fn ($g, $status) => [
            'key'   => $status,
            'label' => __('projects.status.' . $status),
            'value' => $g->count(),
        ])->values(),

        'timeline' => $this->timeline($tasks, $from, $to),
        'velocity' => $this->velocity($tasks),
        'aging'    => $this->aging($tasks),
        'clients'  => $this->clients($projects),
        'funnel'   => $this->funnel($projects),
        'portfolio_health' => $this->portfolioHealth($projects),

        'generated_at' => now()->toIso8601String(),
    ]]);
}
```

### `AnalyticsTeamController` (extracto)

```php
public function index()
{
    $rows = User::query()
        ->withSum(['tasks as assigned_count'   => fn ($q) => $q->whereNull('completed_at')], 'id')
        ->withSum(['tasks as completed_count' => fn ($q) => $q->whereNotNull('completed_at')], 'id')
        ->get()
        ->map(fn ($u) => [
            'user_id'         => $u->id,
            'name'            => $u->name,
            'assigned'        => (int) $u->assigned_count,
            'completed'       => (int) $u->completed_count,
            'overdue'         => $u->tasks->where(fn ($t) => !$t->completed_at && $t->due_date?->lt(today()))->count(),
            'on_time'         => $u->tasks->where(fn ($t) => $t->completed_at && $t->due_date && $t->completed_at->lte($t->due_date))->count(),
            'late'            => $u->tasks->where(fn ($t) => $t->completed_at && $t->due_date && $t->completed_at->gt($t->due_date))->count(),
            'on_time_rate'    => $this->rate($u),
            'productivity'    => (int) round($this->rate($u) * 100),
            'avg_cycle_days'  => $this->cycle($u),
        ]);

    return response()->json(['data' => $rows]);
}
```

---

## 7. Checklist de implementación (en este orden)

1. **Añadir `created_at`, `completed_at`, `due_date`, `assigned_to` a las tareas**
   y `start_date`, `end_date`, `budget`, `spent`, `status`, `client_id` a los
   proyectos. → Con esto solo, el panel ya muestra el 90 % de las gráficas.
2. **`GET /analytics/overview`** → KPIs, distribuciones, timeline, velocity, aging.
3. **`GET /analytics/team`** → tabla y ranking del equipo.
4. **`GET /analytics/projects`** → tabla de métricas y burbujas presupuesto/avance.
5. **`GET /analytics/timeseries`** → explorador de series con datos del servidor.
6. **`GET /analytics/financial`** → facturación, flujo de caja y margen.
7. **`GET /analytics/export`** (opcional) → PDF/XLSX desde el backend.

---

## 8. Cómo validar la integración

Desde el panel, arriba a la derecha del Dashboard verás un indicador:

| Indicador | Significado |
|---|---|
| 🟢 **Datos de la API analítica** | Al menos un endpoint `/analytics/*` respondió correctamente. |
| 🟡 **Cálculo local (API sin /analytics)** | Ningún endpoint de analítica existe (404) y todo se calcula en el navegador. |

Además, la **Barra del panel** (`Ctrl+K`) enlaza a las secciones nuevas:

- `/admin/dashboard?tab=proyectos`
- `/admin/analytics?tab=clientes`
- `/admin/reports?tab=financiero`

---

## 9. Resumen de endpoints

| Método | Ruta | ¿Existe hoy? | Estado |
|---|---|---|---|
| GET | `/dashboard` | Sí | **Enriquecer** con `overall` y `projects_forecast` |
| GET | `/projects` | Sí | **Enriquecer** con `start_date`, `spent`, `client_id`, `tasks_count` |
| GET | `/projects/{id}/tasks` | Sí | **Enriquecer** con `created_at`, `completed_at`, `due_date` |
| GET | `/clients` | Sí | Sin cambios |
| GET | `/users` | Sí | Sin cambios |
| GET | `/analytics/overview` | No | **Nuevo** (opcional) |
| GET | `/analytics/timeseries` | No | **Nuevo** (opcional) |
| GET | `/analytics/projects` | No | **Nuevo** (opcional) |
| GET | `/analytics/team` | No | **Nuevo** (opcional) |
| GET | `/analytics/financial` | No | **Nuevo** (opcional) |
| GET | `/analytics/export` | No | **Nuevo** (opcional) |
