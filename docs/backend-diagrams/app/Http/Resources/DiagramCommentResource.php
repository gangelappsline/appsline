<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Comentario de revisión.
 *
 * El formato coincide con `data.comments[]` del panel (`body` ⇄ `text`), para
 * poder pasar de un almacenamiento al otro sin tocar el frontend.
 */
class DiagramCommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'diagram_id' => $this->diagram_id,
            'body' => $this->body,
            'node_id' => $this->node_id,
            'widget_id' => $this->widget_id,
            'parent_id' => $this->parent_id,
            'resolved' => (bool) $this->resolved,
            'resolved_at' => $this->resolved_at,
            'author' => $this->whenLoaded('author', fn () => [
                'id' => $this->author->id,
                'name' => $this->author->name,
                'email' => $this->author->email,
            ]),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
