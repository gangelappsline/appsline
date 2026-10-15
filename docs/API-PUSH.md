# Notificaciones push web (Firebase Cloud Messaging)

Guía de configuración para que los **usuarios con sesión iniciada** en el panel
reciban notificaciones push en el navegador con **Firebase Cloud Messaging (FCM)**.

> El frontend ya está implementado en este repositorio. Lo único que falta es
> **tu configuración de Firebase** (variables de entorno) y **cuatro endpoints en
> la API**. Este documento contiene ambas cosas, paso a paso.

---

## 0. Cómo funciona

```
   Usuario logueado                     API (Laravel)                Firebase (Google)
┌──────────────────────┐          ┌───────────────────────┐      ┌──────────────────────┐
│ 1. Clic en la        │          │                       │      │                      │
│    campana 🔔 o en   │          │                       │      │                      │
│    Configuración     │          │                       │      │                      │
│ 2. Permiso del       │          │                       │      │                      │
│    navegador         │          │                       │      │                      │
│ 3. Token FCM  ───────┼─────────►│ 4. POST /push/devices │      │                      │
│    (firebase/messaging)         │    guarda el token    │      │                      │
└──────────────────────┘          │    del usuario        │      │                      │
                                  │                       │      │                      │
       servicio de push del navegador                          │                      │
                    ▲             │ 5. Al pasar algo     ─┼─────►│ 6. messages:send     │
                    │             │    (tarea asignada,   │      │    (HTTP v1 + cuenta │
                    │             │    comentario, ...)   │      │     de servicio)     │
                    │             │    envía la notificación      │                      │
                    └─────────────┴───────────────────────┴──────┴──────────────────────┘
   7. El service worker (/firebase-messaging-sw.js) muestra la notificación
      · pestaña cerrada → notificación del sistema (clic = abre ese proyecto)
      · pestaña abierta → notificación + toast dentro del panel
```

Piezas implicadas:

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| `public/firebase-messaging-sw.js` | sitio (raíz `/`) | Recibe los push, muestra la notificación, abre la ruta al hacer clic y atiende el push **simulado** del diagnóstico (`postMessage` → `simulate-push`) |
| `src/firebase/config.js` | bundle | Lee las variables `VITE_FIREBASE_*` |
| `src/firebase/messaging.js` | bundle (import dinámico del SDK) | Permiso, service worker, token FCM, revocación y puente de mensajes |
| `src/services/push.js` | bundle | Llama a `POST/DELETE/GET /push/devices` y `/push/devices/test` |
| `src/routes/PushContext.jsx` | bundle | Estado global (activar/desactivar/probar/sincronizar) |
| `src/components/admin/PushBell.jsx` | bundle | Campana del encabezado del panel |
| `src/components/admin/PushSettings.jsx` | bundle | Tarjeta en Configuración → Preferencias |
| `src/components/admin/PushDiagnostics.jsx` | bundle | Diagnóstico paso a paso + prueba de un token de `push_devices` |

---

## 1. Configuración en Firebase Console (10 minutos)

1. Entra en <https://console.firebase.google.com> y **crea un proyecto** (o usa
   el que ya tengas para Appsline). No hace falta Google Analytics.
2. Dentro del proyecto: ⚙️ **Configuración del proyecto** → pestaña **General** →
   sección **Tus apps** → botón **Web** (`</>`) → apodo `Appsline Panel` →
   *Registrar app*. **No** marques Firebase Hosting.
3. Firebase te muestra un bloque `firebaseConfig = { ... }`. Copia esos valores a
   las variables `VITE_FIREBASE_*` (ver sección 2). Correspondencia:

   | Valor de `firebaseConfig` | Variable de entorno |
   |---|---|
   | `apiKey` | `VITE_FIREBASE_API_KEY` |
   | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId` | `VITE_FIREBASE_PROJECT_ID` |
   | `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
   | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId` | `VITE_FIREBASE_APP_ID` |

4. Ve a **Cloud Messaging** → pestaña **Certificados push web** (*Web Push
   certificates*) → **Generar par de claves**. Copia la **clave pública**
   (empieza con `B…`) en:

   ```
   VITE_FIREBASE_VAPID_KEY=B...
   ```

   Sin esta clave el registro del navegador falla (`messaging/token-subscribe-failed`).
   Si algún día la regeneras, **todos los dispositivos** tendrán que activar las
   notificaciones otra vez.

5. En **Cloud Messaging** verifica que la API **Firebase Cloud Messaging API (V1)**
   esté habilitada (Firebase la habilita sola al crear el proyecto; si no, se
   activa desde Google Cloud Console → *APIs y servicios* → *Biblioteca*). La API
   “Legacy” ya está en desuso: el envío se hace por HTTP v1.
6. ⚙️ **Configuración del proyecto** → **Cuentas de servicio** →
   **Generar nueva clave privada** → se descarga un archivo `.json`.
   **Ese archivo va al backend, nunca al frontend y nunca a Git.**

   ```
   appsline-firebase-adminsdk-xxxxx.json
   ```

   La cuenta de servicio necesita el rol **Firebase Admin SDK Administrator
   Service Agent** (o *Firebase Cloud Messaging API Admin*) en IAM.

---

## 2. Lo que debes agregar al frontend (este repositorio)

### 2.1 Variables de entorno

Crea/edita `.env` (desarrollo) con estas 7 variables — en el repo ya están
comentadas como plantilla y `.env.example` las documenta:

```dotenv
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=appsline-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=appsline-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=appsline-xxxxx.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
VITE_FIREBASE_VAPID_KEY=BEl...tu-clave-publica-vapid...
```

Notas importantes:

- **Son públicas por diseño** (viajan en el bundle del navegador). No pasa nada
  por compartirlas; lo que jamás debe estar aquí es el JSON de la cuenta de
  servicio (ese es el que puede *enviar* notificaciones).
- Vite las “hornea” en el build: **si cambias un valor hay que reiniciar
  `npm run dev` o volver a construir** (`npm run build`).
- En producción agrégalas en el **entorno de build** de tu hosting/CI
  (Docker build args, variables de Vercel/Netlify, `.env.production`, etc.)
  **antes** de `npm run build`. No son variables de “runtime”: el sitio es
  estático.
- `storageBucket` puede venir como `xxx.appspot.com` o `xxx.firebasestorage.app`;
  cualquiera de los dos sirve (no usamos Storage).

### 2.2 Requisitos del despliegue

- **HTTPS obligatorio** (en `localhost` funciona sin HTTPS, para desarrollo).
- El archivo `firebase-messaging-sw.js` debe quedar accesible en
  `https://tu-dominio/firebase-messaging-sw.js`. `npm run build` lo copia solo
  (está en `public/`).
- **No** reescribas esa ruta con el fallback de la SPA; debe devolverse el
  archivo real (`text/javascript`).
- Se recomienda que el service worker no quede cacheado (el navegador ya busca
  actualizaciones, pero conviene evitar caches de CDN):

  ```nginx
  location = /firebase-messaging-sw.js {
      add_header Cache-Control "no-cache, max-age=0";
      try_files $uri =404;
  }
  ```

- Si más adelante agregas una **PWA con su propio service worker en la raíz**,
  ten en cuenta que **solo puede existir un service worker por scope**. Elige
  una de estas dos opciones: mover el otro SW a un scope distinto o integrar el
  manejo de `push` / `notificationclick` dentro de ese SW. El código ya detecta
  el conflicto y, en ese caso, registra el nuestro en
  `/firebase-cloud-messaging-push-scope` (el scope que usa Firebase por defecto).

### 2.3 Reinicia y listo

```bash
npm run dev      # o: npm run build && npm run preview
```

En el panel, cada usuario verá la **campana** en el encabezado y la tarjeta
**Configuración → Preferencias → Notificaciones push**. Al pulsar “Activar
notificaciones” el navegador pide el permiso, se registra el dispositivo y la
app envía `POST /api/push/devices`.

Sin los endpoints de la API el push **igual funciona en el navegador**, pero la
notificación no llegará desde el servidor; la tarjeta avisa de esa situación.

---

## 3. Lo que debe agregar la API (Laravel)

### 3.1 Tabla `push_devices`

```bash
php artisan make:migration create_push_devices_table
```

```php
<?php
// database/migrations/xxxx_xx_xx_xxxxxx_create_push_devices_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // El token de FCM mide ~160-200 caracteres.
            // Con MySQL antiguo (índices de 767 bytes) usa string('token', 191).
            $table->string('token', 255)->unique();
            $table->string('platform', 20)->default('web');
            $table->string('device_id', 100)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->string('locale', 20)->nullable();
            $table->string('timezone', 64)->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'platform']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_devices');
    }
};
```

```php
<?php
// app/Models/PushDevice.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PushDevice extends Model
{
    protected $fillable = [
        'user_id', 'token', 'platform', 'device_id',
        'user_agent', 'locale', 'timezone', 'last_seen_at',
    ];

    protected $casts = ['last_seen_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

Y en `App\Models\User`:

```php
public function pushDevices(): HasMany
{
    return $this->hasMany(PushDevice::class);
}
```

### 3.2 Endpoints que espera el frontend

Todos requieren `Authorization: Bearer {token}` (Passport) y respuesta envuelta
en `data`, como el resto de la API.

| Método | Ruta | Cuerpo | Respuesta esperada |
|---|---|---|---|
| `POST` | `/api/push/devices` | `{ token, platform, device_id, user_agent, locale, timezone }` | `201 { "data": { "id": 1, "token": "...", ... } }` |
| `DELETE` | `/api/push/devices` | `{ token }` | `204` sin cuerpo |
| `GET` | `/api/push/devices` | — | `200 { "data": [ { "id", "platform", "device_id", "last_seen_at" } ] }` |
| `POST` | `/api/push/devices/test` | `{ token? }` (opcional) | `200 { "data": { "sent": 1 } }` |

Comportamiento esperado:

- **`POST /push/devices`**: *upsert* por `token`. Si el token ya existía
  asignado a otro usuario (equipo compartido, mismo navegador con otra cuenta),
  **se reasigna** al usuario autenticado. Actualiza `last_seen_at`.
- **`DELETE /push/devices`**: borra la fila del token **solo si pertenece** al
  usuario autenticado (el frontend lo llama al cerrar sesión).
- **`GET /push/devices`**: lista los dispositivos del usuario; el frontend solo
  usa la cantidad (`length`). Es opcional: si no existe, la tarjeta simplemente
  no muestra el conteo.
- **`POST /push/devices/test`**: envía la notificación de prueba al dispositivo
  indicado (o a todos los del usuario). Es opcional: si no existe, el botón
  “Enviar prueba” del panel muestra una notificación **local** en su lugar.
  - Con `{ token }` el panel puede probar **cualquier token de `push_devices`**
    (así se comprueba si ese dispositivo sigue vivo desde Configuración →
    Preferencias → Diagnóstico). Devuélvelo solo si el token pertenece al usuario
    autenticado (`403`/`404` en caso contrario).
  - En caso de fallo, responde con el **error real** de FCM (mensaje + código) y
    un `4xx`/`5xx`: el panel lo enseña tal cual en el historial del diagnóstico.
- Si un endpoint no existe, la API debe responder `404`/`405`: el panel lo
  detecta, no se rompe y deja de insistir.

> **`DELETE` con cuerpo**: axios envía `{ token }` en el body del `DELETE`. Si tu
> proxy/balanceador elimina el cuerpo de los `DELETE` (pasa con algunos API
> Gateway), cambia una sola línea en `src/services/push.js`
> (`PUSH_DEVICES_PATH`: usa `DELETE /push/devices/{token}`) y ajusta la ruta.

### 3.3 Controlador y rutas

```php
<?php
// app/Http/Controllers/Api/PushDeviceController.php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushDevice;
use App\Services\FcmService;
use Illuminate\Http\Request;

class PushDeviceController extends Controller
{
    /** GET /api/push/devices */
    public function index(Request $request)
    {
        $devices = $request->user()->pushDevices()
            ->latest('last_seen_at')
            ->get(['id', 'platform', 'device_id', 'last_seen_at']);

        return response()->json(['data' => $devices]);
    }

    /** POST /api/push/devices */
    public function store(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'platform' => ['nullable', 'string', 'in:web,android,ios'],
            'device_id' => ['nullable', 'string', 'max:100'],
            'user_agent' => ['nullable', 'string', 'max:255'],
            'locale' => ['nullable', 'string', 'max:20'],
            'timezone' => ['nullable', 'string', 'max:64'],
        ]);

        $device = PushDevice::updateOrCreate(
            ['token' => $data['token']],
            [
                'user_id' => $request->user()->id, // reasigna si el token era de otro usuario
                'platform' => $data['platform'] ?? 'web',
                'device_id' => $data['device_id'] ?? null,
                'user_agent' => $data['user_agent'] ?? null,
                'locale' => $data['locale'] ?? null,
                'timezone' => $data['timezone'] ?? null,
                'last_seen_at' => now(),
            ]
        );

        return response()->json(['data' => $device], 201);
    }

    /** DELETE /api/push/devices */
    public function destroy(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255'],
        ]);

        $request->user()->pushDevices()->where('token', $data['token'])->delete();

        return response()->noContent();
    }

    /** POST /api/push/devices/test */
    public function test(Request $request, FcmService $fcm)
    {
        $data = $request->validate([
            'token' => ['nullable', 'string', 'max:255'],
        ]);

        $devices = $request->user()->pushDevices()
            ->when($data['token'] ?? null, fn ($query, $token) => $query->where('token', $token))
            ->get();

        if ($devices->isEmpty()) {
            return response()->json(
                ['message' => 'No hay dispositivos con notificaciones activas.'],
                404
            );
        }

        $fcm->sendToDevices(
            $devices,
            'Prueba de notificación',
            'Si ves este mensaje, las notificaciones push de Appsline funcionan.',
            ['url' => '/admin/settings', 'tag' => 'appsline-test']
        );

        return response()->json(['data' => ['sent' => $devices->count()]]);
    }
}
```

```php
<?php
// routes/api.php

use App\Http\Controllers\Api\PushDeviceController;

Route::middleware('auth:api')->group(function () {
    Route::get('/push/devices', [PushDeviceController::class, 'index']);
    Route::post('/push/devices', [PushDeviceController::class, 'store']);
    Route::delete('/push/devices', [PushDeviceController::class, 'destroy']);
    Route::post('/push/devices/test', [PushDeviceController::class, 'test']);
});
```

### 3.4 Enviar la notificación: servicio con FCM HTTP v1

La API HTTP v1 exige un **token OAuth2 de la cuenta de servicio**; ya no sirve
la “server key” antigua.

```bash
composer require google/auth
```

```php
<?php
// app/Services/FcmService.php

namespace App\Services;

use App\Models\PushDevice;
use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmService
{
    /** Envía la misma notificación a todos los dispositivos indicados. */
    public function sendToDevices(Collection $devices, string $title, string $body, array $data = []): int
    {
        $sent = 0;

        foreach ($devices as $device) {
            if ($this->send($device, $title, $body, $data)) {
                $sent++;
            }
        }

        return $sent;
    }

    /** Envía a un dispositivo. Devuelve `false` si el token ya no es válido. */
    public function send(PushDevice $device, string $title, string $body, array $data = []): bool
    {
        $response = Http::withToken($this->accessToken())
            ->acceptJson()
            ->post($this->endpoint(), [
                'message' => $this->buildMessage($device->token, $title, $body, $data),
            ]);

        if ($response->successful()) {
            $device->forceFill(['last_seen_at' => now()])->save();

            return true;
        }

        // UNREGISTERED / NOT_FOUND / INVALID_ARGUMENT => el usuario revocó el
        // permiso, el token caducó o el panel se desinstaló: se elimina.
        $errorCode = $response->json('error.details.0.errorCode') ?? $response->json('error.status');

        if (in_array($errorCode, ['UNREGISTERED', 'NOT_FOUND', 'INVALID_ARGUMENT'], true)) {
            $device->delete();

            return false;
        }

        Log::warning('FCM: no se pudo enviar la notificación', [
            'device_id' => $device->id,
            'status' => $response->status(),
            'error' => $response->json('error.message'),
        ]);

        return false;
    }

    /** Mensaje tal como lo espera la API HTTP v1 (Web Push). */
    protected function buildMessage(string $token, string $title, string $body, array $data): array
    {
        // FCM exige que `data` sea un mapa de strings.
        $payload = collect($data)
            ->map(fn ($value) => is_scalar($value) ? (string) $value : json_encode($value))
            ->all();

        $message = [
            'token' => $token,
            'notification' => [
                'title' => $title,
                'body' => $body,
            ],
            'data' => $payload,
            'webpush' => [
                'notification' => [
                    'icon' => config('services.fcm.icon'),
                    'badge' => config('services.fcm.badge'),
                ],
            ],
        ];

        // `fcm_options.link` debe ser una URL ABSOLUTA https. Es el respaldo por
        // si Chrome muestra la notificación sin pasar por nuestro service worker;
        // el destino real lo decide `data.url` (puede ser relativo).
        if (! empty($data['url'])) {
            $url = (string) $data['url'];
            $message['webpush']['fcm_options'] = [
                'link' => str_starts_with($url, 'http')
                    ? $url
                    : rtrim(config('app.url'), '/') . '/' . ltrim($url, '/'),
            ];
        }

        return $message;
    }

    protected function endpoint(): string
    {
        return 'https://fcm.googleapis.com/v1/projects/'
            . config('services.fcm.project_id')
            . '/messages:send';
    }

    /** Token OAuth2 de la cuenta de servicio (se cachea ~1 hora). */
    protected function accessToken(): string
    {
        return Cache::remember('fcm.access_token', now()->addMinutes(50), function () {
            $credentials = new ServiceAccountCredentials(
                'https://www.googleapis.com/auth/firebase.messaging',
                config('services.fcm.credentials')
            );

            return $credentials->fetchAuthToken()['access_token'];
        });
    }
}
```

```php
<?php
// config/services.php  (agrega este bloque)

'fcm' => [
    // ID del proyecto de Firebase. Debe ser EXACTAMENTE el `project_id` del JSON
    // de la cuenta de servicio: si difiere, FCM responde RESOURCE_PROJECT_INVALID.
    // Para evitar desincronizaciones, derívalo del propio JSON en lugar de
    // duplicarlo en otra variable de entorno.
    'project_id' => env('FIREBASE_PROJECT_ID'),
    // Ruta ABSOLUTA al JSON de la cuenta de servicio (NUNCA en el frontend ni en Git)
    'credentials' => env('FIREBASE_CREDENTIALS'),
    'icon' => env('FCM_ICON', 'https://appsline.com.mx/web-app-manifest-192x192.png'),
    'badge' => env('FCM_BADGE', 'https://appsline.com.mx/favicon-96x96.png'),
],
```

```dotenv
# .env de la API
FIREBASE_PROJECT_ID=appsline-xxxxx
FIREBASE_CREDENTIALS=/var/www/appsline-api/storage/app/firebase/service-account.json
FCM_ICON=https://appsline.com.mx/web-app-manifest-192x192.png
FCM_BADGE=https://appsline.com.mx/favicon-96x96.png
```

```bash
# En el servidor de la API
mkdir -p storage/app/firebase
cp ~/descargas/appsline-firebase-adminsdk-xxxxx.json storage/app/firebase/service-account.json
chmod 600 storage/app/firebase/service-account.json
php artisan config:clear
```

> Alternativa con SDK: `composer require kreait/laravel-firebase` y usar
> `$messaging = app('firebase.messaging');` con
> `CloudMessage::withTarget('token', $device->token)->withNotification(Notification::create($title, $body))->withData($payload)`.
> Deja en `FIREBASE_CREDENTIALS` la ruta del JSON. El ejemplo de arriba con
> `google/auth` no depende de ese paquete y hace exactamente lo mismo.

### 3.5 Enviar la notificación cuando pasa algo (lo importante)

El push sirve si se dispara en los eventos reales del panel. Ejemplos:

```php
<?php
// app/Observers/TaskObserver.php

namespace App\Observers;

use App\Models\Task;
use App\Models\User;
use App\Services\FcmService;

class TaskObserver
{
    public function __construct(private FcmService $fcm) {}

    public function updated(Task $task): void
    {
        if (! $task->wasChanged('assigned_to')) {
            return; // solo cuando cambia el responsable
        }

        $assignee = User::find($task->assigned_to);

        if (! $assignee || $assignee->is(auth()->user())) {
            return; // no te notifiques a ti mismo
        }

        $this->fcm->sendToDevices(
            $assignee->pushDevices,
            'Nueva tarea asignada',
            $task->title,
            [
                'url' => "/admin/tasks?task={$task->id}",
                'tag' => "task-{$task->id}",
                'task_id' => (string) $task->id,
            ]
        );
    }
}
```

Recomendaciones:

- Manda el push **desde una cola** (`ShouldQueue`, `dispatch()->afterResponse()` o
  un Job) para no retrasar la respuesta HTTP.
- Agrupa por usuario: `sendToDevices()` ya recorre todos sus dispositivos.
- Define un catálogo de eventos y sus textos (título / cuerpo / `url`):

  | Evento | Título | Cuerpo | `data.url` |
  |---|---|---|---|
  | Tarea asignada | Nueva tarea asignada | `{título}` | `/admin/tasks?task={id}` |
  | Tarea por vencer | Tarea por vencer | `{título}` vence mañana | `/admin/tasks?task={id}` |
  | Comentario nuevo | Nuevo comentario | `{autor}` comentó en `{proyecto}` | `/admin/projects/{id}` |
  | Proyecto actualizado | Proyecto actualizado | `{proyecto}` cambió de estado | `/admin/projects/{id}` |

  `data.url` acepta rutas relativas del panel (`/admin/tasks`); el service worker
  las resuelve contra el dominio del sitio. Para enviar a la ruta de notificación
  por defecto, omite `data.url`.

- Cualquier valor de `data` debe ser **string** (FCM rechaza números/boleanos).

### 3.6 Opcional: canal de notificación de Laravel

Si prefieres el estilo de Laravel (`$user->notify(...)`):

```php
<?php
// app/Notifications/Channels/FcmChannel.php

namespace App\Notifications\Channels;

use App\Services\FcmService;

class FcmChannel
{
    public function __construct(private FcmService $fcm) {}

    public function send($notifiable, $notification): void
    {
        $devices = $notifiable->pushDevices;

        if ($devices->isEmpty() || ! method_exists($notification, 'toFcm')) {
            return;
        }

        $message = $notification->toFcm($notifiable);

        $this->fcm->sendToDevices(
            $devices,
            $message['title'],
            $message['body'],
            $message['data'] ?? []
        );
    }
}
```

```php
<?php
// app/Notifications/TaskAssigned.php

namespace App\Notifications;

use App\Models\Task;
use App\Notifications\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class TaskAssigned extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Task $task) {}

    public function via(object $notifiable): array
    {
        return [FcmChannel::class];
    }

    public function toFcm(object $notifiable): array
    {
        return [
            'title' => 'Nueva tarea asignada',
            'body' => $this->task->title,
            'data' => [
                'url' => "/admin/tasks?task={$this->task->id}",
                'tag' => "task-{$this->task->id}",
            ],
        ];
    }
}
```

Uso: `$assignee->notify(new TaskAssigned($task));`

---

## 4. Probar de punta a punta

### 4.1 Sin tocar la API (solo navegador)

1. `npm run dev`, inicia sesión en `/login`.
2. Pulsa la campana 🔔 del encabezado (o Configuración → Preferencias → Activar).
3. Acepta el permiso del navegador. Debe aparecer una notificación local de
   confirmación (“Notificaciones activadas”).
4. Copia el token: en Configuración → Preferencias → **Copiar token** (en
   desarrollo también se imprime completo en la consola del navegador como
   `[push] token FCM de este dispositivo: …`).
5. Firebase Console → **Cloud Messaging** → *Enviar mensaje de prueba* →
   pega el token → Enviar. Debe aparecer la notificación, y al hacer clic abrir
   el panel.

Comprobaciones en DevTools:

- **Application → Service Workers**: `firebase-messaging-sw.js` en estado
  *activated*.
- **Application → Local Storage**: `appsline.push.device` (token + usuario) y
  `appsline.push.device_id`.
- **Application → Manifest/Permissions**: notificaciones en “Allow”.
- **Console**: sin errores `messaging/token-subscribe-failed`
  (si aparece, revisa `VITE_FIREBASE_VAPID_KEY` y reinicia el dev server).

### 4.2 Diagnóstico desde el panel (sin abrir DevTools)

**Configuración → Preferencias → Diagnóstico de notificaciones** está pensado
justo para “activé el push y no me llega nada”. Comprueba cada eslabón y, sobre
todo, deja ver la **respuesta cruda de la API**.

Qué revisa:

| Comprobación | Qué detecta |
|---|---|
| El navegador soporta push web | HTTPS/localhost, `Notification`, `ServiceWorker`, `PushManager` |
| Permiso del navegador | `granted` / `default` / `denied` (y cómo desbloquearlo) |
| Variables `VITE_FIREBASE_*` | Cuáles faltan y con qué proyecto está configurada la app |
| El service worker se sirve como JavaScript | El fallo típico de producción: la SPA devuelve `index.html` (con `text/html`) en `/firebase-messaging-sw.js` |
| Service worker registrado | Scope y estado (`active`, `installing`, `waiting`) |
| Token FCM de este dispositivo | Si existe, su longitud y —si el token lo permite— **el `projectId` que lleva dentro** |
| Dispositivos en la API (`GET /push/devices`) | Si el token de este navegador llegó a guardarse (o si hay tokens “fantasma”) |

Pruebas, de la más local a la más lejana:

1. **Notificación local**: el navegador muestra una notificación usando el
   service worker. Sin Firebase ni API. Si esto falla, el problema es del
   navegador o del archivo del service worker.
2. **Simular push (service worker)**: el panel le manda un payload al service
   worker (`postMessage` → `simulate-push`), que hace exactamente lo mismo que
   con un push real: notificación del sistema + aviso dentro del panel. Si esto
   funciona, el problema está en el **envío**.
3. **Probar un token de la base de datos**: pega el valor de `push_devices.token`
   (o pulsa el token de la tabla de dispositivos) y **Enviar prueba** →
   `POST /push/devices/test` con `{ token }`. El panel muestra el código HTTP y
   el cuerpo JSON:

   - `200` + sin notificación → el problema está en FCM (ver
     [SENDER_ID_MISMATCH](#44-códigos-de-error-de-fcm) y la API legacy).
   - `403/404` → ese token no pertenece al usuario autenticado (o el endpoint
     exige que sí).
   - `422/500` → mira el mensaje: suele traer el error de Google.
4. **Consola de Firebase**: pega el mismo token en *Cloud Messaging → Enviar
   mensaje de prueba*. Si **Firebase sí entrega y la API no**, el fallo es del
   backend (credenciales), no del frontend.
5. **Copiar curl**: comando listo para reproducir la petición desde una terminal,
   con el token de la base de datos y el de la sesión.

### 4.3 Con la API (terminal)

```bash
# 1) Registrar el dispositivo (token obtenido en el paso anterior)
curl -X POST https://api.appsline.com.mx/api/push/devices \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"token":"fZx...","platform":"web"}'

# 2) Notificación de prueba al usuario (o usa el botón "Enviar prueba" del panel)
curl -X POST https://api.appsline.com.mx/api/push/devices/test \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json"

# 2b) Notificación de prueba a un token concreto de la base de datos
curl -X POST https://api.appsline.com.mx/api/push/devices/test \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"token":"fZxTokenDeLaBaseDeDatos..."}'

# 3) Desvincular
curl -X DELETE https://api.appsline.com.mx/api/push/devices \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  -H "Content-Type: application/json" -d '{"token":"fZx..."}'
```

`POST /push/devices/test` debe responder **el error real de FCM**, no un `200`
optimista: es lo que convierte el diagnóstico del panel en algo útil.

```php
// app/Services/FcmService.php (extracto)
try {
    $this->messaging->send($message);
    return response()->json(['ok' => true, 'token' => $device->token]);
} catch (\Kreait\Firebase\Exception\MessagingException $e) {
    // 404 UNREGISTERED -> borra el dispositivo
    // 403 SENDER_ID_MISMATCH -> cuenta de servicio de otro proyecto
    return response()->json([
        'ok' => false,
        'error' => $e->getMessage(),
        'code' => $e->errors()[0]['status'] ?? null,
    ], 502);
}
```

Pruebas automatizadas del repositorio (no necesitan Firebase):

```bash
npm run test:unit   # service worker + utilidades de diagnóstico
npm run test:e2e    # panel completo con la API interceptada
```

### 4.4 Códigos de error de FCM

| Código / mensaje | Significado | Qué hacer |
|---|---|---|
| `SENDER_ID_MISMATCH` | El token es de otro proyecto de Firebase | La cuenta de servicio del backend debe ser del **mismo** proyecto que el token (`projectId` que muestra el diagnóstico) |
| `RESOURCE_PROJECT_INVALID` (400) | El `projectId` de la URL `projects/{projectId}/messages:send` no coincide con el proyecto de la cuenta de servicio o está vacío | Verifica que `FIREBASE_PROJECT_ID` en la API sea exactamente el `project_id` del JSON de la cuenta de servicio (y el mismo que `VITE_FIREBASE_PROJECT_ID` del frontend). Derívalo del propio JSON para no duplicarlo. |
| `UNREGISTERED` (404) | El token ya no existe (navegador borrado, permiso revocado, app desinstalada) | Borra la fila de `push_devices` y vuelve a activar en ese dispositivo |
| `INVALID_ARGUMENT` (400) | Token mal formado o payload inválido (por ejemplo, `data` con números/boleanos) | Revisa que todos los valores de `data` sean **strings** |
| `THIRD_PARTY_AUTH_ERROR` / `MISMATCHED_CREDENTIAL` | Credenciales sin permiso sobre el proyecto | Revisa el rol de la cuenta de servicio (Firebase Admin SDK Administrator Service Agent) |
| `QUOTA_EXCEEDED` / `MESSAGE_RATE_EXCEEDED` | Demasiados mensajes por dispositivo | Agrupa las notificaciones |
| `404 Not Found` en `fcm.googleapis.com/fcm/send` | La API **legacy** está apagada desde 2024 | Migra el envío a **HTTP v1** con `google/auth` (o `kreait/laravel-firebase`) |

---

## 5. Límites y problemas comunes

| Síntoma | Causa / solución |
|---|---|
| La tarjeta dice “Firebase todavía no está configurado” | Faltan variables `VITE_FIREBASE_*` o no reiniciaste el dev server / no rehiciste el build. |
| “Falta la clave VAPID” | Genera el par de claves en Cloud Messaging → Certificados push web y define `VITE_FIREBASE_VAPID_KEY`. |
| `messaging/token-subscribe-failed` en consola | VAPID incorrecta/ajena al proyecto, o la API key está restringida y no permite *Firebase Installations API* / *Firebase Cloud Messaging API*. |
| No aparece la opción de activar | El navegador no soporta push, no es HTTPS, o el navegador ya tiene las notificaciones **bloqueadas** para el sitio (se reactivan desde el candado 🔒 → Notificaciones → Permitir; en Chrome también en `chrome://settings/content/notifications`). |
| Nada llega al celular (iPhone) | En iOS/iPadOS el push web requiere **instalar el panel como app** (Compartir → Añadir a pantalla de inicio) y iOS 16.4 o superior. |
| Llega la notificación pero el clic no abre la ruta | Revisa `data.url` (debe existir en el router, p. ej. `/admin/projects/12`) o `webpush.fcm_options.link` si envías URL absoluta. |
| `UNREGISTERED` / 404 al enviar | El usuario desactivó las notificaciones o el token caducó: el servicio borra la fila automáticamente. |
| La API responde `200` al enviar una prueba y no llega nada | Usa Configuración → Preferencias → **Diagnóstico**: compara el `projectId` del token con el de la app (`SENDER_ID_MISMATCH`) y prueba el mismo token desde la consola de Firebase para saber si el fallo es del backend o de FCM. |
| El backend usa la API legacy (`fcm.googleapis.com/fcm/send`) | Google la apagó en 2024: responde error y no se entrega nada. Migra a **HTTP v1** (ver §4.4). |
| Se registran muchos dispositivos “fantasma” | Es normal: cada navegador/perfil es un token. Limpia los `last_seen_at` antiguos con un comando programado (`php artisan push:prune`) si te molesta. |
| El push dejó de funcionar tras un deploy | Revisa que `firebase-messaging-sw.js` se sirva desde la raíz y sin caché agresiva, y que el build de producción tenga las variables `VITE_FIREBASE_*`. |
| Quiero que varios usuarios del mismo equipo se notifiquen | El token es del navegador; al iniciar sesión con otra cuenta el `POST /push/devices` lo reasigna y al cerrar sesión se desvincula. |

Seguridad:

- El JSON de la cuenta de servicio **solo** vive en el backend (`chmod 600`) y
  **nunca** en el repositorio ni en el frontend.
- Puedes (y conviene) restringir la API key web en Google Cloud Console →
  *APIs y servicios* → *Credenciales* → restricción por *sitios web*
  (`https://appsline.com.mx/*`, `https://*.appsline.com.mx/*`,
  `http://localhost:5173/*`) permitiendo *Firebase Installations API* y
  *Firebase Cloud Messaging API*. Si el registro empieza a fallar, revisa esas
  restricciones antes que nada.
- Un push es visible para quien tenga el dispositivo desbloqueado: no incluyas
  datos sensibles en el título/cuerpo; usa `data.url` para llevar al panel.

---

## 6. Checklist

**Firebase Console**

- [ ] Proyecto creado y app **Web** registrada.
- [ ] `firebaseConfig` copiado.
- [ ] Par de claves **Web Push** generado (clave pública anotada).
- [ ] Cuenta de servicio descargada (JSON) y guardada en el backend.
- [ ] API *Firebase Cloud Messaging API (V1)* habilitada.

**Frontend (este repo)**

- [ ] Variables `VITE_FIREBASE_*` (7) definidas en desarrollo **y** en el build de producción.
- [ ] `https://tu-dominio/firebase-messaging-sw.js` responde `200` con `text/javascript`.
- [ ] Al activar desde la campana, el navegador muestra la notificación de confirmación.
- [ ] **Diagnóstico de notificaciones** (Configuración → Preferencias): todo en verde y
      las pruebas “Notificación local” y “Simular push” muestran la notificación.
- [ ] `npm run test:unit` y `npm run build` en verde.

**API (Laravel)**

- [ ] Migración `push_devices` ejecutada y modelo creado.
- [ ] `POST`, `DELETE`, `GET` y `POST /push/devices/test` implementados y protegidos con `auth:api`.
- [ ] `FIREBASE_PROJECT_ID` y `FIREBASE_CREDENTIALS` configurados; `google/auth` instalado.
- [ ] `POST /push/devices/test` entrega la notificación al dispositivo y acepta
      `{ token }` para probar un token concreto de `push_devices`.
- [ ] Un token de otro proyecto responde con el error de FCM (no un `200` optimista).
- [ ] Envíos reales enganchados a los eventos (tareas, comentarios, proyectos) y encolados.
