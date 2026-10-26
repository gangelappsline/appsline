# API · Diagramas de flujo

> El mismo editor incluye **mockups de pantallas** (iPhone, Android, tablet y
> web) con elementos configurables, conexiones desde un botón y comentarios del
> equipo: todo viaja dentro de `data`, sin tablas nuevas. Ver
> [`API-MOCKUPS.md`](./API-MOCKUPS.md).
>
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
    "edgeKind": "smoothstep", "animatedEdges": false, "theme": "appsline",
    "nodeSpacing": 80, "rankSpacing": 100
  }
}
```

Formas (`data.shape`): `terminal`, `process`, `decision`, `io`, `subprocess`,
`document`, `database`, `manual`, `preparation`, `delay`, `connector`,
`offpage`, `note`, `text`, `swimlane`, **`image`**, **`icon`** y **`screen`**
(mockups de pantallas, ver [`API-MOCKUPS.md`](./API-MOCKUPS.md)). Conectores (`sourceHandle`/`targetHandle`):
`top`, `right`, `bottom`, `left`.

La referencia es `src/utils/diagrams.js` (`normalizeDiagram`), que además tolera
`data` serializado como texto JSON.

### Imágenes e iconos (compatibles con `version: 1`)

Un nodo `image` agrega este campo a su `data` (el resto del nodo no cambia):

```json
{
  "label": "",
  "shape": "image",
  "image": {
    "src": "data:image/webp;base64,...",
    "name": "logo.webp",
    "alt": "Logo del equipo",
    "fit": "contain",
    "lockAspectRatio": true,
    "naturalWidth": 640,
    "naturalHeight": 400
  }
}
```

- El frontend admite **PNG/JPG/WebP de hasta 5 MB**, reduce el lado mayor a
  1600 px y rasteriza/comprime a WebP (PNG si el navegador no lo soporta).
  Se limita cada `src` embebido a 2 MiB de texto. No acepta SVG, URLs externas,
  `blob:` ni fuentes ejecutables al importar JSON. `fit` admite `contain`/`cover`.
- **No hace falta un endpoint de carga adicional**: `image` viaja en el mismo
  JSON del diagrama. La API debe conservar `data.nodes.*.data.image` completo.
  Si el backend filtra campos internos, incluir este objeto y los campos de
  estilo nuevos en su lista permitida. No registrar estas imágenes en logs.
- Los iconos son claves de `src/components/admin/flowchart/icons.js`, no JSX:
  `data.style.icon: "cloud"`, `data.style.iconSize: 40`. Pueden acompañar el
  texto de una forma o usarse con `shape: "icon"` como elemento independiente.
- Imágenes e iconos persisten en copias, JSON exportado/reimportado, miniaturas,
  PNG/SVG y adjuntos. El autoacomodo usa sus tamaños reales.
- `settings.nodeSpacing` y `settings.rankSpacing` controlan los espacios del
  autoacomodo. Los conectores nulos antiguos se resuelven geométricamente;
  al organizar se recalculan según la dirección, sin cambiar los IDs de nodos
  ni conexiones.

---

## 4. Validación y controlador

> **Regla de oro:** el dibujo (`data`) se guarda y se devuelve **completo, tal
> cual llegó**. En cuanto existe una regla anidada (`data.nodes.*.data.label`,
> `data.edges.*.source`, …), `$request->validated()` **descarta** todo lo que no
> tenga regla propia: `data.shape`, `data.style`, `width`, `height`, `type`,
> `edges[].data` y los handles desaparecen del servidor y, al reabrir el
> diagrama, **todos los nodos vuelven como «Proceso»**. Ver
> [9. Diagnóstico](#9-diagnóstico-todos-los-nodos-vuelven-como-proceso).

### 4.1 Reglas correctas

```php
// app/Http/Requests/StoreDiagramRequest.php
public function rules(): array
{
    return [
        'name'        => ['required', 'string', 'max:160'],
        'description' => ['nullable', 'string', 'max:5000'],
        'task_id'     => [
            'nullable', 'integer',
            // La tarea debe pertenecer al mismo proyecto de la URL.
            Rule::exists('project_tasks', 'id')->where('project_id', $this->route('project')->id),
        ],

        // Una sola regla para el dibujo: SIN 'data.nodes.*' ni 'data.edges.*'.
        'data'        => ['required', 'array'],
    ];
}
```

### 4.2 Por qué: `validated()` poda los arreglos (Laravel ≥ 9)

Desde Laravel 9, `Illuminate\Validation\Factory` trae
`$excludeUnvalidatedArrayKeys = true`, que se propaga a cada validador. Con esa
opción, `validated()` **omite cualquier arreglo que tenga claves hijas
validadas** y devuelve únicamente las claves con regla propia. Es un cambio de
comportamiento respecto de Laravel 8 y no depende de cómo se escriban las
reglas anidadas:

| Reglas del `data` | Lo que devuelve `validated()` |
| --- | --- |
| `'data' => ['required', 'array']` (sola) | `data` completo ✅ |
| `'data' => ['array']` + `'data.nodes' => ['array']` + `'data.nodes.*.data.label'` | `data` **sin** `shape`, `style`, `width`, `height`, `type`; `edges` sin `data` ni handles ❌ |

Ejemplo real (lo que envía el panel → lo que queda en la base de datos con
reglas anidadas):

```jsonc
// PUT del panel
{ "data": { "version": 1, "nodes": [{
    "id": "a", "type": "flow", "width": 160, "height": 60,
    "position": { "x": 120, "y": 60 },
    "data": { "label": "Inicio", "shape": "terminal",
              "style": { "fill": "#e0f2fe", "stroke": "#0284c7" } }
  }], "edges": [{ "id": "e1", "source": "a", "target": "b", "type": "smoothstep",
                  "sourceHandle": "right", "targetHandle": "left",
                  "data": { "label": "sí", "color": "#dc2626" } }],
  "settings": { "background": "dots" } } }

// Lo que guarda $diagram->update($request->validated()) con reglas anidadas
{ "data": { "version": 1, "nodes": [{
    "id": "a", "position": { "x": 120, "y": 60 },
    "data": { "label": "Inicio", "link": null }
  }], "edges": [{ "id": "e1", "source": "a", "target": "b" }],
  "settings": { "background": "dots" } } }
```

Sobreviven `version`, `id`, `position`, `data.label`, `data.link`,
`source`/`target`, `viewport` y `settings` porque tienen regla propia; todo lo
demás se pierde. Al recargar, el panel no encuentra `data.shape` y dibuja el
respaldo (`process`), que es un rectángulo: de ahí que «todos los nodos se
conviertan en nodos de proceso».

### 4.3 Controlador

```php
// app/Http/Controllers/API/DiagramController.php
public function store(StoreDiagramRequest $request, Project $project)
{
    $this->authorize('update', $project);

    $diagram = $project->diagrams()->create([
        ...$request->safe()->only(['name', 'description', 'task_id']),
        // El bloque completo, nunca el subconjunto validado.
        'data'       => $request->input('data'),
        'created_by' => $request->user()->id,
    ]);

    return new DiagramResource($diagram->load('task:id,title'));
}

public function update(StoreDiagramRequest $request, Project $project, Diagram $diagram)
{
    $this->authorize('update', $project);
    abort_unless($diagram->project_id === $project->id, 404);

    $diagram->update([
        ...$request->safe()->only(['name', 'description', 'task_id']),
        'data' => $request->input('data'),
    ]);

    return new DiagramResource($diagram->fresh()->load('task:id,title'));
}
```

El resto de los métodos (`index`, `show`, `destroy`, `all`) y el recurso están
en [`docs/backend-diagrams/`](./backend-diagrams/), listos para copiar.

### 4.4 Si además quieres validar el interior del dibujo

Validar está bien; lo que rompe el guardado es **usar `validated()` para
obtener el dibujo**. Dos salidas:

**a) Validación aparte, guardado íntegro (recomendada).**

```php
// En el controlador, o dentro del FormRequest con after()/withValidator()
Validator::make($request->input('data'), [
    'nodes'                 => ['present', 'array', 'max:2000'],
    'nodes.*.id'            => ['required', 'string', 'max:64'],
    'nodes.*.position.x'    => ['required', 'numeric'],
    'nodes.*.position.y'    => ['required', 'numeric'],
    'edges'                 => ['present', 'array', 'max:4000'],
    'edges.*.source'        => ['required', 'string', 'max:64'],
    'edges.*.target'        => ['required', 'string', 'max:64'],
])->validate();   // solo comprueba: no recorta ni transforma nada

$diagram->update(['data' => $request->input('data')]);
```

**b) Desactivar la poda en toda la API** (afecta a todos los endpoints; úsalo
solo si el resto de la API no depende del comportamiento actual):

```php
// app/Providers/AppServiceProvider.php
public function boot(): void
{
    \Illuminate\Support\Facades\Validator::includeUnvalidatedArrayKeys();
}
```

### 4.5 Límites de tamaño

> Las imágenes aumentan el tamaño del JSON: revisar `post_max_size`, el límite
> del proxy (`client_max_body_size` en Nginx) y cualquier middleware de tamaño
> máximo. Por ejemplo, permitir 20 MB en estas rutas si se necesitan varias
> imágenes. El frontend muestra los errores de guardado/almacenamiento y no
> descarta los cambios; se puede exportar JSON como respaldo.

### 4.6 Verificación en 30 segundos

```bash
API=https://api.appsline.com.mx/api
TOKEN=...   # token de la sesión del panel

curl -sS -X PUT "$API/projects/1/diagrams/1" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  --data-urlencode "name=Prueba de integridad" \
  --data-urlencode "data[nodes][0][id]=a" \
  --data-urlencode "data[nodes][0][type]=flow" \
  --data-urlencode "data[nodes][0][width]=160" \
  --data-urlencode "data[nodes][0][height]=60" \
  --data-urlencode "data[nodes][0][position][x]=120" \
  --data-urlencode "data[nodes][0][position][y]=60" \
  --data-urlencode "data[nodes][0][data][label]=Inicio" \
  --data-urlencode "data[nodes][0][data][shape]=terminal" \
  --data-urlencode "data[nodes][0][data][style][fill]=#e0f2fe" \
  --data-urlencode "data[edges]=[]" \
  --data-urlencode "data[settings][background]=dots" \
  | jq '.data.nodes[0]'
```

La respuesta **debe** incluir `type`, `width`, `height`, `data.shape` y
`data.style.fill`. Si solo aparecen `id`, `position` y `data.label`, la API está
podando el dibujo (reglas anidadas + `validated()`).

En el panel, la misma comprobación está automatizada:
`npm run test:unit` → `tests/unit/diagrams-storage.test.mjs` simula un backend
que poda y verifica que el editor conserva las formas, restaura desde la copia
local y avisa. `tests/diagrams-integrity.spec.mjs` hace lo mismo en el navegador
(`npm run test:e2e`).

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

**Importante para no duplicar con el autoguardado:**

- `POST` debe devolver el **ID definitivo** del registro creado, tanto en la
  respuesta directa (`{id, name, data: {nodes, edges, ...}}`) como envuelta
  (`{data: {id, name, data: {...}}}`). El `data` interno es el dibujo, no otro
  envoltorio de respuesta.
- El editor usa una única petición en vuelo. Tras el primer POST, cambia la URL
  sin reiniciar el lienzo y los siguientes guardados son `PUT /.../diagrams/{id}`.
  El ID de la ruta es autoritativo al editar. `PUT` puede devolver el registro,
  solo metadatos o `204 No Content`.
- Un PUT fallido **no crea un registro local ni otro diagrama**. Los errores
  pausan los reintentos automáticos; el usuario conserva el contenido para
  exportarlo o reintentar con Guardar. Si un POST confirma creación pero no
  devuelve ID, se pide revisar la lista antes de repetirlo.
- El respaldo local sigue disponible cuando los endpoints no existen al crear;
  conserva su ID `local-*` y actualiza el mismo registro. Si se agota la cuota
  del navegador (especialmente con imágenes), el editor avisa que no se guardó.

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

1. Devolver en `index` un `data` reducido con **solo** lo que necesita la
   miniatura —el panel ya tolera nodos sin el resto de campos—:

   ```jsonc
   { "id": 42, "project_id": 1, "name": "Flujo", "task_id": null, "updated_at": "…",
     "data": { "version": 1,
       "nodes": [{ "id": "a", "position": { "x": 120, "y": 60 }, "width": 160, "height": 60,
                   "data": { "shape": "terminal", "style": { "fill": "#e0f2fe" } } }],
       "edges": [{ "source": "a", "target": "b" }] } }
   ```

   Ojo: `id`, `project_id`, `data.nodes[].data.shape` y
   `data.nodes[].data.style.fill` son imprescindibles; sin ellos la tarjeta no
   sabe qué dibujar.
2. Guardar una miniatura PNG (`thumbnail_url`) generada por el panel —no está
   implementado aún en el frontend; si lo quieres, hay que agregar el campo y
   un `POST .../diagrams/{id}/thumbnail` multipart.

**Cómo se comporta el panel con un listado ligero:** al guardar desde una
tarjeta (renombrar, vincular a una tarea, duplicar) detecta que el contenido que
tiene es incompleto y **vuelve a leer el registro individual** antes de enviar,
para no pisar el dibujo del servidor con la versión reducida. Es una petición
extra por guardado; si `GET /projects/{id}/diagrams/{diagramId}` devuelve el
`data` completo, no se pierde nada.

Lo que **no** debe pasar es que el registro individual también llegue podado:
entonces no hay fuente buena y el panel avisa (sección 9).

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
- [ ] `data` declarado como `array` en `casts()` del modelo.

**API**

- [ ] `GET/POST /projects/{id}/diagrams`, `GET/PUT/DELETE /projects/{id}/diagrams/{diagramId}`.
- [ ] Filtro `?task_id=` en el listado.
- [ ] **Reglas de validación: `'data' => ['required','array']` y ninguna regla `data.*` anidada** (sección 4.1).
- [ ] **Guardado con `$request->input('data')`, no con `$request->validated()['data']`** (sección 4.3).
- [ ] `curl` de verificación: la respuesta conserva `data.shape` y `data.style` (sección 4.6).
- [ ] Permisos iguales a los de las tareas del proyecto.
- [ ] `post_max_size` suficiente para diagramas grandes.
- [ ] *(Opcional)* `GET /diagrams` para la vista global.

**Panel (ya hecho)**

- [x] Editor con 17 formas, conexiones configurables, etiquetas, colores, tipografía,
      iconos, bloqueo, capas, alineación/distribución, auto-acomodo, temas, plantillas,
      deshacer/rehacer, copiar/pegar, menú contextual, atajos y pantalla completa.
- [x] Exportar PNG / SVG / JSON, importar JSON, adjuntar al proyecto o a la tarea.
- [x] Pestaña **Diagramas** del proyecto, sección en el detalle de tarea y vista global `/admin/diagrams`.
- [x] Autoguardado, aviso de cambios sin guardar y respaldo local cuando la API no existe.
- [x] **Integridad del contenido**: detecta la respuesta podada, completa el dibujo con la
      copia local, no sobrescribe el servidor con contenido degradado y muestra el aviso con
      la corrección exacta (sección 9).

---

## 9. Diagnóstico: todos los nodos vuelven como Proceso

**Síntoma.** Se dibuja un diagrama con varios tipos de nodo (Inicio/Fin,
Decisión, Base de datos, Nota…), se guarda sin errores y, al reabrirlo o
recargar la página, **todos los nodos aparecen como rectángulos de Proceso**;
las flechas pierden etiqueta, color y estilo.

**Causa.** La API aceptó el guardado (200/201) pero devolvió —y guardó— un
registro **incompleto**. Ocurre con reglas de validación anidadas
(`data.nodes.*.data.label`, …) combinadas con `$request->validated()`: desde
Laravel 9 el validador excluye las claves de un arreglo que no tengan regla
propia, y `data.shape` no la tiene. Sin `shape`, el panel aplica el respaldo
`process`. Detalle y arreglo en la sección 4.

**Cómo se ve ahora en el panel.** El editor ya no se queda callado:

- Al **guardar**, si la respuesta viene recortada aparece un aviso ámbar/rojo
  («La API guardó el diagrama pero descartó el tipo de los nodos…») y el pie
  cambia a *Guardado incompleto en la API*. El lienzo de la sesión sigue
  completo.
- Al **abrir**, si el registro del servidor está podado, el panel lo completa
  con la última copia que envió desde ese navegador (`restored`) y lo dice; si
  no tiene copia (otro equipo, otro navegador, almacenamiento limpio), no
  inventa nada: dibuja Proceso y explica que hay que importar el JSON desde
  donde se dibujó.
- **Ver detalle** lista las rutas ausentes (`data.nodes[].data.shape`,
  `data.nodes[].data.style`, `data.edges[].data`, …), cuántos nodos y conexiones
  afectan, el fragmento de Laravel correcto y un botón para **exportar el JSON
  de respaldo**.
- Al **renombrar, vincular o duplicar** desde una tarjeta, el panel vuelve a
  leer el registro completo antes de escribir, así que un listado ligero (o un
  registro podado) no degrada aún más lo que hay en el servidor.

**Qué hacer.**

1. Corregir la API (sección 4): reglas sin anidar + `$request->input('data')`.
   Los archivos listos para copiar están en [`docs/backend-diagrams/`](./backend-diagrams/).
2. Verificar con el `curl` de la sección 4.6 y reabrir un diagrama: las formas
   deben conservarse sin aviso.
3. Mientras tanto, exportar el JSON de los diagramas importantes desde el
   editor (Exportar → Archivo JSON) e importarlos en cuanto la API esté
   corregida.

**Cómo se reproduce en tests.** `tests/unit/diagrams-storage.test.mjs` (capa de
datos, sin navegador) y `tests/diagrams-integrity.spec.mjs` (editor completo con
Playwright) simulan exactamente esta API podada.
