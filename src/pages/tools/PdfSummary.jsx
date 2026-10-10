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
import { keywords, readingTime, summarize, wordCount } from "../../tools/summarize";

const LEVELS = [
  { id: "short", ratio: 0.12 },
  { id: "medium", ratio: 0.25 },
  { id: "long", ratio: 0.4 },
];

const PdfSummary = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState("pdf");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [level, setLevel] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      let source = text;
      let pagesCount = 0;

      if (mode === "pdf") {
        if (!file) return;
        const { pages, numPages } = await extractPdfPages(file, setProgress);
        source = pagesToPlainText(pages);
        pagesCount = numPages;
      }

      if (!source.trim()) {
        setError(t("tools.pdfSummary.noText"));
        return;
      }

      const ratio = LEVELS.find((item) => item.id === level).ratio;
      const sentences = summarize(source, ratio);
      setResult({
        source,
        sentences,
        pagesCount,
        words: wordCount(source),
        summaryWords: wordCount(sentences.join(" ")),
        minutes: readingTime(source),
        terms: keywords(source, 12),
      });
    } catch (err) {
      setError(err?.message || t("tools.ui.genericError"));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const summaryText = result ? result.sentences.map((item) => `• ${item}`).join("\n\n") : "";

  return (
    <ToolPage slug="resumen-de-pdf">
      <div className="space-y-6">
        <Panel title={t("tools.pdfSummary.sourceTitle")}>
          <div className="mb-6 flex flex-wrap gap-2">
            {["pdf", "text"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  mode === item
                    ? "border-[#0060FC] bg-[#0060FC]/15 text-white"
                    : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
                }`}
              >
                {t(`tools.pdfSummary.modes.${item}`)}
              </button>
            ))}
          </div>

          {mode === "pdf" ? (
            <Dropzone
              accept="application/pdf,.pdf"
              files={file ? [file] : []}
              onFiles={(files) => setFile(files[0])}
              onClear={() => setFile(null)}
              label={t("tools.pdfSummary.drop")}
              hint="PDF"
            />
          ) : (
            <textarea
              className={textAreaClass}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("tools.pdfSummary.textPlaceholder")}
            />
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-400">{t("tools.pdfSummary.length")}</span>
            {LEVELS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLevel(item.id)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  level === item.id
                    ? "border-[#0060FC] bg-[#0060FC]/15 text-white"
                    : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
                }`}
              >
                {t(`tools.pdfSummary.levels.${item.id}`)}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <Button onClick={run} disabled={busy || (mode === "pdf" ? !file : !text.trim())}>
              {busy ? `${t("tools.ui.processing")} ${progress}%` : t("tools.pdfSummary.action")}
            </Button>
          </div>
        </Panel>

        {error && <Alert>{error}</Alert>}

        {result && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                [t("tools.pdfSummary.stats.pages"), result.pagesCount || "—"],
                [t("tools.pdfSummary.stats.words"), result.words.toLocaleString()],
                [t("tools.pdfSummary.stats.summaryWords"), result.summaryWords.toLocaleString()],
                [t("tools.pdfSummary.stats.minutes"), `${result.minutes} min`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[.025] px-5 py-4"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            <Panel title={t("tools.pdfSummary.resultTitle")}>
              <ul className="space-y-4">
                {result.sentences.map((sentence, index) => (
                  <li key={index} className="flex gap-3 text-slate-300">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00A3FE]" />
                    <p className="leading-7">{sentence}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap gap-3">
                <CopyButton value={summaryText} />
                <Button
                  variant="ghost"
                  onClick={() =>
                    downloadBlob(
                      new Blob([summaryText], { type: "text/plain;charset=utf-8" }),
                      "resumen.txt",
                    )
                  }
                >
                  <FiFileText /> .txt
                </Button>
              </div>
            </Panel>

            <Panel title={t("tools.pdfSummary.keywords")}>
              <div className="flex flex-wrap gap-2">
                {result.terms.map(({ word, count }) => (
                  <span
                    key={word}
                    className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-sm text-slate-300"
                  >
                    {word} <span className="text-xs text-slate-500">×{count}</span>
                  </span>
                ))}
              </div>
            </Panel>
          </>
        )}

        <Alert tone="info">{t("tools.pdfSummary.note")}</Alert>
      </div>
    </ToolPage>
  );
};

export default PdfSummary;
