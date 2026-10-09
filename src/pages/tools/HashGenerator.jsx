import { useState } from "react";
import { useTranslation } from "react-i18next";
import ToolPage from "../../components/tools/ToolPage";
import {
  Alert,
  Button,
  CopyButton,
  Dropzone,
  Panel,
  textAreaClass,
} from "../../components/tools/ToolUI";

const ALGOS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

const toHex = (buffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const HashGenerator = () => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [hashes, setHashes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");

  const digestAll = async (data, sourceLabel) => {
    setBusy(true);
    setError("");
    try {
      const entries = await Promise.all(
        ALGOS.map(async (algo) => [algo, toHex(await crypto.subtle.digest(algo, data))]),
      );
      setHashes(Object.fromEntries(entries));
      setLabel(sourceLabel);
    } catch (err) {
      setError(err?.message || t("tools.ui.genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolPage slug="generador-de-hash">
      <div className="space-y-6">
        <Panel title={t("tools.hash.inputTitle")}>
          <textarea
            className={textAreaClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("tools.hash.placeholder")}
            spellCheck={false}
          />
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              onClick={() => digestAll(new TextEncoder().encode(text), t("tools.hash.fromText"))}
              disabled={!text || busy}
            >
              {t("tools.hash.action")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setText("");
                setHashes(null);
              }}
            >
              {t("tools.ui.clear")}
            </Button>
          </div>
        </Panel>

        <Panel title={t("tools.hash.fileTitle")} hint={t("tools.hash.fileHint")}>
          <Dropzone
            onFiles={async (files) => {
              const file = files[0];
              digestAll(await file.arrayBuffer(), file.name);
            }}
            label={t("tools.hash.fileDrop")}
          />
        </Panel>

        {error && <Alert>{error}</Alert>}

        {hashes && (
          <Panel title={t("tools.ui.result")} hint={label}>
            <div className="space-y-4">
              {ALGOS.map((algo) => (
                <div key={algo} className="rounded-2xl border border-white/10 bg-[#0d1017] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#00A3FE]">{algo}</span>
                    <CopyButton value={hashes[algo]} />
                  </div>
                  <p className="mt-3 break-all font-mono text-sm text-slate-300">{hashes[algo]}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </ToolPage>
  );
};

export default HashGenerator;
