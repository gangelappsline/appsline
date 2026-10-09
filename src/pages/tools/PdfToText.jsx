import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiFileText } from "react-icons/fi";
import ToolPage from "../../components/tools/ToolPage";
import {
  Alert,
  Button,
  CopyButton,
  Dropzone,
  Panel,
  downloadBlob,
  textAreaClass,
} from "../../components/tools/ToolUI";
import { extractPdfPages, pagesToPlainText } from "../../tools/pdf";
import { wordCount } from "../../tools/summarize";

const PdfToText = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [separator, setSeparator] = useState(true);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setText("");
    try {
      const { pages } = await extractPdfPages(file, setProgress);
      const output = separator
        ? pages
            .map((paragraphs, index) => `--- ${t("tools.pdfToText.page")} ${index + 1} ---\n${paragraphs.join("\n")}`)
            .join("\n\n")
        : pagesToPlainText(pages);
      if (!output.trim()) setError(t("tools.pdfToText.noText"));
      setText(output);
    } catch (err) {
      setError(err?.message || t("tools.ui.genericError"));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <ToolPage slug="extraer-texto-de-pdf">
      <div className="space-y-6">
        <Panel title={t("tools.pdfToText.uploadTitle")}>
          <Dropzone
            accept="application/pdf,.pdf"
            files={file ? [file] : []}
            onFiles={(files) => setFile(files[0])}
            onClear={() => {
              setFile(null);
              setText("");
            }}
            label={t("tools.pdfToText.drop")}
            hint="PDF"
          />
          <label className="mt-6 flex cursor-pointer items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={separator}
              onChange={(e) => setSeparator(e.target.checked)}
              className="h-4 w-4 accent-[#0060FC]"
            />
            {t("tools.pdfToText.separator")}
          </label>
          <div className="mt-6">
            <Button onClick={run} disabled={!file || busy}>
              {busy ? `${t("tools.ui.processing")} ${progress}%` : t("tools.pdfToText.action")}
            </Button>
          </div>
        </Panel>

        {error && <Alert>{error}</Alert>}

        {text && (
          <Panel
            title={t("tools.ui.result")}
            hint={t("tools.pdfToText.stats", {
              words: wordCount(text).toLocaleString(),
              chars: text.length.toLocaleString(),
            })}
          >
            <textarea readOnly className={`${textAreaClass} min-h-[380px]`} value={text} />
            <div className="mt-5 flex flex-wrap gap-3">
              <CopyButton value={text} />
              <Button
                variant="ghost"
                onClick={() =>
                  downloadBlob(
                    new Blob([text], { type: "text/plain;charset=utf-8" }),
                    `${file.name.replace(/\.pdf$/i, "")}.txt`,
                  )
                }
              >
                <FiFileText /> .txt
              </Button>
            </div>
          </Panel>
        )}
      </div>
    </ToolPage>
  );
};

export default PdfToText;
