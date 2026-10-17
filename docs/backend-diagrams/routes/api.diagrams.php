<?php

/**
 * Rutas de diagramas — pegar DENTRO del grupo `auth:api` ya existente en
 * routes/api.php (junto a `/projects/{project_id}/tasks`).
 *
 * El panel llama exactamente a estas URL (src/services/diagrams.js):
 *
 *   GET    /api/projects/{project_id}/diagrams?task_id=
 *   POST   /api/projects/{project_id}/diagrams
 *   GET    /api/projects/{project_id}/diagrams/{diagram}
 *   PUT    /api/projects/{project_id}/diagrams/{diagram}
 *   DELETE /api/projects/{project_id}/diagrams/{diagram}
 *   GET    /api/diagrams            (opcional, vista global)
 */

use App\Http\Controllers;

Route::middleware('auth:api')->group(function () {
    // ... rutas existentes ...

    // Los parámetros de la ruta llegan por posición al controlador
    // (index(Request $request, $project_id), show($project_id, $id), …),
    // igual que en ProjectTaskController.
    Route::apiResource('/projects/{project_id}/diagrams', Controllers\API\DiagramController::class);

    // Vista global /admin/diagrams. Opcional: si no existe, el panel recorre
    // proyecto por proyecto.
    Route::get('/diagrams', [Controllers\API\DiagramController::class, 'all']);
});
