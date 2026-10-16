# API · Diagramas de flujo

> El panel ya incluye un editor completo de diagramas de flujo
> (`src/components/admin/flowchart/`) que guarda cada diagrama **en un proyecto**
> o **en una tarea**. Mientras la API no exponga los endpoints de este documento,
> el panel guarda los diagramas en el `localStorage` del navegador y lo avisa con
> una franja ámbar ("Guardado en este navegador"). En cuanto el backend responda
> en `/projects/{id}/diagrams`, el panel cambia a la API **sin tocar el frontend**.
>
> **Sí es necesario agregar configuración en la API** para que los diagramas se
> compartan entre personas y dispositivos. Todo lo que hay que hacer está aquí.

---

## 1. Resumen de lo que espera el panel

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/projects/{project}/diagrams` | Lista. Filtro opcional `?task_id=` |
| `POST` | `/api/projects/{project}/diagrams` | Crear |
| `GET` | `/api/projects/{project}/diagrams/{diagram}` | Uno |
| `PUT` | `/api/projects/{project}/diagrams/{diagram}` | Actualizar (nombre, vínculo o contenido) |
| `DELETE` | `/api/projects/{project}/diagrams/{diagram}` | Eliminar |
| `GET` | `/api/diagrams` | *(opcional)* Todos los diagramas visibles para el usuario (vista `/admin/diagrams`) |

Detección: el panel considera que la API **no** tiene la función cuando
`GET /projects/{id}/diagrams` responde `404`, `405` o `501`. Cualquier otro
código (200, 403, 500…) significa "la función existe".

Cuando la API existe pero el diagrama no (`GET .../diagrams/999` → 404) el panel
muestra "No se encontró el diagrama".

---

## 2. Modelo de datos

### Tabla `diagrams`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint | — |
| `project_id` | FK → `projects` | Obligatorio. Todo diagrama pertenece a un proyecto |
| `task_id` | FK → `tasks`, `nullable` | Si viene, el diagrama es **de esa tarea** (también se lista en el proyecto) |
| `name` | string(160) | — |
| `description` | text, nullable | — |
| `data` | `json` | Nodos, conexiones, vista y ajustes (ver §3). Puede pesar algunos cientos de KB |
| `created_by` | FK → `users`, nullable | Quién lo creó |
| `created_at` / `updated_at` | timestamps | El panel muestra `updated_at` |

### Migración

```php
// database/migrations/2026_10_16_000000_create_diagrams_table.php
Schema::create('diagrams', function (Blueprint $table) {
    $table->id();
    $table->foreignId('project_id')->constrained()->cascadeOnDelete();
    $table->foreignId('task_id')->nullable()->constrained()->nullOnDelete();
    $table->string('name', 160);
    $table->text('description')->nullable();
    $table->json('data');
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();

    $table->index(['project_id', 'task_id']);
});
```

> Si la tabla de tareas no se llama `tasks`, ajusta `constrained('nombre')`.
> Si la base de datos es MySQL < 5.7 / MariaDB sin tipo JSON, usa `longText`.

### Modelo

```php
// app/Models/Diagram.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Diagram extends Model
{
    protected $fillable = ['project_id', 'task_id', 'name', 'description', 'data', 'created_by'];

    protected $casts = ['data' => 'array'];

    public function project() { return $this->belongsTo(Project::class); }
    public function task()    { return $this->belongsTo(Task::class); }
    public function author()  { return $this->belongsTo(User::class, 'created_by'); }
}
```

Relaciones inversas (opcionales pero útiles):

```php
// Project.php
public function diagrams() { return $this->hasMany(Diagram::class); }
// Task.php
public function diagrams() { return $this->hasMany(Diagram::class); }
```

---

## 3. Formato de `data` (lo que manda y espera el panel)

El panel **no necesita que el backend entienda el contenido**: lo guarda y lo
devuelve tal cual. Solo hay que validarlo de forma básica para no almacenar
basura (§4). La estructura, por si se quiere consultar (p. ej. contar nodos):

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "n_abc123",
      "type": "flow",
      "position": { "x": 120, "y": 80 },
      "width": 180,
      "height": 72,
      "zIndex": 0,
      "data": {
        "label": "Revisión interna",
        "shape": "process",
        "locked": false,
        "description": "",
        "link": "",
        "style": {
          "fill": "#eaf3ff", "stroke": "#0060fc", "strokeWidth": 2, "dash": "solid",
          "radius": 10, "opacity": 1, "textColor": "#0f172a", "fontSize": 14,
          "fontWeight": 600, "fontStyle": "normal", "align": "center",
          "valign": "middle", "shadow": true, "icon": "user"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "e_xyz",
      "type": "flow",
      "source": "n_abc123",
      "target": "n_def456",
      "sourceHandle": "bottom",
      "targetHandle": "top",
      "data": {
        "kind": "smoothstep", "label": "Sí", "color": "#64748b", "width": 2,
        "dash": "solid", "animated": false, "markerStart": "none",
        "markerEnd": "arrowclosed", "fontSize": 12, "labelBg": "#ffffff",
        "labelColor": "#334155"
      }
    }
  ],
  "viewport": { "x": 40, "y": 40, "zoom": 1 },
  "settings": {
    "background": "dots", "gridSize": 20, "snap": true, "direction": "TB",
    "canvasColor": "#f8fafc", "minimap": true, "controls": true,
    "edgeKind": "smoothstep", "animatedEdges": false, "theme": "appsline"
  }
}
```

Formas (`data.shape`): `terminal`, `process`, `decision`, `io`, `subprocess`,
`document`, `database`, `manual`, `preparation`, `delay`, `connector`,
`offpage`, `note`, `text`, `swimlane`. Conectores (`sourceHandle`/`targetHandle`):
`top`, `right`, `bottom`, `left`.

La referencia es `src/utils/diagrams.js` (`normalizeDiagram`), que además tolera
`data` serializado como texto JSON.

---

## 4. Validación y controlador

```php
// app/Http/Requests/StoreDiagramRequest.php
public function rules(): array
{
    return [
        'name' => ['required', 'string', 'max:160'],
        'description' => ['nullable', 'string', 'max:5000'],
        'task_id' => [
            'nullable', 'integer',
            // La tarea debe pertenecer al mismo proyecto de la URL.
            Rule::exists('tasks', 'id')->where('project_id', $this->route('project')->id),
        ],
        'data' => ['required', 'array'],
        'data.version' => ['nullable', 'integer'],
        'data.nodes' => ['present', 'array', 'max:2000'],
        'data.nodes.*.id' => ['required', 'string', 'max:64'],
        'data.nodes.*.position.x' => ['required', 'numeric'],
        'data.nodes.*.position.y' => ['required', 'numeric'],
        'data.nodes.*.data.label' => ['nullable', 'string', 'max:2000'],
        'data.nodes.*.data.link' => ['nullable', 'string', 'max:2048'],
        'data.edges' => ['present', 'array', 'max:4000'],
        'data.edges.*.id' => ['required', 'string', 'max:64'],
        'data.edges.*.source' => ['required', 'string', 'max:64'],
        'data.edges.*.target' => ['required', 'string', 'max:64'],
        'data.viewport' => ['nullable', 'array'],
        'data.settings' => ['nullable', 'array'],
    ];
}
```

> El tamaño del JSON puede superar el límite por defecto de PHP si el diagrama
> es grande: revisa `post_max_size` (p. ej. `8M`) y, si usas un middleware de
> tamaño máximo de request, permite al menos 2 MB en estas rutas.

```php
// app/Http/Controllers/Api/DiagramController.php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDiagramRequest;
use App\Http\Resources\DiagramResource;
use App\Models\Diagram;
use App\Models\Project;
use Illuminate\Http\Request;

class DiagramController extends Controller
{
    public function index(Request $request, Project $project)
    {
        $this->authorize('view', $project);

        $query = $project->diagrams()->with('task:id,title')->latest('updated_at');
        if ($request->filled('task_id')) {
            $query->where('task_id', $request->integer('task_id'));
        }

        return DiagramResource::collection($query->get());
    }

    public function store(StoreDiagramRequest $request, Project $project)
    {
        $this->authorize('update', $project);

        $diagram = $project->diagrams()->create([
            ...$request->validated(),
            'created_by' => $request->user()->id,
        ]);

        return new DiagramResource($diagram->load('task:id,title'));
    }

    public function show(Project $project, Diagram $diagram)
    {
        $this->authorize('view', $project);
        abort_unless($diagram->project_id === $project->id, 404);

        return new DiagramResource($diagram->load('task:id,title'));
    }

    public function update(StoreDiagramRequest $request, Project $project, Diagram $diagram)
    {
        $this->authorize('update', $project);
        abort_unless($diagram->project_id === $project->id, 404);

        $diagram->update($request->validated());

        return new DiagramResource($diagram->fresh()->load('task:id,title'));
    }

    public function destroy(Project $project, Diagram $diagram)
    {
        $this->authorize('update', $project);
        abort_unless($diagram->project_id === $project->id, 404);

        $diagram->delete();

        return response()->noContent();
    }

    /** Opcional: GET /api/diagrams — todos los del usuario (vista global). */
    public function all(Request $request)
    {
        $projectIds = Project::query()
            ->visibleTo($request->user()) // adapta al criterio que ya uses en /projects
            ->pluck('id');

        $diagrams = Diagram::whereIn('project_id', $projectIds)
            ->with(['task:id,title', 'project:id,name'])
            ->latest('updated_at')
            ->get();

        return DiagramResource::collection($diagrams);
    }
}
```

Si el proyecto no tiene políticas (`authorize`), sustituye esas líneas por la
comprobación que ya uses en `TaskController`.

### Recurso (respuesta)

```php
// app/Http/Resources/DiagramResource.php
public function toArray($request): array
{
    return [
        'id' => $this->id,
        'project_id' => $this->project_id,
        'task_id' => $this->task_id,
        'task' => $this->whenLoaded('task', fn () => ['id' => $this->task->id, 'title' => $this->task->title]),
        'project' => $this->whenLoaded('project', fn () => ['id' => $this->project->id, 'name' => $this->project->name]),
        'name' => $this->name,
        'description' => $this->description,
        'data' => $this->data,
        'created_by' => $this->created_by,
        'created_at' => $this->created_at,
        'updated_at' => $this->updated_at,
    ];
}
```

El panel acepta la respuesta envuelta en `data` (como el resto de la API) o
directa; también acepta `title` en lugar de `name`.

### Rutas

```php
// routes/api.php (dentro del grupo auth:sanctum ya existente)
Route::apiResource('projects.diagrams', DiagramController::class)->scoped();
Route::get('diagrams', [DiagramController::class, 'all']); // opcional
```

> `->scoped()` hace que `{diagram}` se resuelva dentro del proyecto. Si tu
> versión de Laravel no lo soporta, la comprobación `abort_unless(...)` del
> controlador cubre el caso.

---

## 5. Listados ligeros (recomendado)

`index` devuelve `data` completo porque el panel pinta una **miniatura** de cada
diagrama a partir de los nodos. Si los diagramas crecen mucho, dos opciones:

1. Devolver en `index` solo `data.nodes` con `id`, `position`, `width`, `height`
   y `data.shape`/`data.style.fill`/`stroke`, y `data.edges` con `source`/`target`.
   El panel ya tolera nodos sin el resto de campos.
2. Guardar una miniatura PNG (`thumbnail_url`) generada por el panel —no está
   implementado aún en el frontend; si lo quieres, hay que agregar el campo y
   un `POST .../diagrams/{id}/thumbnail` multipart.

---

## 6. Adjuntar el diagrama como archivo

Desde el editor, **Exportar → Adjuntar como archivo** sube un `PNG` y un `.flow.json`
usando los endpoints **que ya existen**:

- `POST /projects/{id}/files` (archivo general del proyecto), o
- `POST /projects/{id}/tasks/{taskId}/files` si el diagrama está vinculado a una tarea.

No requiere nada nuevo en la API. El `.flow.json` se puede volver a importar en
el editor (Exportar → Importar JSON).

---

## 7. Migrar lo guardado en el navegador

Los diagramas creados antes de tener la API viven en `localStorage`
(`appsline.diagrams.v1`). Cada usuario puede:

- Exportarlos a JSON desde el editor e importarlos después, o
- Usar `migrateLocalDiagrams(projectId)` (`src/services/diagrams.js`) desde la
  consola del navegador: envía cada diagrama local con `POST` y lo elimina del
  almacenamiento local al confirmarse. No está expuesto en la UI a propósito,
  para no mover datos sin que el usuario lo decida.

---

## 8. Checklist

**Base de datos**

- [ ] Migración `diagrams` (`project_id`, `task_id` nullable, `name`, `description`, `data` JSON, `created_by`).

**API**

- [ ] `GET/POST /projects/{id}/diagrams`, `GET/PUT/DELETE /projects/{id}/diagrams/{diagramId}`.
- [ ] Filtro `?task_id=` en el listado.
- [ ] Validación del `data` (arreglos `nodes`/`edges`, límites de tamaño).
- [ ] Permisos iguales a los de las tareas del proyecto.
- [ ] `post_max_size` suficiente para diagramas grandes.
- [ ] *(Opcional)* `GET /diagrams` para la vista global.

**Panel (ya hecho)**

- [x] Editor con 15 formas, conexiones configurables, etiquetas, colores, tipografía,
      iconos, bloqueo, capas, alineación/distribución, auto-acomodo, temas, plantillas,
      deshacer/rehacer, copiar/pegar, menú contextual, atajos y pantalla completa.
- [x] Exportar PNG / SVG / JSON, importar JSON, adjuntar al proyecto o a la tarea.
- [x] Pestaña **Diagramas** del proyecto, sección en el detalle de tarea y vista global `/admin/diagrams`.
- [x] Autoguardado, aviso de cambios sin guardar y respaldo local cuando la API no existe.
