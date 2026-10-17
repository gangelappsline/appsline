<?php

namespace Tests\Feature;

use App\Models\Diagram;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Passport\Passport;
use Tests\TestCase;

/**
 * Regresión del bug «al reabrir el diagrama todos los nodos se convierten en
 * nodos de proceso».
 *
 * La causa era la poda de `validated()`: con reglas anidadas (`data.nodes.*.…`)
 * el arreglo `data` llega a la base de datos sin `shape`, sin `style`, sin
 * `width`/`height` y sin el estilo de las conexiones. Estos tests fallan en
 * cuanto alguien vuelve a validar el dibujo campo por campo o guarda con
 * `$request->validated()['data']`.
 *
 * Ver docs/API-DIAGRAMS.md (secciones 4 y 9).
 *
 * Si el proyecto usa Sanctum en lugar de Passport, sustituye `Passport::actingAs`
 * por `Sanctum::actingAs` (y el import correspondiente).
 */
class DiagramContentIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private int $projectId;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::factory()->create();
        Passport::actingAs($user);

        $project = Project::create([
            'name' => 'Portal de clientes',
            'description' => null,
            'user_id' => $user->id,
            'budget' => 0,
        ]);

        $this->projectId = $project->id;
    }

    /**
     * Dibujo con tres tipos de nodo distintos, estilos y una conexión con
     * etiqueta: exactamente lo que el panel envía al guardar.
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Flujo con variantes',
            'description' => null,
            'task_id' => null,
            'data' => [
                'version' => 1,
                'nodes' => [
                    [
                        'id' => 'a', 'type' => 'flow', 'width' => 160, 'height' => 60,
                        'position' => ['x' => 120, 'y' => 60],
                        'data' => [
                            'label' => 'Inicio', 'shape' => 'terminal', 'locked' => false,
                            'description' => null, 'link' => null,
                            'style' => ['fill' => '#e0f2fe', 'stroke' => '#0284c7', 'fontSize' => 14],
                        ],
                    ],
                    [
                        'id' => 'b', 'type' => 'flow', 'width' => 180, 'height' => 90,
                        'position' => ['x' => 120, 'y' => 220],
                        'data' => ['label' => '¿Correcto?', 'shape' => 'decision', 'style' => ['fill' => '#fef9c3']],
                    ],
                    [
                        'id' => 'c', 'type' => 'flow', 'width' => 150, 'height' => 90,
                        'position' => ['x' => 420, 'y' => 220],
                        'data' => ['label' => 'Guardar', 'shape' => 'database', 'style' => ['fill' => '#dcfce7']],
                    ],
                ],
                'edges' => [
                    [
                        'id' => 'e1', 'source' => 'a', 'target' => 'b', 'type' => 'smoothstep',
                        'sourceHandle' => 'bottom', 'targetHandle' => 'top',
                        'data' => ['label' => 'sí', 'color' => '#dc2626', 'animated' => false],
                    ],
                    ['id' => 'e2', 'source' => 'b', 'target' => 'c', 'type' => 'smoothstep', 'data' => ['label' => null]],
                ],
                'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
                'settings' => ['background' => 'dots', 'direction' => 'TB'],
            ],
        ], $overrides);
    }

    public function test_store_guarda_y_devuelve_el_dibujo_completo(): void
    {
        $response = $this->postJson("/api/projects/{$this->projectId}/diagrams", $this->payload());

        // sendResponse() de BaseController contesta siempre 200.
        $response->assertOk();
        $response->assertJsonPath('data.data.nodes.0.data.shape', 'terminal');
        $response->assertJsonPath('data.data.nodes.1.data.shape', 'decision');
        $response->assertJsonPath('data.data.nodes.2.data.shape', 'database');
        $response->assertJsonPath('data.data.nodes.0.data.style.fill', '#e0f2fe');
        $response->assertJsonPath('data.data.nodes.0.width', 160);
        $response->assertJsonPath('data.data.edges.0.data.label', 'sí');
        $response->assertJsonPath('data.data.settings.background', 'dots');

        $this->assertNotNull($response->json('data.id'), 'POST debe devolver el ID definitivo');
    }

    public function test_las_formas_sobreviven_al_ciclo_guardar_y_consultar(): void
    {
        $created = $this->postJson("/api/projects/{$this->projectId}/diagrams", $this->payload())->json('data');
        $id = $created['id'];

        // Guardar de nuevo (autoguardado del editor) con los mismos tipos.
        $this->putJson("/api/projects/{$this->projectId}/diagrams/{$id}", $this->payload([
            'name' => 'Flujo revisado',
        ]))->assertOk();

        // Lo que quedó en la base de datos.
        $stored = Diagram::findOrFail($id)->data;
        $this->assertSame(
            ['terminal', 'decision', 'database'],
            array_map(fn ($node) => $node['data']['shape'] ?? null, $stored['nodes']),
            'El servidor perdió el tipo de los nodos: al reabrirlo todo se dibuja como Proceso'
        );
        $this->assertSame('#e0f2fe', $stored['nodes'][0]['data']['style']['fill']);
        $this->assertSame('flow', $stored['nodes'][0]['type']);
        $this->assertSame(160, $stored['nodes'][0]['width']);
        $this->assertSame('sí', $stored['edges'][0]['data']['label']);
        $this->assertSame('bottom', $stored['edges'][0]['sourceHandle']);

        // Y lo que recibe el panel al volver a consultar.
        $show = $this->getJson("/api/projects/{$this->projectId}/diagrams/{$id}")->assertOk();
        $show->assertJsonPath('data.name', 'Flujo revisado');
        $show->assertJsonPath('data.data.nodes.0.data.shape', 'terminal');
        $show->assertJsonPath('data.data.nodes.2.data.shape', 'database');
        $show->assertJsonPath('data.data.edges.0.data.color', '#dc2626');

        // El listado del proyecto debe traer el mismo dibujo (o un índice ligero
        // con shape/style incluidos: docs/API-DIAGRAMS.md §5).
        $index = $this->getJson("/api/projects/{$this->projectId}/diagrams")->assertOk();
        $index->assertJsonPath('data.0.data.nodes.0.data.shape', 'terminal');
        $index->assertJsonPath('data.0.data.nodes.1.data.shape', 'decision');
    }

    public function test_un_put_de_solo_metadatos_no_borra_el_dibujo(): void
    {
        $id = $this->postJson("/api/projects/{$this->projectId}/diagrams", $this->payload())->json('data.id');

        $this->putJson("/api/projects/{$this->projectId}/diagrams/{$id}", [
            'name' => 'Solo el nombre',
            'task_id' => null,
        ])->assertOk()->assertJsonPath('data.name', 'Solo el nombre');

        $stored = Diagram::findOrFail($id)->data;
        $this->assertCount(3, $stored['nodes']);
        $this->assertSame('decision', $stored['nodes'][1]['data']['shape']);
    }

    public function test_rechaza_un_diagrama_sin_dibujo(): void
    {
        $this->postJson("/api/projects/{$this->projectId}/diagrams", ['name' => 'Sin data'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('data');
    }

    public function test_el_diagrama_queda_acotado_al_proyecto(): void
    {
        $id = $this->postJson("/api/projects/{$this->projectId}/diagrams", $this->payload())->json('data.id');

        $otro = Project::create([
            'name' => 'Otro proyecto',
            'user_id' => User::factory()->create()->id,
            'budget' => 0,
        ]);

        $this->getJson("/api/projects/{$otro->id}/diagrams/{$id}")->assertNotFound();
        $this->deleteJson("/api/projects/{$otro->id}/diagrams/{$id}")->assertNotFound();
    }
}
