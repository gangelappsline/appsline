<?php

namespace App\Http\Controllers\API;

use App\Http\Resources\DiagramResource;
use App\Models\Diagram;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Diagramas de flujo del panel.
 *
 * Rutas (dentro del grupo `auth:api` de routes/api.php):
 *
 *   GET    /projects/{project_id}/diagrams            index   (?task_id= opcional)
 *   POST   /projects/{project_id}/diagrams            store
 *   GET    /projects/{project_id}/diagrams/{id}       show
 *   PUT    /projects/{project_id}/diagrams/{id}       update
 *   DELETE /projects/{project_id}/diagrams/{id}       destroy
 *   GET    /diagrams                                  all     (opcional, vista global)
 *
 * ⚠️  La única regla que debe existir sobre el dibujo es `'data' => 'array'`.
 * En cuanto se agrega una regla anidada (`data.nodes.*.data.label`, …),
 * `$request->validated()` deja de devolver `data` completo —desde Laravel 9 el
 * validador excluye las claves de un arreglo que no tengan regla propia— y el
 * diagrama se guarda sin `shape` ni `style`: al reabrirlo, todos los nodos
 * vuelven como «Proceso». Por eso aquí se valida la envoltura y se guarda con
 * `$request->input('data')`. Ver docs/API-DIAGRAMS.md, secciones 4 y 9.
 */
class DiagramController extends BaseController
{
    /**
     * Lista los diagramas del proyecto (o de una tarea con ?task_id=).
     */
    public function index(Request $request, $project_id)
    {
        $taskId = $request->filled('task_id') ? (int) $request->input('task_id') : null;

        $diagrams = Diagram::ofProject((int) $project_id, $taskId)
            ->with('task:id,title')
            ->get();

        return $this->sendResponse(DiagramResource::collection($diagrams), 'Diagrams retrieved successfully.');
    }

    /**
     * Crea un diagrama. Devuelve el registro con su ID definitivo: el panel lo
     * necesita para no duplicar con el autoguardado.
     */
    public function store(Request $request, $project_id)
    {
        $project = Project::findOrFail($project_id);

        $validated = $request->validate($this->rules($project->id, required: true));
        $data = $this->drawing($request, required: true);

        $diagram = new Diagram();
        $diagram->project_id = $project->id;
        $diagram->task_id = $validated['task_id'] ?? null;
        $diagram->name = $validated['name'];
        $diagram->description = $validated['description'] ?? null;
        $diagram->data = $data;
        $diagram->created_by = auth()->id();
        $diagram->save();

        return $this->sendResponse(
            new DiagramResource($diagram->load('task:id,title')),
            'Diagram created successfully.'
        );
    }

    /**
     * Un diagrama, con el dibujo completo.
     */
    public function show($project_id, $id)
    {
        $diagram = $this->findDiagram($project_id, $id);

        return $this->sendResponse(
            new DiagramResource($diagram->load('task:id,title')),
            'Diagram retrieved successfully.'
        );
    }

    /**
     * Actualiza metadatos y/o el dibujo. Un PUT sin `data` no borra el dibujo.
     */
    public function update(Request $request, $project_id, $id)
    {
        $diagram = $this->findDiagram($project_id, $id);

        $validated = $request->validate($this->rules($diagram->project_id, required: false));

        $attributes = [];
        if (array_key_exists('name', $validated)) {
            $attributes['name'] = $validated['name'];
        }
        if ($request->has('description')) {
            $attributes['description'] = $validated['description'] ?? null;
        }
        if ($request->has('task_id')) {
            $attributes['task_id'] = $validated['task_id'] ?? null;
        }
        if ($request->has('data')) {
            // El bloque completo, tal cual llegó.
            $attributes['data'] = $this->drawing($request, required: false);
        }

        if ($attributes !== []) {
            $diagram->update($attributes);
            $diagram->refresh();
        }

        return $this->sendResponse(
            new DiagramResource($diagram->load('task:id,title')),
            'Diagram updated successfully.'
        );
    }

    /**
     * Elimina un diagrama.
     */
    public function destroy($project_id, $id)
    {
        $diagram = $this->findDiagram($project_id, $id);
        $diagram->delete();

        return $this->sendResponse(null, 'Diagram deleted successfully.');
    }

    /**
     * Opcional: GET /api/diagrams — vista global del panel (/admin/diagrams).
     *
     * ProjectController@index devuelve todos los proyectos, así que aquí se hace
     * lo mismo con los diagramas. Si más adelante se acotan los proyectos por
     * usuario, filtra también este listado con los mismos `project_id`.
     */
    public function all(Request $request)
    {
        $diagrams = Diagram::query()
            ->with(['task:id,title', 'project:id,name'])
            ->latest('updated_at')
            ->get();

        return $this->sendResponse(DiagramResource::collection($diagrams), 'Diagrams retrieved successfully.');
    }

    /* ------------------------------------------------------------------ */
    /* Internos                                                            */
    /* ------------------------------------------------------------------ */

    /**
     * Reglas de la envoltura. `data` se valida como arreglo y nada más: ninguna
     * regla `data.*`, o `validated()` devolvería el dibujo recortado.
     */
    private function rules(int $projectId, bool $required): array
    {
        $name = $required ? 'required|string|max:160' : 'sometimes|required|string|max:160';

        return [
            'name' => $name,
            'description' => 'nullable|string|max:5000',
            'task_id' => [
                'nullable', 'integer',
                Rule::exists('project_tasks', 'id')->where('project_id', $projectId),
            ],
            'data' => $required ? 'required|array' : 'sometimes|array',
        ];
    }

    /**
     * El dibujo completo, con límites de tamaño comprobados a mano (hacerlo con
     * reglas anidadas es justo lo que provoca la pérdida de `shape`/`style`).
     */
    private function drawing(Request $request, bool $required): array
    {
        $data = $request->input('data');

        if (! is_array($data)) {
            if ($required) {
                throw ValidationException::withMessages(['data' => 'El campo data es obligatorio.']);
            }

            return [];
        }

        $nodes = is_array($data['nodes'] ?? null) ? $data['nodes'] : [];
        $edges = is_array($data['edges'] ?? null) ? $data['edges'] : [];

        if ($required && $nodes === []) {
            throw ValidationException::withMessages(['data' => 'El diagrama no tiene nodos.']);
        }
        if (count($nodes) > Diagram::MAX_NODES) {
            throw ValidationException::withMessages([
                'data' => 'El diagrama supera los '.Diagram::MAX_NODES.' nodos permitidos.',
            ]);
        }
        if (count($edges) > Diagram::MAX_EDGES) {
            throw ValidationException::withMessages([
                'data' => 'El diagrama supera las '.Diagram::MAX_EDGES.' conexiones permitidas.',
            ]);
        }

        return $data;
    }

    /**
     * Búsqueda acotada al proyecto (mismo estilo que ProjectTaskController).
     */
    private function findDiagram($project_id, $id): Diagram
    {
        return Diagram::where('id', $id)
            ->where('project_id', $project_id)
            ->firstOrFail();
    }
}
