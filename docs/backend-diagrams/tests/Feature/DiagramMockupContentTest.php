<?php

namespace Tests\Feature;

use App\Models\Diagram;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Passport\Passport;
use Tests\TestCase;

/**
 * Integridad del contenido de los mockups de pantallas.
 *
 * Guarda un diagrama con una pantalla de mockup (dispositivo, elementos,
 * conexión desde un botón y comentarios) y comprueba que la API lo devuelve
 * completo. Falla si alguien añade reglas `data.*` y guarda con
 * `$request->validated()['data']`, porque entonces desaparecen `widgets`,
 * `device` y `comments`.
 *
 * Ver docs/API-MOCKUPS.md §3 y docs/API-DIAGRAMS.md §4.
 */
class DiagramMockupContentTest extends TestCase
{
    use RefreshDatabase;

    private int $projectId;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::factory()->create();
        Passport::actingAs($user);

        $project = Project::create([
            'name' => 'App móvil',
            'description' => null,
            'user_id' => $user->id,
            'budget' => 0,
        ]);

        $this->projectId = $project->id;
    }

    /** Dibujo con dos pantallas, elementos y comentarios: lo que envía el panel. */
    private function payload(): array
    {
        return [
            'name' => 'Mockup de checkout',
            'description' => 'Pantallas conectadas',
            'task_id' => null,
            'data' => [
                'version' => 1,
                'nodes' => [
                    [
                        'id' => 'scr-login',
                        'type' => 'screen',
                        'position' => ['x' => 80, 'y' => 60],
                        'width' => 393,
                        'height' => 852,
                        'data' => [
                            'shape' => 'screen',
                            'label' => 'Inicio de sesión',
                            'device' => 'iphone-15-pro',
                            'background' => 'linear-gradient(160deg,#0b1220 0%,#1d4ed8 100%)',
                            'start' => true,
                            'statusBar' => true,
                            'style' => ['fill' => '#ffffff', 'stroke' => '#94a3b8'],
                            'widgets' => [
                                [
                                    'id' => 'w-email',
                                    'type' => 'input',
                                    'x' => 24, 'y' => 252, 'w' => 345, 'h' => 48,
                                    'text' => '',
                                    'style' => ['fill' => '#ffffff', 'borderWidth' => 1, 'radius' => 12],
                                    'props' => ['placeholder' => 'Correo electrónico'],
                                ],
                                [
                                    'id' => 'w-entrar',
                                    'type' => 'button',
                                    'x' => 24, 'y' => 392, 'w' => 345, 'h' => 50,
                                    'text' => 'Iniciar sesión',
                                    'style' => ['fill' => '#0060fc', 'textColor' => '#ffffff', 'radius' => 14],
                                ],
                            ],
                        ],
                    ],
                    [
                        'id' => 'scr-home',
                        'type' => 'screen',
                        'position' => ['x' => 620, 'y' => 60],
                        'width' => 393,
                        'height' => 852,
                        'data' => [
                            'shape' => 'screen',
                            'label' => 'Inicio',
                            'device' => 'pixel-8',
                            'widgets' => [
                                [
                                    'id' => 'w-list',
                                    'type' => 'list',
                                    'x' => 20, 'y' => 120, 'w' => 353, 'h' => 220,
                                    'text' => "Ana\nLuis",
                                    'style' => ['fill' => '#ffffff', 'radius' => 16],
                                ],
                            ],
                        ],
                    ],
                ],
                'edges' => [
                    [
                        'id' => 'e1',
                        'type' => 'flow',
                        'source' => 'scr-login',
                        'target' => 'scr-home',
                        'sourceHandle' => 'w:w-entrar',
                        'targetHandle' => 'left',
                        'data' => ['kind' => 'smoothstep', 'label' => 'Iniciar sesión'],
                    ],
                ],
                'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
                'settings' => ['background' => 'dots', 'gridSize' => 20],
                'comments' => [
                    [
                        'id' => 'c1',
                        'text' => 'Falta el estado vacío de la lista',
                        'author' => ['id' => 7, 'name' => 'Ana Pérez'],
                        'node_id' => 'scr-home',
                        'widget_id' => 'w-list',
                        'parent_id' => null,
                        'resolved' => false,
                        'created_at' => '2026-10-26T12:00:00.000Z',
                    ],
                ],
            ],
        ];
    }

    public function test_crear_un_mockup_conserva_pantallas_elementos_y_comentarios(): void
    {
        $response = $this->postJson("/api/projects/{$this->projectId}/diagrams", $this->payload());

        $response->assertStatus(200);
        $id = $response->json('data.id');
        $this->assertNotNull($id, 'El POST debe devolver el ID definitivo.');

        $diagram = Diagram::findOrFail($id);

        $this->assertSame('screen', $diagram->data['nodes'][0]['type']);
        $this->assertSame('screen', $diagram->data['nodes'][0]['data']['shape']);
        $this->assertSame('iphone-15-pro', $diagram->data['nodes'][0]['data']['device']);
        $this->assertSame('linear-gradient(160deg,#0b1220 0%,#1d4ed8 100%)', $diagram->data['nodes'][0]['data']['background']);
        $this->assertCount(2, $diagram->data['nodes'][0]['data']['widgets']);
        $this->assertSame('button', $diagram->data['nodes'][0]['data']['widgets'][1]['type']);
        $this->assertSame('#0060fc', $diagram->data['nodes'][0]['data']['widgets'][1]['style']['fill']);
        $this->assertSame('Correo electrónico', $diagram->data['nodes'][0]['data']['widgets'][0]['props']['placeholder']);
        $this->assertSame('w:w-entrar', $diagram->data['edges'][0]['sourceHandle']);
        $this->assertSame('Falta el estado vacío de la lista', $diagram->data['comments'][0]['text']);
        $this->assertSame('w-list', $diagram->data['comments'][0]['widget_id']);
    }

    public function test_actualizar_un_mockup_no_pierde_el_contenido(): void
    {
        $created = $this->postJson("/api/projects/{$this->projectId}/diagrams", $this->payload());
        $id = $created->json('data.id');

        $payload = $this->payload();
        // El lienzo mueve un elemento y resuelve el comentario.
        $payload['data']['nodes'][0]['data']['widgets'][1]['y'] = 420;
        $payload['data']['comments'][0]['resolved'] = true;

        $this->putJson("/api/projects/{$this->projectId}/diagrams/{$id}", $payload)->assertStatus(200);

        $diagram = Diagram::findOrFail($id)->fresh();
        $this->assertSame(420, $diagram->data['nodes'][0]['data']['widgets'][1]['y']);
        $this->assertTrue($diagram->data['comments'][0]['resolved']);
        $this->assertSame('w:w-entrar', $diagram->data['edges'][0]['sourceHandle']);
        $this->assertCount(2, $diagram->data['nodes']);
    }

    public function test_el_listado_devuelve_las_pantallas_para_la_miniatura(): void
    {
        $this->postJson("/api/projects/{$this->projectId}/diagrams", $this->payload());

        $response = $this->getJson("/api/projects/{$this->projectId}/diagrams");
        $response->assertStatus(200);

        $node = $response->json('data')[0]['data']['nodes'][0];
        $this->assertSame('screen', $node['type']);
        $this->assertSame('iphone-15-pro', $node['data']['device']);
        $this->assertSame(393, $node['width']);
    }
}
