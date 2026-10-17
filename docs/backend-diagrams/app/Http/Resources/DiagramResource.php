<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Respuesta de un diagrama.
 *
 * `data` se devuelve **completo**: el panel necesita `data.nodes[].data.shape`,
 * `data.nodes[].data.style`, `width`/`height`, `data.edges[].data` y los handles
 * para volver a dibujar lo que el usuario guardó. Recortarlo aquí tiene el mismo
 * efecto que recortarlo al guardar (todos los nodos vuelven como «Proceso»).
 *
 * Ver docs/API-DIAGRAMS.md, secciones 3, 4 y 9.
 */
class DiagramResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'task_id' => $this->task_id,
            'task' => $this->whenLoaded('task', fn () => [
                'id' => $this->task->id,
                'title' => $this->task->title,
            ]),
            'project' => $this->whenLoaded('project', fn () => [
                'id' => $this->project->id,
                'name' => $this->project->name,
            ]),
            'name' => $this->name,
            'description' => $this->description,
            // El dibujo tal cual: sin ->only(), sin map(), sin reindexar.
            'data' => $this->data,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
