# Tareas continuas, recurrencia y texto enriquecido

Contrato con la API para las dos mejoras del tablero de tareas:

1. **Tareas continuas / recurrentes** (`ongoing`): trabajo que se mantiene abierto
   y **no tiene fecha de entrega** (soporte, mantenimiento, seguimiento de un
   cliente). Opcionalmente llevan una **cadencia** para programar la siguiente
   ronda.
2. **Descripciones y comentarios con formato**: el texto viaja como **HTML
   sencillo** (`<strong>`, `<ul><li>`, `<a>`…), no como texto plano.

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

## 4. Checklist

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
