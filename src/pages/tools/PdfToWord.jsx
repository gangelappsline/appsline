import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import ToolPage from "../../components/tools/ToolPage";
import {
  Alert,
  Button,
  Dropzone,
  Panel,
  downloadBlob,
} from "../../components/tools/ToolUI";
import { extractPdfPages } from "../../tools/pdf";

const PdfToWord = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [keepPageBreaks, setKeepPageBreaks] = useState(true);

  const reset = () => {
    setFile(null);
    setDone(null);
    setError("");
    setProgress(0);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setDone(null);
    try {
      const { pages, numPages } = await extractPdfPages(file, (value) => setProgress(value));
      const children = [];

      pages.forEach((paragraphs, index) => {
        if (keepPageBreaks && index > 0) {
          children.push(new Paragraph({ children: [], pageBreakBefore: true }));
        }
        if (!paragraphs.length) {
          children.push(new Paragraph({ children: [new TextRun("")] }));
          return;
        }
        paragraphs.forEach((text, position) => {
          const isHeading = index === 0 && position === 0 && text.length < 90;
          children.push(
            new Paragraph({
              heading: isHeading ? HeadingLevel.HEADING_1 : undefined,
              spacing: { after: 160 },
              children: [new TextRun({ text, size: isHeading ? 32 : 22 })],
            }),
          );
        });
      });

      const totalChars = pages.flat().join(" ").length;
      if (!totalChars) {
        setError(t("tools.pdfToWord.noText"));
        setBusy(false);
        return;
      }

      const doc = new Document({ sections: [{ properties: {}, children }] });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `${file.name.replace(/\.pdf$/i, "")}.docx`);
      setDone({ numPages, chars: totalChars });
    } catch (err) {
      setError(err?.message || t("tools.ui.genericError"));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <ToolPage slug="pdf-a-word">
      <div className="space-y-6">
        <Panel title={t("tools.pdfToWord.uploadTitle")} hint={t("tools.pdfToWord.uploadHint")}>
          <Dropzone
            accept="application/pdf,.pdf"
            files={file ? [file] : []}
            onFiles={(files) => {
              setFile(files[0]);
              setDone(null);
              setError("");
            }}
            onClear={reset}
            label={t("tools.pdfToWord.drop")}
            hint="PDF"
          />

          <label className="mt-6 flex cursor-pointer items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={keepPageBreaks}
              onChange={(e) => setKeepPageBreaks(e.target.checked)}
              className="h-4 w-4 accent-[#0060FC]"
            />
            {t("tools.pdfToWord.keepBreaks")}
          </label>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={convert} disabled={!file || busy}>
              {busy ? `${t("tools.ui.processing")} ${progress}%` : t("tools.pdfToWord.action")}
            </Button>
            {file && (
              <Button variant="ghost" onClick={reset} disabled={busy}>
                {t("tools.ui.clear")}
              </Button>
            )}
          </div>

          {busy && (
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#0060FC] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </Panel>

        {error && <Alert>{error}</Alert>}
        {done && (
          <Alert tone="success">
            {t("tools.pdfToWord.success", { pages: done.numPages, chars: done.chars })}
          </Alert>
        )}
        <Alert tone="info">{t("tools.pdfToWord.note")}</Alert>
      </div>
    </ToolPage>
  );
};

export default PdfToWord;
