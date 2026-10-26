<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Comentarios de revisión de un diagrama / mockup (OPCIONAL).
 *
 * El panel ya guarda los comentarios dentro de `diagrams.data.comments`, así que
 * esta tabla solo es necesaria si quieres autor indexado, notificaciones,
 * historial o filtros en SQL (ver docs/API-MOCKUPS.md §5.1).
 *
 * `node_id` apunta a la pantalla del diagrama y `widget_id` al elemento concreto
 * dentro de esa pantalla; ambos son los IDs que ya viajan en `data.nodes`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('diagram_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('diagram_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            // Pantalla y elemento del mockup (null = comentario del diagrama).
            $table->string('node_id', 64)->nullable();
            $table->string('widget_id', 64)->nullable();
            $table->foreignId('parent_id')->nullable()->constrained('diagram_comments')->cascadeOnDelete();
            $table->text('body');
            $table->boolean('resolved')->default(false);
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['diagram_id', 'node_id']);
            $table->index(['diagram_id', 'resolved']);
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('diagram_comments');
    }
};
