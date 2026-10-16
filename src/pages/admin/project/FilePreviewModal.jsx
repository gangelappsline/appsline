/* eslint-disable react/prop-types */
/**
 * Modal de previsualización de un archivo (imagen, PDF, DOCX, XLSX, PPTX,
 * CSV o texto). Lo comparten el explorador de archivos del proyecto
 * (`FilesTab`) y el detalle de tarea (`Project.jsx`), para que los adjuntos
 * se vean igual en los dos sitios.
 */
import { FiCopy, FiDownload } from "react-icons/fi";
import { Button, Modal } from "../../../components/admin";
import { formatBytes } from "../../../utils/files";
import { formatDateTime } from "../../../utils/format";
import FilePreview from "./FilePreview";

const FilePreviewModal = ({ file, onClose, onCopy }) => (
  <Modal
    open={Boolean(file)}
    onClose={onClose}
    size="2xl"
    title={file?.name}
    subtitle={
      file
        ? [
            file.kindLabel,
            file.size ? formatBytes(file.size) : null,
            file.task?.title || "Archivo del proyecto",
            file.createdAt ? formatDateTime(file.createdAt) : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : ""
    }
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
        {file?.url && (
          <>
            {onCopy && (
              <Button variant="secondary" onClick={() => onCopy(file)}>
                <FiCopy /> Copiar enlace
              </Button>
            )}
            <a href={file.url} target="_blank" rel="noreferrer" className="btn-secondary text-brand-700">
              <FiDownload /> Abrir original
            </a>
          </>
        )}
      </>
    }
  >
    {file && <FilePreview key={file.key || file.url || file.name} file={file} />}
  </Modal>
);

export default FilePreviewModal;
