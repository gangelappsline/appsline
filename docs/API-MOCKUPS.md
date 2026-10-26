# API · Mockups de pantallas (web, iPhone, Android, tablet)

> Esta guía acompaña al **diseño de pantallas dentro de la sección de diagramas**:
> mockups 100 % configurables (imágenes, textos, botones, campos, tarjetas,
> navegación…), conectados con las mismas flechas del diagrama para validar
> flujos, comentarios del equipo y un prototipo navegable.
>
> **Resumen para la API:** no hace falta ninguna tabla nueva. Los mockups viajan
> dentro de `diagrams.data` y se guardan con el mismo endpoint que los diagramas
> de flujo. Lo único que hay que respetar es la regla de oro de
> [`API-DIAGRAMS.md`](./API-DIAGRAMS.md): guardar `data` **completo**, sin
> validarlo campo por campo.
>
> Si quieres comentarios con notificaciones o imágenes en Storage (sin base64),
> al final están las dos extensiones opcionales con su tabla y su controlador.

---

## 1. Qué puedes hacer en el panel

| Función | Dónde |
|---|---|
| Agregar una pantalla | Barra superior → **Pantallas** (o clic derecho en el lienzo → *Insertar pantalla*) |
| 12 marcos | iPhone 15 Pro / 15 / SE, Pixel 8, Galaxy S24, Android compacto, iPad, tablet Android, escritorio 1440, laptop 1280, web móvil 390, tamaño libre |
| 34 elementos | títulos, texto, enlaces, etiquetas, valoraciones, campos, textarea, buscador, selector, casilla, radio, interruptor, deslizador, botones (primario, secundario, icono, flotante), imagen, avatar, icono, video, tarjeta, lista, tabla, gráfica, progreso, mapa, galería, barra superior, barra inferior, divisor, diálogo, teclado y barra de navegador |
| Personalizar todo | posición, tamaño, rotación, relleno, borde, esquinas, opacidad, sombra, tipografía, alineación, icono, imagen propia, valores de gráfica, columnas de galería, estados de campos |
| Conectar el flujo | flechas entre pantallas **o desde un botón/campo concreto** (`sourceHandle: "w:<id>")` |
| Validar en equipo | panel **Comentarios**: hilos por pantalla o por elemento, con estado abierto/resuelto |
| Probar | botón **Probar**: prototipo a tamaño de dispositivo que navega siguiendo las flechas |
| Exportar | PNG / SVG / JSON del diagrama completo (mockups incluidos) y adjunto al proyecto o tarea; la imagen sale sin el chrome del editor (nombre de pantalla, pines de comentarios, guías de área segura y resaltado de selección) |

Los mockups y los diagramas de flujo **conviven en el mismo lienzo**: puedes
tener una fase del proceso con formas y otra con pantallas, y conectar ambas.

---

## 2. Modelo de datos: sigue siendo `diagrams.data`

### 2.1 Sin cambios en la base de datos

| Tabla existente | Campo | Uso con mockups |
|---|---|---|
| `diagrams` | `data` (JSON) | Todo el dibujo: nodos de flujo **y** pantallas con sus elementos, conexiones, ajustes y comentarios |

No hay columnas nuevas, ni tablas intermedias, ni cambios en el resource. El
`version` del documento sigue siendo `1`: los mockups son campos **aditivos**,
así que un diagrama antiguo se abre igual y uno nuevo se ignora sin problema en
un panel viejo (verá las pantallas como nodos sin contenido y solo hay que
actualizar el panel).

### 2.2 Nodo de pantalla

```jsonc
{
  "id": "n_scr_l8x2k1",
  "type": "screen",                 // nuevo tipo de nodo de React Flow
  "position": { "x": 120, "y": 80 },
  "width": 393,                     // tamaño del marco en el lienzo
  "height": 852,
  "data": {
    "shape": "screen",              // forma del catálogo (obligatoria, como en los demás nodos)
    "label": "Inicio de sesión",
    "device": "iphone-15-pro",      // ver tabla de dispositivos
    "background": "linear-gradient(160deg,#0b1220 0%,#1d4ed8 100%)",
    "statusBar": true,
    "start": true,                  // pantalla inicial del prototipo (una sola por diagrama)
    "style": { "fill": "#ffffff", "stroke": "#94a3b8", "textColor": "#0f172a",
               "fontSize": 13, "radius": 0, "strokeWidth": 1, "opacity": 1, "shadow": true },
    "description": "", "link": "", "locked": false,
    "widgets": [ /* ver 2.3 */ ]
  }
}
```

Dispositivos disponibles (`data.device`): `iphone-15-pro`, `iphone-15`,
`iphone-se`, `pixel-8`, `galaxy-s24`, `android-compact`, `ipad`,
`android-tablet`, `desktop`, `laptop`, `web-mobile`, `custom`.
Los tamaños de diseño están en `src/utils/mockups.js` (`DEVICES`).

### 2.3 Elemento de la pantalla (`data.widgets[]`)

```jsonc
{
  "id": "w_l8x2k2",
  "type": "button",                 // clave del catálogo
  "x": 24, "y": 392, "w": 345, "h": 50,   // coordenadas DENTRO del área útil
  "text": "Iniciar sesión",
  "style": {
    "fill": "#0060fc", "textColor": "#ffffff",
    "borderColor": "#0060fc", "borderWidth": 0,
    "radius": 14, "fontSize": 16, "fontWeight": 700, "fontStyle": "normal",
    "align": "center", "valign": "middle", "padding": 10,
    "opacity": 1, "shadow": true, "underline": false,
    "letterSpacing": 0, "lineHeight": 1.35,
    "icon": "plus", "iconSize": 20,
    "imageFit": "cover", "rotate": 0
  },
  "props": {
    "placeholder": "Correo electrónico",   // campos
    "value": "",                          // campo escrito / valor de barra / estrellas
    "checked": true,                      // casilla, radio, interruptor
    "values": [40, 65, 52, 78, 61],       // gráfica de barras
    "columns": 3,                         // galería
    "href": "https://…",                  // enlace
    "image": {                            // imagen embebida (ver 2.5)
      "src": "data:image/webp;base64,…",
      "name": "logo.webp", "alt": "Logo", "fit": "cover",
      "naturalWidth": 640, "naturalHeight": 400
    }
  },
  "locked": false
}
```

Tipos (`type`): `heading`, `text`, `link`, `badge`, `rating`, `input`,
`textarea`, `search`, `select`, `checkbox`, `radio`, `toggle`, `slider`,
`button`, `button-secondary`, `icon-button`, `fab`, `image`, `avatar`, `icon`,
`video`, `card`, `list`, `table`, `chart`, `progress`, `map`, `gallery`,
`appbar`, `tabbar`, `divider`, `modal`, `keyboard`, `browser-bar`.

> Las coordenadas `x`/`y` son relativas al **área útil** de la pantalla (dentro
> del marco del dispositivo y, en web, debajo de la barra del navegador). El
> panel descarta valores absurdos y limita tamaños al normalizar, así que un
> cambio manual en la base de datos nunca rompe el lienzo.

### 2.4 Conexiones

Las flechas usan el formato existente. La única novedad es que el origen puede
ser un elemento concreto de la pantalla:

```jsonc
{
  "id": "e_1", "type": "flow",
  "source": "n_scr_l8x2k1", "target": "n_scr_l8x2k9",
  "sourceHandle": "w:w_l8x2k2",     // ← botón "Iniciar sesión"
  "targetHandle": "left",
  "data": { "kind": "smoothstep", "label": "Iniciar sesión", "color": "#64748b",
            "width": 2, "dash": "solid", "animated": false,
            "markerStart": "none", "markerEnd": "arrowclosed",
            "fontSize": 12, "labelBg": "#ffffff", "labelColor": "#334155" }
}
```

- Handles de pantalla: `top`, `right`, `bottom`, `left`.
- Handles de elemento: `w:<id del elemento>`.
- **Importante:** la API no debe interpretar ni reescribir `sourceHandle` /
  `targetHandle`. Si se normalizan a `top`/`left`, las flechas de los botones se
  mueven al borde de la pantalla.

### 2.5 Imágenes

Igual que en los diagramas: la imagen viaja embebida en el JSON (PNG/JPG/WebP,
máximo 5 MB por archivo original, reducida a 1600 px y convertida a WebP por el
panel). No requiere endpoint de carga. Si tu `post_max_size` se queda corto, usa
la extensión de la §5.2.

### 2.6 Comentarios del equipo

Se guardan en el mismo `data.comments` (sin tabla nueva, §5.1 para la versión
con tabla propia):

```jsonc
"comments": [
  {
    "id": "c_l8x2k3",
    "text": "Falta el estado vacío de esta lista.",
    "author": { "id": 7, "name": "Ana Pérez" },
    "node_id": "n_scr_l8x2k1",     // pantalla; null = comentario del diagrama
    "widget_id": "w_l8x2k2",       // opcional: elemento concreto
    "parent_id": null,             // reservado para respuestas
    "resolved": false,
    "created_at": "2026-10-26T12:00:00.000Z"
  }
]
```

El panel acepta comentarios antiguos con `body`/`author_name`/`nodeId` y con
`status: "resolved"`, y los normaliza al abrirlos.

### 2.7 Documento completo

```jsonc
{
  "version": 1,
  "nodes": [ /* nodos de flujo y de pantalla, mezclados */ ],
  "edges": [ /* flechas, incluidas las de elementos */ ],
  "viewport": { "x": 40, "y": 40, "zoom": 0.5 },
  "settings": { "background": "dots", "gridSize": 20, "snap": true,
                "canvasColor": "#f8fafc", "minimap": true, "controls": true,
                "edgeKind": "smoothstep", "direction": "TB", "theme": "appsline" },
  "comments": [ /* comentarios de revisión */ ]
}
```

---

## 3. Cómo guardarlo desde tu API de Laravel

### 3.1 Lo único que hay que hacer bien

```php
// app/Http/Requests/StoreDiagramRequest.php  (o reglas en el controlador)
public function rules(): array
{
    return [
        'name'        => ['required', 'string', 'max:160'],
        'description' => ['nullable', 'string', 'max:5000'],
        'task_id'     => ['nullable', 'integer', Rule::exists('project_tasks', 'id')],

        // Una sola regla: SIN reglas data.nodes.* ni data.comments.*
        'data'        => ['required', 'array'],
    ];
}
```

```php
// app/Http/Controllers/API/DiagramController.php
public function store(Request $request, $project_id)
{
    $validated = $request->validate([
        'name'        => 'required|string|max:160',
        'description' => 'nullable|string|max:5000',
        'task_id'     => 'nullable|integer',
        'data'        => 'required|array',   // ← sin reglas anidadas
    ]);

    $diagram = new Diagram();
    $diagram->project_id = $project_id;
    $diagram->task_id    = $validated['task_id'] ?? null;
    $diagram->name       = $validated['name'];
    $diagram->description = $validated['description'] ?? null;
    $diagram->data       = $request->input('data');   // ← el bloque COMPLETO
    $diagram->created_by = auth()->id();
    $diagram->save();

    return $this->sendResponse(new DiagramResource($diagram), 'Diagram created successfully.');
}
```

> ⚠️ **Nunca** uses `$request->validated()['data']` ni escribas reglas como
> `data.nodes.*.data.widgets.*.type`: desde Laravel 9 el validador elimina del
> arreglo toda clave sin regla propia, y te quedarías sin `widgets`, sin
> `style`, sin `data.device` y sin `comments`. El diagrama se guarda con 200 y,
> al reabrirlo, todas las pantallas aparecen vacías. El panel detecta ese
> recorte y avisa (ver `API-DIAGRAMS.md` §9), pero el arreglo es este.

### 3.2 Verificación en 30 segundos

```bash
API=https://api.appsline.com.mx/api
TOKEN=...   # token de la sesión del panel

curl -sS -X PUT "$API/projects/1/diagrams/1" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  --data-urlencode "name=Mockup de prueba" \
  --data-urlencode "data[version]=1" \
  --data-urlencode "data[nodes][0][id]=scr1" \
  --data-urlencode "data[nodes][0][type]=screen" \
  --data-urlencode "data[nodes][0][width]=393" \
  --data-urlencode "data[nodes][0][height]=852" \
  --data-urlencode "data[nodes][0][position][x]=100" \
  --data-urlencode "data[nodes][0][position][y]=60" \
  --data-urlencode "data[nodes][0][data][shape]=screen" \
  --data-urlencode "data[nodes][0][data][device]=iphone-15-pro" \
  --data-urlencode "data[nodes][0][data][widgets][0][id]=w1" \
  --data-urlencode "data[nodes][0][data][widgets][0][type]=button" \
  --data-urlencode "data[nodes][0][data][widgets][0][x]=24" \
  --data-urlencode "data[nodes][0][data][widgets][0][y]=392" \
  --data-urlencode "data[nodes][0][data][widgets][0][w]=345" \
  --data-urlencode "data[nodes][0][data][widgets][0][h]=50" \
  --data-urlencode "data[nodes][0][data][widgets][0][text]=Continuar" \
  --data-urlencode "data[nodes][0][data][widgets][0][style][fill]=#0060fc" \
  --data-urlencode "data[edges][0][id]=e1" \
  --data-urlencode "data[edges][0][source]=scr1" \
  --data-urlencode "data[edges][0][target]=scr2" \
  --data-urlencode "data[edges][0][sourceHandle]=w:w1" \
  --data-urlencode "data[comments][0][id]=c1" \
  --data-urlencode "data[comments][0][text]=Revisar contraste" \
  --data-urlencode "data[comments][0][node_id]=scr1" \
  | jq '{type: .data.nodes[0].type, device: .data.nodes[0].data.device,
         widgets: (.data.nodes[0].data.widgets | length),
         handle: .data.edges[0].sourceHandle,
         comments: (.data.comments | length)}'
```

Debe responder `type: "screen"`, `device: "iphone-15-pro"`, `widgets: 1`,
`handle: "w:w1"` y `comments: 1`. Si aparece `null` en `device`, la API está
podando el dibujo.

### 3.3 Consultas útiles (opcionales)

```php
// ¿Cuántas pantallas tiene un diagrama? (MySQL 8 / MariaDB 10.5+)
Diagram::selectRaw("JSON_LENGTH(JSON_EXTRACT(data, '$.nodes')) as nodes")->get();

// Pantallas de un diagrama en PHP
$screens = collect($diagram->data['nodes'] ?? [])
    ->where('type', 'screen')
    ->values();

// Nombres de las pantallas (para mostrar en listados sin cargar todo)
$screenNames = collect($diagram->data['nodes'] ?? [])
    ->where('type', 'screen')
    ->pluck('data.label', 'id');
```

Si `diagrams.data` es `longText` (MariaDB antigua sin JSON), funciona igual: es
un bloque opaco que el modelo castea con `'data' => 'array'`.

### 3.4 Respuestas y autoguardado

- `POST` debe devolver el **ID definitivo** del diagrama (el editor cambia a
  `PUT` con ese ID sin recargar el lienzo).
- `PUT` puede devolver el registro completo, solo metadatos o `204`. Si devuelve
  el registro, `data` debe venir completo (todos los `widgets` y `comments`).
- Un `PUT` fallido no debe crear un segundo registro.

---

## 4. ¿Necesito tablas nuevas?

Para **diseñar pantallas, conectarlas y comentar**: **no**. Todo vive en
`diagrams.data`.

Sí conviene una tabla propia en estos casos:

| Necesidad | Solución |
|---|---|
| Comentarios con autor, notificaciones, edición por usuario, historial o filtros en SQL | Tabla `diagram_comments` (§5.1) |
| Imágenes grandes o muchas por diagrama (JSON de varios MB) | Subida a Storage y guardar solo URL (§5.2) |
| Versionado/aprobaciones formales del mockup | Tabla `diagram_revisions` (opcional, §5.3) |
| Permisos por pantalla | Tabla de permisos propia (§5.4) |

---

## 5. Extensiones opcionales

### 5.1 Tabla `diagram_comments`

Ventajas frente a `data.comments`: autor indexado, `resolved_by`, notificaciones,
historial y actualizaciones concurrentes. **El panel de hoy guarda los
comentarios en `data.comments`**; cuando la API exponga estos endpoints se puede
migrar sin tocar el diseño de los mockups.

```php
// database/migrations/2026_10_19_000000_create_diagram_comments_table.php
Schema::create('diagram_comments', function (Blueprint $table) {
    $table->id();
    $table->foreignId('diagram_id')->constrained()->cascadeOnDelete();
    $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->string('node_id', 64)->nullable();       // pantalla
    $table->string('widget_id', 64)->nullable();     // elemento de la pantalla
    $table->foreignId('parent_id')->nullable()->constrained('diagram_comments')->cascadeOnDelete();
    $table->text('body');
    $table->boolean('resolved')->default(false);
    $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamp('resolved_at')->nullable();
    $table->timestamps();

    $table->index(['diagram_id', 'node_id']);
    $table->index(['diagram_id', 'resolved']);
});
```

Modelo, controlador, resource, rutas y test están listos para copiar en
[`docs/backend-diagrams/`](./backend-diagrams/) (`DiagramComment.php`,
`DiagramCommentController.php`, `DiagramCommentResource.php`,
`api.diagram-comments.php`, `DiagramCommentTest.php`).

Contrato que consumirá el panel cuando se active:

| Método | Ruta | Cuerpo |
|---|---|---|
| `GET` | `/api/projects/{project}/diagrams/{diagram}/comments` | — |
| `POST` | `/api/projects/{project}/diagrams/{diagram}/comments` | `{ body, node_id?, widget_id?, parent_id? }` |
| `PUT` | `/api/projects/{project}/diagrams/{diagram}/comments/{comment}` | `{ body?, resolved?, node_id?, widget_id? }` |
| `DELETE` | `/api/projects/{project}/diagrams/{diagram}/comments/{comment}` | — |

Respuesta por comentario:

```json
{
  "id": 12,
  "diagram_id": 4,
  "body": "Falta el estado vacío",
  "node_id": "n_scr_l8x2k1",
  "widget_id": "w_l8x2k2",
  "parent_id": null,
  "resolved": false,
  "resolved_at": null,
  "author": { "id": 7, "name": "Ana Pérez" },
  "created_at": "2026-10-26T12:00:00Z",
  "updated_at": "2026-10-26T12:00:00Z"
}
```

Mientras tanto, el panel acepta `data.comments` y no pierde nada al guardar; si
más adelante se activa la tabla, basta con leer los comentarios del endpoint y
escribir los nuevos ahí (el formato es el mismo: `body` ⇄ `text`).

### 5.2 Imágenes en Storage (en lugar de base64)

El panel ya admite las dos cosas: si un elemento `image`/`avatar` tiene
`props.image.src` con `data:` lo dibuja embebido. Para usar URLs:

1. `POST /api/projects/{project}/files` (endpoint existente) con el archivo.
2. Guardar en el widget solo la URL pública y una marca:

```json
"props": {
  "image": { "src": "https://cdn.appsline.com.mx/mockups/login.png",
             "name": "login.png", "alt": "Fondo", "fit": "cover",
             "naturalWidth": 640, "naturalHeight": 400 }
}
```

> El panel **rechaza** por seguridad `javascript:`, `blob:`, SVG y URLs externas
> al importar un JSON. Para aceptar URLs propias hay que permitir el dominio en
> `src/utils/diagramMedia.js` (`normalizeDiagramImage`). Si no quieres tocar el
> cliente, deja las imágenes embebidas: ya funcionan.

### 5.3 Revisiones / aprobaciones (opcional)

```php
Schema::create('diagram_revisions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('diagram_id')->constrained()->cascadeOnDelete();
    $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->json('data');                 // copia del mockup aprobado
    $table->string('status', 24)->default('draft'); // draft | in_review | approved | rejected
    $table->text('notes')->nullable();
    $table->timestamps();
});
```

Útil si el flujo del equipo exige “aprobado por el cliente” antes de programar.
El panel no lo usa todavía; los mockups se comparten con el diagrama.

### 5.4 Permisos

Los mockups no necesitan permisos distintos de los del proyecto: usa las mismas
políticas que ya aplicas a `diagrams` (`view`, `update` del proyecto). Los
comentarios, si usas tabla, deben validar que el `diagram_id` pertenece al
proyecto de la URL y aplicar la misma política.

---

## 6. Límites y rendimiento

| Límite | Valor | Dónde |
|---|---|---|
| Nodos por diagrama | 2 000 | `Diagram::MAX_NODES` |
| Conexiones | 4 000 | `Diagram::MAX_EDGES` |
| Elementos por pantalla | 400 | `normalizeWidgets` del panel |
| Imagen original | 5 MB, PNG/JPG/WebP | panel (se reduce a 1600 px) |
| Imagen embebida | 2 MiB de texto cada una | `normalizeDiagramImage` |

Revisa también:

- `post_max_size` y `upload_max_filesize` en PHP (recomendado ≥ 32 MB si hay
  varias imágenes).
- `client_max_body_size` en Nginx.
- Middleware de tamaño máximo o límites del WAF.
- Compresión: `data` es JSON con base64; si guardas en MySQL, `json`/`longText`
  con `ROW_FORMAT=DYNAMIC` evita problemas de fila.

**Rendimiento del listado:** para miniaturas basta con enviar
`data.nodes[].data.device`, `width`, `height` y `data.widgets[].{x,y,w,h,type}`.
El panel tolera un `data` reducido en `index` y vuelve a leer el registro antes
de guardar desde una tarjeta.

---

## 7. Checklist

**Base de datos**

- [ ] Nada nuevo para mockups: `diagrams.data` (JSON) ya guarda pantallas, elementos, conexiones y comentarios.
- [ ] *(Opcional)* `diagram_comments` si quieres comentarios indexados y notificaciones.
- [ ] *(Opcional)* `diagram_revisions` si necesitas aprobaciones formales.

**API**

- [ ] `'data' => ['required','array']` **sin reglas anidadas** y guardado con
      `$request->input('data')` (igual que en `API-DIAGRAMS.md` §4).
- [ ] `data` casteado como `array` en el modelo (`'data' => 'array'`).
- [ ] El resource devuelve `data` completo, sin `only()` ni `map()`.
- [ ] No se reescriben `sourceHandle`/`targetHandle` (`w:<id>` debe sobrevivir).
- [ ] `POST` devuelve el ID definitivo; `PUT` puede ser `204`.
- [ ] Si usas tabla de comentarios: rutas y validación de pertenencia al proyecto.
- [ ] `post_max_size`/Nginx suficientes para diagramas con imágenes.

**Panel (ya hecho)**

- [x] 12 dispositivos y 34 elementos configurables; arrastrar o clic.
- [x] Mover/redimensionar/duplicar/ordenar elementos, edición de texto en el lienzo.
- [x] Flechas entre pantallas y desde un botón o campo concreto.
- [x] Panel de propiedades (pantalla y elemento) y guías de área segura.
- [x] Comentarios por pantalla/elemento con estado resuelto y salto al lienzo.
- [x] Prototipo navegable siguiendo las conexiones.
- [x] Exportar PNG/SVG/JSON, importar JSON y adjuntar al proyecto/tarea (la imagen excluye el chrome del editor: cualquier elemento nuevo con `data-export="hide"` queda fuera y con `data-export-clean` se le anula el `box-shadow`/`outline` mientras se captura).
- [x] Miniaturas de las pantallas en los listados y en el selector de plantillas.
- [x] Plantillas “App móvil · 3 pantallas” y “Web · landing y panel”.

---

## 8. Diagnóstico rápido

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| Las pantallas se abren vacías | `validated()` podó `data` | §3.1: `'data' => 'required','array'` + `$request->input('data')` |
| Se pierde `data.device` o `data.background` | El resource o un `map()` reconstruye `data` | Devolver `data` completo |
| Las flechas de los botones salen del borde de la pantalla | Se normalizaron los handles | Conservar `sourceHandle`/`targetHandle` tal cual |
| Los comentarios desaparecen al recargar | Se guardó solo `nodes`/`edges` | Guardar `data.comments` (o usar `diagram_comments`) |
| `413 Payload Too Large` al guardar | Imágenes embebidas | Subir `post_max_size`/Nginx o usar Storage (§5.2) |
| Todo el diagrama se ve como rectángulos | Faltan `data.nodes[].data.shape/style` | Ver `API-DIAGRAMS.md` §4 y §9 |

---

## 9. Archivos del panel relacionados

| Archivo | Responsabilidad |
|---|---|
| `src/utils/mockups.js` | Catálogo de dispositivos y elementos, normalización, comentarios, prototipo |
| `src/components/admin/flowchart/MockupNode.jsx` | Pantalla en el lienzo (marco, elementos, arrastre, conectores) |
| `src/components/admin/flowchart/MockupWidget.jsx` | Dibujo de cada elemento y cromo del dispositivo |
| `src/components/admin/flowchart/MockupPalette.jsx` | Biblioteca de pantallas y elementos |
| `src/components/admin/flowchart/MockupProperties.jsx` | Propiedades de pantalla y de elemento |
| `src/components/admin/flowchart/ReviewPanel.jsx` | Comentarios del equipo |
| `src/components/admin/flowchart/PrototypePlayer.jsx` | Prototipo navegable |
| `src/components/admin/flowchart/MockupPreview.jsx` | Pantalla a escala (prototipo y vistas previas) |
| `src/utils/diagrams.js` | Tipo de nodo `screen`, serialización y plantillas |
| `tests/unit/mockups.test.mjs` | Contrato de datos, conectores y plantillas |
