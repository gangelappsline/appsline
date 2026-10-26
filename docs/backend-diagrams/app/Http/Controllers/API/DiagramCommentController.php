<?php

namespace App\Http\Controllers\API;

use App\Http\Resources\DiagramCommentResource;
use App\Models\Diagram;
use App\Models\DiagramComment;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Comentarios de revisión de diagramas y mockups (OPCIONAL).
 *
 * El panel ya guarda los comentarios en `diagrams.data.comments`; esta API es la
 * alternativa con autor indexado, notificaciones e historial. Ver
 * docs/API-MOCKUPS.md §5.1.
 *
 * Rutas (dentro del grupo `auth:api`):
 *
 *   GET    /projects/{project_id}/diagrams/{diagram_id}/comments
 *   POST   /projects/{project_id}/diagrams/{diagram_id}/comments
 *   PUT    /projects/{project_id}/diagrams/{diagram_id}/comments/{id}
 *   DELETE /projects/{project_id}/diagrams/{diagram_id}/comments/{id}
 *
 * El panel envía `body` (no `text`) y opcionalmente `node_id` / `widget_id`.
 */
class DiagramCommentController extends BaseController
{
    /** Lista los comentarios del diagrama. `?resolved=0|1` es opcional. */
    public function index(Request $request, $project_id, $diagram_id)
    {
        $diagram = $this->findDiagram($project_id, $diagram_id);

        $resolved = $request->has('resolved')
            ? filter_var($request->input('resolved'), FILTER_VALIDATE_BOOLEAN)
            : null;

        $comments = DiagramComment::ofDiagram($diagram->id, $resolved)
            ->with('author:id,name,email')
            ->get();

        return $this->sendResponse(
            DiagramCommentResource::collection($comments),
            'Diagram comments retrieved successfully.'
        );
    }

    /** Crea un comentario; el autor es siempre el usuario autenticado. */
    public function store(Request $request, $project_id, $diagram_id)
    {
        $diagram = $this->findDiagram($project_id, $diagram_id);

        $validated = $request->validate([
            'body' => 'required|string|max:4000',
            // IDs de los nodos/elementos del mockup (no son FKs: viven en el JSON).
            'node_id' => 'nullable|string|max:64',
            'widget_id' => 'nullable|string|max:64',
            'parent_id' => 'nullable|integer|exists:diagram_comments,id',
        ]);

        // La pantalla indicada debe existir en el diagrama: evita comentarios
        // huérfanos si el cliente manda un ID viejo.
        if (! empty($validated['node_id']) && ! $this->screenExists($diagram, $validated['node_id'])) {
            throw ValidationException::withMessages([
                'node_id' => 'La pantalla indicada no existe en este diagrama.',
            ]);
        }

        $comment = DiagramComment::create([
            'diagram_id' => $diagram->id,
            'user_id' => auth()->id(),
            'node_id' => $validated['node_id'] ?? null,
            'widget_id' => $validated['widget_id'] ?? null,
            'parent_id' => $validated['parent_id'] ?? null,
            'body' => $validated['body'],
        ]);

        return $this->sendResponse(
            new DiagramCommentResource($comment->load('author:id,name,email')),
            'Diagram comment created successfully.'
        );
    }

    /** Edita el texto y/o resuelve el comentario. */
    public function update(Request $request, $project_id, $diagram_id, $id)
    {
        $diagram = $this->findDiagram($project_id, $diagram_id);
        $comment = $this->findComment($diagram, $id);

        $validated = $request->validate([
            'body' => 'sometimes|required|string|max:4000',
            'resolved' => 'sometimes|boolean',
            'node_id' => 'sometimes|nullable|string|max:64',
            'widget_id' => 'sometimes|nullable|string|max:64',
        ]);

        if (array_key_exists('body', $validated)) {
            $comment->body = $validated['body'];
        }
        if (array_key_exists('node_id', $validated)) {
            $comment->node_id = $validated['node_id'];
        }
        if (array_key_exists('widget_id', $validated)) {
            $comment->widget_id = $validated['widget_id'];
        }
        if (array_key_exists('resolved', $validated)) {
            $comment->setResolved((bool) $validated['resolved'], auth()->id());
        } else {
            $comment->save();
        }

        return $this->sendResponse(
            new DiagramCommentResource($comment->fresh()->load('author:id,name,email')),
            'Diagram comment updated successfully.'
        );
    }

    /** Elimina el comentario (y sus respuestas, por la FK en cascada). */
    public function destroy($project_id, $diagram_id, $id)
    {
        $diagram = $this->findDiagram($project_id, $diagram_id);
        $this->findComment($diagram, $id)->delete();

        return $this->sendResponse(null, 'Diagram comment deleted successfully.');
    }

    /* ------------------------------------------------------------------ */
    /* Internos                                                            */
    /* ------------------------------------------------------------------ */

    private function findDiagram($project_id, $diagram_id): Diagram
    {
        return Diagram::where('id', $diagram_id)
            ->where('project_id', $project_id)
            ->firstOrFail();
    }

    private function findComment(Diagram $diagram, $id): DiagramComment
    {
        return DiagramComment::where('id', $id)
            ->where('diagram_id', $diagram->id)
            ->firstOrFail();
    }

    /**
     * Comprueba que el nodo exista en `data.nodes` y sea una pantalla.
     * Si el diagrama es solo de flujo, acepta cualquier nodo existente.
     */
    private function screenExists(Diagram $diagram, string $nodeId): bool
    {
        $nodes = $diagram->data['nodes'] ?? [];

        foreach ($nodes as $node) {
            if (($node['id'] ?? null) !== $nodeId) {
                continue;
            }

            $isScreen = ($node['type'] ?? null) === 'screen'
                || ($node['data']['shape'] ?? null) === 'screen';

            return $isScreen || ! $this->hasScreens($nodes);
        }

        return false;
    }

    private function hasScreens(array $nodes): bool
    {
        foreach ($nodes as $node) {
            if (($node['type'] ?? null) === 'screen' || ($node['data']['shape'] ?? null) === 'screen') {
                return true;
            }
        }

        return false;
    }
}
