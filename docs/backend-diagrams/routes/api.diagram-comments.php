<?php

/**
 * Rutas de comentarios de diagramas/mockups (OPCIONAL).
 *
 * Pegar DENTRO del grupo `auth:api` de routes/api.php, junto a las de
 * diagramas. El panel usa hoy `data.comments`; cuando la API exponga estas
 * rutas se puede migrar sin tocar el diseño de los mockups
 * (docs/API-MOCKUPS.md §5.1).
 */

use App\Http\Controllers\API\DiagramCommentController;

Route::middleware('auth:api')->group(function () {
    // ... rutas existentes ...

    Route::get('/projects/{project_id}/diagrams/{diagram_id}/comments', [DiagramCommentController::class, 'index']);
    Route::post('/projects/{project_id}/diagrams/{diagram_id}/comments', [DiagramCommentController::class, 'store']);
    Route::put('/projects/{project_id}/diagrams/{diagram_id}/comments/{id}', [DiagramCommentController::class, 'update']);
    Route::delete('/projects/{project_id}/diagrams/{diagram_id}/comments/{id}', [DiagramCommentController::class, 'destroy']);
});
