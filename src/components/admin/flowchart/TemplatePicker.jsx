/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import { FiPlus } from "react-icons/fi";
import Modal from "../Modal";
import Button from "../Button";
import Field from "../Field";
import DiagramThumbnail from "./DiagramThumbnail";
import { TEMPLATES, createDiagram } from "../../../utils/diagrams";
import { cx } from "../../../utils/format";

/**
 * Diálogo para crear un diagrama: nombre, a qué se vincula (proyecto o tarea)
 * y plantilla inicial. Devuelve `{ name, taskId, template }` en `onCreate`.
 */
const TemplatePicker = ({ open, onClose, onCreate, tasks = [], defaultTaskId = null, creating = false }) => {
  const [name, setName] = useState("");
  const [taskId, setTaskId] = useState(defaultTaskId ?? "");
  const [template, setTemplate] = useState("basic");

  const previews = useMemo(
    () => Object.fromEntries(TEMPLATES.map((t) => [t.key, createDiagram({ template: t.key })])),
    [],
  );

  const submit = (e) => {
    e?.preventDefault();
    const tpl = TEMPLATES.find((t) => t.key === template) || TEMPLATES[0];
    onCreate?.({
      name: name.trim() || (tpl.key === "blank" ? "Nuevo diagrama" : tpl.label),
      taskId: taskId === "" ? null : taskId,
      template,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title="Nuevo diagrama de flujo"
      subtitle="Elige una plantilla para empezar; después podrás cambiar todo en el editor."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={creating}>
            Cancelar
          </Button>
          <Button loading={creating} onClick={submit}>
            <FiPlus /> Crear y abrir el editor
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Flujo de aprobación"
              className="admin-input"
            />
          </Field>
          <Field label="Vincular a" hint="Un diagrama del proyecto se ve en la pestaña Diagramas; el de una tarea, además, en su detalle.">
            <select value={taskId ?? ""} onChange={(e) => setTaskId(e.target.value)} className="admin-input">
              <option value="">Proyecto (general)</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  Tarea #{t.id} · {t.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <p className="admin-label">Plantilla</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => setTemplate(tpl.key)}
                aria-pressed={template === tpl.key}
                className={cx(
                  "overflow-hidden rounded-xl border text-left transition",
                  template === tpl.key
                    ? "border-brand-500 ring-4 ring-brand-500/15"
                    : "border-slate-200 hover:border-brand-300",
                )}
              >
                <DiagramThumbnail diagram={previews[tpl.key]} height={110} />
                <div className="border-t border-slate-100 p-2.5">
                  <p className="text-[13px] font-semibold text-slate-800">{tpl.label}</p>
                  <p className="text-[11px] leading-4 text-slate-400">{tpl.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default TemplatePicker;
