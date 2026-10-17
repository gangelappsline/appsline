/* eslint-disable react/prop-types */
import { useState } from "react";
import { FiAlertTriangle, FiDownload, FiX } from "react-icons/fi";
import Modal from "../Modal";
import { cx } from "../../../utils/format";

/**
 * Aviso de integridad del contenido.
 *
 * Aparece cuando la API acepta el guardado (200) pero devuelve un registro
 * podado: el caso típico es un `$request->validated()` de Laravel con reglas por
 * campo (`data.nodes.*.data.label`, …). Desde Laravel 9 el validador descarta
 * toda clave de un arreglo que no tenga regla propia, así que `data.shape`,
 * `data.style`, `width`/`height` y el estilo de las flechas se pierden en el
 * servidor y, al reabrir el diagrama, cada nodo vuelve como «Proceso».
 *
 * El aviso dice qué faltó, qué se pudo restaurar con la copia de este navegador
 * y la corrección exacta del lado de la API.
 */
const IntegrityNotice = ({ report, onExportJson, onClose, className = "" }) => {
  const [open, setOpen] = useState(false);
  if (!report || report.ok !== false) return null;
  const restored = Number(report.restored) > 0;

  return (
    <>
      <div
        role="status"
        className={cx(
          "flex items-start gap-2 border-b px-3 py-2 text-[12px] leading-5",
          restored ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800",
          className,
        )}
      >
        <FiAlertTriangle className="mt-0.5 shrink-0" />
        <p className="min-w-0 flex-1">
          <b className="font-semibold">{report.message}</b>{" "}
          <span className={restored ? "text-amber-700" : "text-red-700"}>{report.detail}</span>
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cx(
            "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition",
            restored ? "border-amber-300 text-amber-800 hover:bg-amber-100" : "border-red-300 text-red-700 hover:bg-red-100",
          )}
        >
          Ver detalle
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Ocultar aviso"
            className={cx("shrink-0 rounded-md p-1 transition", restored ? "text-amber-500 hover:bg-amber-100" : "text-red-400 hover:bg-red-100")}
          >
            <FiX />
          </button>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Contenido que la API no conserva"
        subtitle={report.stage === "save" ? "Detectado al guardar" : "Detectado al abrir el diagrama"}
        size="xl"
        footer={
          <>
            {onExportJson && (
              <button type="button" onClick={onExportJson} className="btn-secondary !px-3 !py-1.5 text-sm">
                <FiDownload /> Exportar JSON de respaldo
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="btn-primary !px-3 !py-1.5 text-sm">
              Entendido
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            El panel envió el diagrama completo y la API respondió sin <b>{report.summary}</b>. No es un problema del
            editor: ese contenido no llegó a guardarse (o no se devolvió) en el servidor.
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Campos ausentes en la respuesta</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {(report.missing || []).map((path) => (
                <li key={path} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                  {path}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">
              {report.nodes || 0} {report.nodes === 1 ? "nodo afectado" : "nodos afectados"}
              {report.edges ? ` · ${report.edges} ${report.edges === 1 ? "conexión afectada" : "conexiones afectadas"}` : ""}
              {restored ? ` · ${report.restored} elementos completados desde la copia de este navegador` : ""}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Corrección en la API (Laravel)</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-600">
              El dibujo debe guardarse <b>tal cual</b>. En cuanto existe una regla anidada (<code>data.nodes.*.…</code>),
              <code> validated()</code> poda el arreglo <code>data</code> y descarta todo lo que no tenga regla propia.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-5 text-slate-100">
{`// app/Http/Requests/StoreDiagramRequest.php
public function rules(): array
{
    return [
        'name'        => ['required', 'string', 'max:160'],
        'description' => ['nullable', 'string', 'max:5000'],
        'task_id'     => ['nullable', 'integer'],
        // Una sola regla para el dibujo: SIN data.nodes.* ni data.edges.*
        'data'        => ['required', 'array'],
    ];
}

// Controlador: guardar el bloque completo, no el subconjunto validado
$diagram->update([
    ...$request->safe()->only(['name', 'description', 'task_id']),
    'data' => $request->input('data'),
]);`}
            </pre>
            <p className="mt-2 text-[11px] text-slate-500">
              Contrato completo, archivos listos para copiar y verificación con <code>curl</code>:{" "}
              <code>docs/API-DIAGRAMS.md</code> (sección 4) y <code>docs/backend-diagrams/</code>.
            </p>
          </div>

          {restored && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Mientras la API no se corrija, este navegador completa el diagrama con la última copia que envió, así que
              aquí se ve bien. En otro equipo o navegador sí se verá degradado: exporta el JSON como respaldo.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
};

export default IntegrityNotice;
