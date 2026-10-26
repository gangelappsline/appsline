<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Comentario de revisión de un diagrama o de un mockup (OPCIONAL).
 *
 * El panel puede trabajar con `diagrams.data.comments`; esta tabla es la versión
 * con autor indexado que permite notificaciones e historial. Ver
 * docs/API-MOCKUPS.md §5.1.
 *
 * @property int $id
 * @property int $diagram_id
 * @property int|null $user_id
 * @property string|null $node_id
 * @property string|null $widget_id
 * @property int|null $parent_id
 * @property string $body
 * @property bool $resolved
 */
class DiagramComment extends Model
{
    use HasFactory;

    protected $fillable = [
        'diagram_id',
        'user_id',
        'node_id',
        'widget_id',
        'parent_id',
        'body',
        'resolved',
        'resolved_by',
        'resolved_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'resolved' => 'boolean',
            'resolved_at' => 'datetime',
            'diagram_id' => 'integer',
            'user_id' => 'integer',
            'parent_id' => 'integer',
        ];
    }

    public function diagram(): BelongsTo
    {
        return $this->belongsTo(Diagram::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(DiagramComment::class, 'parent_id')->orderBy('created_at');
    }

    /** Comentarios abiertos o resueltos de un diagrama. */
    public function scopeOfDiagram(Builder $query, int $diagramId, ?bool $resolved = null): Builder
    {
        return $query->where('diagram_id', $diagramId)
            ->when($resolved !== null, fn (Builder $q) => $q->where('resolved', $resolved))
            ->orderBy('created_at');
    }

    /** Marca o reabre el comentario dejando rastro de quién lo hizo. */
    public function setResolved(bool $resolved, ?int $userId = null): self
    {
        $this->resolved = $resolved;
        $this->resolved_by = $resolved ? $userId : null;
        $this->resolved_at = $resolved ? now() : null;
        $this->save();

        return $this;
    }
}
