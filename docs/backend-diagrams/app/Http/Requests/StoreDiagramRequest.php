<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Variante FormRequest para los diagramas (el controlador de ejemplo valida en
 * línea con `$request->validate()`, igual que ProjectTaskController; usa esta
 * clase solo si prefieres FormRequest).
 *
 * ⚠️  Regla de oro: **ninguna regla `data.*` anidada**. Desde Laravel 9,
 * `Illuminate\Validation\Factory` trae `$excludeUnvalidatedArrayKeys = true`, así
 * que en cuanto existe una regla como `data.nodes.*.data.label`, `validated()`
 * devuelve el arreglo `data` recortado: sin `shape`, sin `style`, sin
 * `width`/`height`, sin `edges[].data`. El diagrama se guarda degradado y al
 * reabrirlo todos los nodos se dibujan como «Proceso».
 *
 * Por eso el dibujo se obtiene con `drawing()` (== `$request->input('data')`) y
 * nunca con `validated()['data']`. Ver docs/API-DIAGRAMS.md, secciones 4 y 9.
 */
class StoreDiagramRequest extends FormRequest
{
    public function authorize(): bool
    {
        // La ruta ya va dentro de auth:api. Si el proyecto usa políticas,
        // devuelve aquí $this->user()->can('update', $this->project()).
        return true;
    }

    public function rules(): array
    {
        $projectId = (int) $this->route('project_id');
        $creating = $this->isMethod('post');

        return [
            'name' => $creating ? 'required|string|max:160' : 'sometimes|required|string|max:160',
            'description' => 'nullable|string|max:5000',
            'task_id' => [
                'nullable', 'integer',
                // La tarea debe ser del mismo proyecto de la URL.
                Rule::exists('project_tasks', 'id')->where('project_id', $projectId),
            ],
            // Una sola regla para el dibujo. Nada de data.nodes.* ni data.edges.*.
            'data' => $creating ? 'required|array' : 'sometimes|array',
        ];
    }

    public function messages(): array
    {
        return [
            'data.required' => 'El diagrama llegó sin dibujo (data).',
            'task_id.exists' => 'La tarea indicada no pertenece a este proyecto.',
        ];
    }

    /**
     * El dibujo completo, tal cual lo envió el panel.
     */
    public function drawing(): array
    {
        $data = $this->input('data');

        return is_array($data) ? $data : [];
    }

    /**
     * Límites de tamaño comprobados a mano: hacerlos con reglas anidadas es
     * justo lo que provoca la poda del dibujo.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $data = $this->drawing();
            $nodes = is_array($data['nodes'] ?? null) ? $data['nodes'] : [];
            $edges = is_array($data['edges'] ?? null) ? $data['edges'] : [];

            if ($this->isMethod('post') && $nodes === []) {
                $validator->errors()->add('data', 'El diagrama no tiene nodos.');
            }
            if (count($nodes) > 2000) {
                $validator->errors()->add('data', 'El diagrama supera los 2000 nodos permitidos.');
            }
            if (count($edges) > 4000) {
                $validator->errors()->add('data', 'El diagrama supera las 4000 conexiones permitidas.');
            }
        });
    }
}
