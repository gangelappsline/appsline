# Backend de diagramas (Laravel) — archivos listos para copiar

Implementación de referencia de los endpoints que consume el panel de diagramas
de flujo (`src/services/diagrams.js`). Los archivos siguen las convenciones del
repo de la API (`App\Http\Controllers\API\*` extendiendo `BaseController`,
`sendResponse()`, `*Resource`, `auth:api`, `ProjectTask`): copiar, pegar y
migrar.

El contrato completo —formato de `data`, límites, listados ligeros, adjuntos y
diagnóstico— está en [`../API-DIAGRAMS.md`](../API-DIAGRAMS.md).

## La única regla que no se puede romper

```php
// ✅ Correcto
'data' => ['required', 'array'],          // y guardar con $request->input('data')

// ❌ Rompe el diagrama
'data.nodes.*.data.label' => ['nullable', 'string'],   // + $request->validated()
```

Desde Laravel 9, `Illuminate\Validation\Factory` trae
`$excludeUnvalidatedArrayKeys = true`: `validated()` **excluye los arreglos que
tienen claves hijas validadas** y devuelve solo las claves con regla propia. Con
reglas anidadas sobre `data`, el dibujo llega a la base de datos sin `shape`, sin
`style`, sin `width`/`height`, sin `type` y sin el estilo de las conexiones. El
síntoma en el panel es el que originó este trabajo: **al reabrir el diagrama,
todos los nodos se convierten en nodos de proceso**.

Detalle, ejemplos de entrada/salida y alternativas si se quiere validar el
interior del dibujo: [`../API-DIAGRAMS.md` §4](../API-DIAGRAMS.md#4-validación-y-controlador).

## Archivos

| Archivo de esta carpeta | Destino en la API |
| --- | --- |
| `database/migrations/2026_10_17_000000_create_diagrams_table.php` | `database/migrations/` |
| `app/Models/Diagram.php` | `app/Models/Diagram.php` |
| `app/Http/Resources/DiagramResource.php` | `app/Http/Resources/DiagramResource.php` |
| `app/Http/Controllers/API/DiagramController.php` | `app/Http/Controllers/API/DiagramController.php` |
| `app/Http/Requests/StoreDiagramRequest.php` | *(opcional)* variante FormRequest del controlador |
| `routes/api.diagrams.php` | pegar dentro del grupo `auth:api` de `routes/api.php` |
| `tests/Feature/DiagramContentIntegrityTest.php` | `tests/Feature/` |

## Instalación

1. **Copiar** los archivos de la tabla a su destino.
2. **Relaciones inversas** (opcional, al final de `app/Models/Diagram.php` está
   el fragmento):

   ```php
   // app/Models/Project.php
   public function diagrams(): HasMany { return $this->hasMany(Diagram::class); }

   // app/Models/ProjectTask.php
   public function diagrams(): HasMany { return $this->hasMany(Diagram::class); }
   ```

3. **Rutas**: pegar el contenido de `routes/api.diagrams.php` dentro del grupo
   `Route::middleware('auth:api')` ya existente, junto a
   `/projects/{project_id}/tasks`.
4. **Migrar**:

   ```bash
   php artisan migrate
   ```

   Si la tabla de tareas no se llama `project_tasks`, ajusta el
   `constrained('project_tasks')` de la migración y el
   `Rule::exists('project_tasks', 'id')` del controlador.
5. **Probar**:

   ```bash
   php artisan test --filter=DiagramContentIntegrityTest
   ```

## Tamaño de las peticiones

Los diagramas con imágenes incrustadas (base64/WebP dentro de `data`) pueden
pesar varios MB. Revisar `post_max_size` y `upload_max_filesize` en PHP,
`client_max_body_size` en Nginx y cualquier middleware de tamaño máximo.

## Verificación rápida desde la terminal

```bash
API=https://api.appsline.com.mx/api
TOKEN=...

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
  | jq '.data.nodes[0]'
```

Debe devolver `type`, `width`, `height`, `data.shape` y `data.style.fill`. Si
solo aparecen `id`, `position` y `data.label`, la API está podando el dibujo.

## Formato de las respuestas

`BaseController::sendResponse()` envuelve todo en `{success, data, message}`; el
panel acepta ese envoltorio (y también la respuesta directa). Dos detalles que
sí importan:

- **`POST` debe devolver el registro con su `id` definitivo.** El editor usa una
  única petición en vuelo y, si el POST no trae ID, pide revisar la lista antes
  de repetirlo (riesgo de duplicados).
- **`PUT` puede devolver el registro, solo metadatos o `204`**, pero si devuelve
  el registro, `data` debe venir completo. Si llega recortado, el panel muestra
  un aviso de integridad y completa el dibujo con la última copia guardada en ese
  navegador; en cualquier otro equipo se verá degradado.

## Listado ligero

`index` puede devolver un `data` reducido para acelerar la lista, **siempre** que
incluya `id`, `position`, `width`, `height`, `data.shape` y `data.style.fill` de
cada nodo (es lo que necesita la miniatura) y `source`/`target` de cada conexión.
Con un índice ligero, el panel vuelve a leer el registro individual antes de
renombrar o duplicar desde una tarjeta, para no pisar el dibujo con la versión
reducida: [`../API-DIAGRAMS.md` §5](../API-DIAGRAMS.md#5-listados-ligeros-recomendado).

## Comportamiento del panel mientras la API no esté corregida

El frontend ya no degrada en silencio (ver
[`../API-DIAGRAMS.md` §9](../API-DIAGRAMS.md#9-diagnóstico-todos-los-nodos-vuelven-como-proceso)):

- detecta la respuesta podada al guardar y al abrir, y lo dice con el detalle de
  lo que falta;
- completa el dibujo con la copia del navegador cuando la tiene, y **no inventa
  nada** cuando no;
- no reenvía contenido degradado al renombrar, vincular o duplicar;
- ofrece exportar el JSON de respaldo desde el propio aviso.

Nada de eso sustituye el arreglo de la API: solo evita que el usuario pierda el
dibujo sin enterarse.
