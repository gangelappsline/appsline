/* eslint-disable react/prop-types */
import { FiAlertTriangle } from "react-icons/fi";
import Modal from "./Modal";
import Button from "./Button";

/**
 * Diálogo de confirmación (reemplazo elegante de window.confirm).
 * @example
 * <ConfirmDialog open={!!target} title="Eliminar usuario"
 *   message="Esta acción no se puede deshacer."
 *   onCancel={...} onConfirm={...} loading={deleting} />
 */
const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = "¿Estás seguro?",
  message = "Esta acción no se puede deshacer.",
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  loading = false,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    size="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-xl text-red-500">
        <FiAlertTriangle />
      </span>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{message}</p>
      </div>
    </div>
  </Modal>
);

export default ConfirmDialog;
