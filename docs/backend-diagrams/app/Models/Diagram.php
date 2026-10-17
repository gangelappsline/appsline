<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Diagrama de flujo del panel.
 *
 * `data` es el dibujo completo (nodos con forma y estilo, conexiones, vista y
 * ajustes) y se trata como un bloque opaco: se guarda y se devuelve tal cual.
 * Nunca se reconstruye a partir de un subconjunto validado —ver
 * docs/API-DIAGRAMS.md, sección 4.
 *
 * @property int $id
 * @property int $project_id
 * @property int|null $task_id
 * @property string $name
 * @property string|null $description
 * @property array<string, mixed> $data
 * @property int|null $created_by
 */
class Diagram extends Model
{
    use HasFactory;

    /** Límites orientativos del dibujo; los comprueba el controlador. */
    public const MAX_NODES = 2000;

    public const MAX_EDGES = 4000;

    protected $fillable = [
        'project_id',
        'task_id',
        'name',
        'description',
        'data',
        'created_by',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'array',
            'task_id' => 'integer',
            'project_id' => 'integer',
            'created_by' => 'integer',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(ProjectTask::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Diagramas de un proyecto, opcionalmente filtrados por tarea. */
    public function scopeOfProject($query, int $projectId, ?int $taskId = null)
    {
        return $query->where('project_id', $projectId)
            ->when($taskId !== null, fn ($q) => $q->where('task_id', $taskId))
            ->latest('updated_at');
    }
}

/*
 * Relaciones inversas para pegar en los modelos existentes:

    // app/Models/Project.php
    public function diagrams(): HasMany
    {
        return $this->hasMany(Diagram::class);
    }

    // app/Models/ProjectTask.php
    public function diagrams(): HasMany
    {
        return $this->hasMany(Diagram::class);
    }
 */
