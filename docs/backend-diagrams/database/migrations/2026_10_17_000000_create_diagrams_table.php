<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Diagramas de flujo del panel (proyecto y, opcionalmente, tarea).
 *
 * `data` guarda el dibujo completo: nodos con su forma y estilo, conexiones,
 * vista y ajustes. Es un bloque opaco para la API —no se consulta ni se filtra
 * por su contenido—, así que va en JSON tal cual lo envía el panel.
 *
 * Ver docs/API-DIAGRAMS.md (secciones 2, 3 y 4).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('diagrams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            // Si la tabla de tareas se llama distinto, ajusta el constrained().
            $table->foreignId('task_id')->nullable()->constrained('project_tasks')->nullOnDelete();
            $table->string('name', 160);
            $table->text('description')->nullable();
            // MySQL < 5.7 / MariaDB sin tipo JSON: cambia a longText().
            $table->json('data');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['project_id', 'task_id']);
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('diagrams');
    }
};
