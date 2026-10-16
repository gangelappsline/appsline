# Tareas continuas, recurrencia, texto enriquecido y varias personas asignadas

Contrato con la API para las mejoras del tablero de tareas:

1. **Tareas continuas / recurrentes** (`ongoing`): trabajo que se mantiene abierto
   y **no tiene fecha de entrega** (soporte, mantenimiento, seguimiento de un
   cliente). Opcionalmente llevan una **cadencia** para programar la siguiente
   ronda.
2. **Descripciones y comentarios con formato**: el texto viaja como **HTML
   sencillo** (`<strong>`, `<ul><li>`, `<a>`…), no como texto plano.
3. **Varias personas asignadas** a una misma tarea (`assignees`), manteniendo
   `assigned_to` por compatibilidad. Ver §4.

> El frontend ya está implementado (`src/utils/tasks.js` y
> `src/utils/richText.js` son la referencia). Este documento es la parte que hay
> que tocar en la API: migración, validación, saneado y respuesta.

---

## 1. Campos nuevos en `tasks`

| Campo | Tipo | Valores | Notas |
|---|---|---|---|
| `task_type` | `string` | `once` (por defecto) · `ongoing` | `ongoing` = tarea continua |
| `recurrence` | `string\|null` | `none` · `daily` · `weekly` · `biweekly` · `monthly` · `quarterly` | Cadencia de renovación; solo tiene sentido con `task_type = ongoing` |
| `due_date` | `date\|null` | — | **`null` en las tareas continuas** |
| `description` | `text` | HTML sencillo | Antes era texto plano |
| comentario | `text` | HTML sencillo | Campo `comment` de `task_comments` |

Reglas de negocio:

- Una tarea `ongoing` **nunca** vence: si llega `due_date` junto a
  `task_type = ongoing`, guárdalo como `null` (o rechaza la petición con un 422
  explicando el motivo).
- `recurrence` distinto de `none` **implica** `task_type = ongoing`.
- Una tarea **sin fecha y sin cadencia no es continua**: puede ser una tarea
  puntual todavía sin agendar. No la marques como `ongoing` por eso.
- Al pasar una tarea a `ongoing` (`PUT`), limpia su `due_date`. El panel ya lo
  hace en la misma petición (`{ task_type: "ongoing", due_date: null }`).

### Migración (Laravel)

```php
// database/migrations/xxxx_xx_xx_xxxxxx_add_task_type_to_tasks_table.php
Schema::table('tasks', function (Blueprint $table) {
    $table->string('task_type', 20)->default('once')->after('status');   // once|ongoing
    $table->string('recurrence', 20)->nullable()->after('task_type');    // none|daily|weekly|...
    $table->index(['project_id', 'task_type']);
});
```

### Modelo y validación

```php
// app/Models/Task.php
protected $fillable = [
    'title', 'description', 'status', 'priority', 'assigned_to',
    'due_date', 'estimated_hours', 'task_type', 'recurrence',
];

protected $casts = ['due_date' => 'date'];

public const RECURRENCES = ['none', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly'];

public function isOngoing(): bool
{
    return $this->task_type === 'ongoing';
}

/** Una tarea continua no guarda fecha de entrega. */
public function setDueDateAttribute($value): void
{
    $this->attributes['due_date'] = $this->isOngoing() ? null : $value;
}
```

```php
// app/Http/Requests/StoreTaskRequest.php
public function rules(): array
{
    return [
        'title' => ['required', 'string', 'max:255'],
        'description' => ['nullable', 'string', 'max:20000'],
        'status' => ['nullable', 'in:pending,in_progress,completed,rejected'],
        'priority' => ['nullable', 'in:low,medium,high'],
        'assigned_to' => ['nullable', 'exists:users,id'],
        'estimated_hours' => ['nullable', 'numeric', 'min:0'],
        'task_type' => ['nullable', 'in:once,ongoing'],
        'recurrence' => ['nullable', 'in:none,daily,weekly,biweekly,monthly,quarterly'],
        // Obligatoria solo en las tareas puntuales.
        'due_date' => [
            Rule::requiredIf(fn () => $this->input('task_type') !== 'ongoing'),
            'nullable', 'date',
        ],
    ];
}
```

### Respuesta del recurso

Conviene devolver siempre los campos (aunque sean por defecto) para que el
panel no tenga que adivinar:

```json
{
  "data": {
    "id": 42,
    "title": "Soporte mensual",
    "description": "<p>Atender <strong>tickets</strong></p><ul><li>Revisar SLA</li></ul>",
    "status": "in_progress",
    "priority": "medium",
    "task_type": "ongoing",
    "recurrence": "monthly",
    "due_date": null,
    "assigned_to": 7,
    "estimated_hours": 4
  }
}
```

Tolerancia del frontend: si el backend todavía usa otros nombres, el panel
reconoce `is_ongoing`, `ongoing`, `is_recurring`, `recurring`, `type` y
`recurrence_type`. Igual con la cadencia: acepta `semanal`, `mensual`,
`bi-weekly`, etc. (ver `normalizeRecurrence` en `src/utils/tasks.js`).

---

## 2. Texto enriquecido (`description` y comentarios)

### Qué manda el panel

HTML **sencillo** normalizado antes de enviarlo (`toRichHtml`):

| Permitido | Ejemplo |
|---|---|
| Párrafos y saltos | `<p>…</p>`, `<br>` |
| Negrita, cursiva, subrayado, tachado | `<strong>`, `<em>`, `<u>`, `<s>` |
| Listas | `<ul><li>…</li></ul>`, `<ol><li>…</li></ol>` |
| Encabezado, cita, código | `<h3>`, `<blockquote>`, `<pre>` |
| Enlaces (`http`, `https`, `mailto`, `tel`, rutas relativas) | `<a href="https://…">` |

Se eliminan `script`, `style`, `iframe`, `object`, `embed`, `svg`, todos los
atributos `on*` y cualquier `href` con protocolo no permitido
(`javascript:` incluido).

### Qué debe hacer la API (importante)

**Sanea también en el servidor.** El frontend sanea al pintar, pero cualquiera
puede llamar a la API directamente: HTMLPurifier con lista blanca es lo
razonable.

```bash
composer require mews/purifier
```

```php
// app/Support/RichText.php
namespace App\Support;

class RichText
{
    /** Mismo criterio que el panel (src/utils/richText.js). */
    public static function clean(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return null;
        }

        $clean = clean($html, [
            'HTML.Allowed' => 'p,br,strong,b,em,i,u,s,del,ins,ul,ol,li,a[href|title],'
                .'h1,h2,h3,h4,blockquote,pre,code,hr,span,sub,sup',
            'HTML.Nofollow' => true,
            'HTML.TargetBlank' => true,
            'URI.AllowedSchemes' => ['http' => true, 'https' => true, 'mailto' => true, 'tel' => true],
        ]);

        // El panel guarda "<p>" en cada línea; evita párrafos vacíos.
        return preg_replace('#<p>(\s|&nbsp;|<br\s*/?>)*</p>#i', '', $clean);
    }
}
```

Aplícalo al guardar la tarea y el comentario:

```php
$data = $request->validated();
$data['description'] = RichText::clean($data['description'] ?? null);
$task = $project->tasks()->create($data);
```

```php
$comment = $task->comments()->create([
    'user_id' => $request->user()->id,
    'comment' => RichText::clean($request->input('comment')),
    'mentions' => $request->input('mentions', []),
]);
```

### Avisos y notificaciones

Los push y los correos **no** deben llevar HTML. Convierte a texto plano:

```php
$resumen = Str::limit(strip_tags($task->description ?? ''), 120);
// "Atender tickets Revisar SLA"
```

Equivalente en el frontend: `richTextPreview(description, 140)`.

### Datos antiguos

Las descripciones y comentarios que ya existen son texto plano: el panel los
detecta (`looksLikeHtml`) y los pinta tal cual (respetando los saltos de línea).
No hace falta migrarlos; si quieres normalizarlos, envuelve cada párrafo en
`<p>` con `nl2br`.

### Menciones

`mentions` sigue siendo un arreglo de **ids de usuario**. El panel las detecta en
el **texto visible** del comentario (incluido el HTML) y las envía igual que
antes: `{ "comment": "<p>Hola <strong>@Ana García</strong></p>", "mentions": [3] }`.
Del lado del servidor, si vuelves a detectar menciones, hazlo sobre
`strip_tags($comment)` o confía en el arreglo recibido.

---

## 3. Recurrencia: quién crea la siguiente ronda

El panel **no** espera que la API replique tareas. Su flujo es explícito:

- En el detalle de una tarea continua con cadencia aparece **“Programar
  siguiente”**. Eso crea una **tarea nueva puntual** con la fecha que toca
  (`nextOccurrenceDate`: +1 día, +7, +14, +1 mes, +3 meses, con ajuste a meses
  cortos) y deja la continua como está:

  ```json
  POST /api/projects/{proyecto}/tasks
  {
    "title": "Reporte semanal",
    "description": "<p>…</p>",
    "status": "pending",
    "priority": "high",
    "assigned_to": 7,
    "estimated_hours": 2,
    "task_type": "once",
    "recurrence": "none",
    "due_date": "2026-10-22"
  }
  ```

- Si prefieres que la renovación sea automática (backend), hazlo **cambiando la
  fecha** de la propia tarea continua al finalizarla (así no se acumulan
  tarjetas) y documenta el comportamiento: el panel solo necesita que `due_date`
  y `status` se reflejen en la respuesta de `GET .../tasks`.

Los avisos de "vence pronto" / "vencida" deben ignorar las tareas `ongoing`
(el panel ya lo hace: `hasDueDate`).

---

## 4. Varias personas asignadas (`assignees`)

### Qué manda el panel

Al crear o editar una tarea el panel envía **las dos cosas**:

```json
{
  "title": "Integrar pasarela de pago",
  "assignees": [3, 7, 12],
  "assigned_to": 3
}
```

- `assignees`: arreglo de **ids de usuario**, sin repetidos, en el orden en que se
  eligieron. Vacío (`[]`) significa "sin asignar".
- `assigned_to`: la **primera** persona del arreglo (o `null`). Existe solo para
  que la API actual siga funcionando mientras se agrega el soporte; cuando la
  API ya lea `assignees`, puede ignorar `assigned_to` o seguir guardándolo como
  "responsable principal".

Al cambiar la asignación desde el detalle de la tarea se manda un `PUT` con esos
dos campos (y nada más).

### Qué espera de vuelta

En `GET .../tasks` y `GET .../tasks/{id}`:

```json
{
  "id": 42,
  "assigned_to": { "id": 3, "name": "Ana García", "avatar": "https://…" },
  "assignees": [
    { "id": 3, "name": "Ana García", "avatar": "https://…" },
    { "id": 7, "name": "Luis Pérez", "avatar": null },
    { "id": 12, "name": "Marta Ruiz", "avatar": null }
  ]
}
```

Tolerancia del panel (`src/utils/assignees.js`): acepta `assignees` como objetos
o como ids (`[3, 7, 12]`), y también `assigned_users`, `assignee_ids` o
`assigned_user_ids`. Si solo llega `assigned_to`, esa persona es la única
asignada. Si llegan ambos y `assigned_to` no está en la lista, se agrega al
frente (así no se pierde nada durante la transición).

### Migración (pivote)

```php
// database/migrations/2026_10_16_000001_create_task_user_table.php
Schema::create('task_user', function (Blueprint $table) {
    $table->foreignId('task_id')->constrained()->cascadeOnDelete();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->unsignedSmallInteger('position')->default(0); // orden elegido en el panel
    $table->timestamps();
    $table->primary(['task_id', 'user_id']);
});

// Copia la asignación actual al pivote para no perder datos.
DB::table('tasks')->whereNotNull('assigned_to')->orderBy('id')->chunk(500, function ($tasks) {
    $rows = $tasks->map(fn ($t) => [
        'task_id' => $t->id, 'user_id' => $t->assigned_to, 'position' => 0,
        'created_at' => now(), 'updated_at' => now(),
    ])->all();
    DB::table('task_user')->insertOrIgnore($rows);
});
```

### Modelo

```php
// app/Models/Task.php
public function assignees()
{
    return $this->belongsToMany(User::class)
        ->withPivot('position')
        ->withTimestamps()
        ->orderByPivot('position');
}

/** Responsable principal (compatibilidad): el primero de la lista. */
public function assignee()
{
    return $this->belongsTo(User::class, 'assigned_to');
}
```

### Validación y guardado

```php
// StoreTaskRequest / UpdateTaskRequest
'assignees' => ['sometimes', 'array', 'max:20'],
'assignees.*' => ['integer', 'distinct', 'exists:users,id'],
'assigned_to' => ['nullable', 'exists:users,id'],
```

```php
// TaskController@store / @update
$data = $request->validated();
$assignees = $data['assignees'] ?? null;
unset($data['assignees']);

// Compatibilidad: si solo llega assigned_to (cliente viejo) se convierte en lista.
if ($assignees === null && array_key_exists('assigned_to', $data)) {
    $assignees = $data['assigned_to'] ? [$data['assigned_to']] : [];
}
if ($assignees !== null) {
    $data['assigned_to'] = $assignees[0] ?? null; // principal = el primero
}

$task = isset($task) ? tap($task)->update($data) : $project->tasks()->create($data);

if ($assignees !== null) {
    $task->assignees()->sync(
        collect($assignees)->values()->mapWithKeys(fn ($id, $i) => [$id => ['position' => $i]])->all()
    );
}

return new TaskResource($task->load('assignees', 'assignee'));
```

### Recurso

```php
// TaskResource
'assigned_to' => $this->whenLoaded('assignee', fn () => UserResource::make($this->assignee)),
'assignees' => UserResource::collection($this->whenLoaded('assignees')),
```

Carga siempre `assignees` en los listados (`->with('assignees')`) para que el
tablero no tenga que adivinar.

### Dónde impacta en el resto de la API

- **Notificaciones** (push, correo, "tarea asignada", menciones): avisar a
  **todas** las personas de `assignees`, no solo a `assigned_to`.
- **"Mis tareas" / filtros por usuario**: `whereHas('assignees', fn ($q) => $q->where('users.id', $userId))`
  en lugar de `where('assigned_to', $userId)`.
- **Analítica por persona** (`/analytics/team`, carga de trabajo): una tarea con
  tres personas cuenta en la carga de las tres. El panel ya lo calcula así en el
  cliente (`teamWorkload` en `src/utils/analytics.js`).
- **Dashboard** (`tasks_per_user`): ídem.

### Checklist

- [ ] Tabla pivote `task_user` con la copia de `assigned_to`.
- [ ] `POST/PUT .../tasks` aceptan `assignees[]` y hacen `sync` (manteniendo `assigned_to` = primero).
- [ ] `GET` devuelve `assignees` (objetos con `id`, `name`, `avatar`) en listados y detalle.
- [ ] Notificaciones y "mis tareas" consideran a todas las personas asignadas.
- [x] Panel: selector múltiple al crear/editar, pila de avatares en tarjetas y listas,
      filtro por persona que busca en toda la lista, "Mi trabajo" cuenta la tarea si
      estoy entre los asignados, "Programar siguiente" conserva a todas las personas.

---

## 5. Checklist general

**Base de datos**

- [ ] Columnas `task_type` y `recurrence` en `tasks` (con índice por proyecto).
- [ ] `due_date` acepta `null` en las tareas continuas.
- [ ] Datos existentes con `task_type = 'once'`.

**API**

- [ ] `POST /projects/{id}/tasks` y `PUT .../tasks/{id}` aceptan y devuelven
      `task_type` y `recurrence`.
- [ ] Validación: `ongoing` sin `due_date`; `recurrence` dentro del catálogo.
- [ ] `description` y `comment` sanitizados con HTMLPurifier (misma lista blanca).
- [ ] Los avisos push/correo usan texto plano (`strip_tags`).
- [ ] (Opcional) Los listados de vencimientos excluyen las tareas `ongoing`.

**Panel (ya hecho)**

- [x] Selector de tipo (Puntual / Continua) al crear y al editar.
- [x] Cadencia para las tareas continuas y botón “Programar siguiente”.
- [x] Insignia “Continua” en el tablero, la lista, “Mi trabajo” y el calendario.
- [x] Editor con negritas, listas, enlaces… en la descripción y los comentarios.
- [x] Saneado en el cliente y buscadores que ignoran las etiquetas HTML.
