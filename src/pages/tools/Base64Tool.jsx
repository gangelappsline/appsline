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

const encode = (text) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)));

const decode = (base64) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(base64.replace(/\s+/g, "")), (char) => char.charCodeAt(0)),
  );

const Base64Tool = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState("encode");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);

  const run = () => {
    setError("");
    try {
      if (mode === "encode") {
        let result = encode(input);
        if (urlSafe) result = result.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        setOutput(result);
      } else {
        const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
        setOutput(decode(normalized));
      }
    } catch {
      setOutput("");
      setError(t("tools.base64.error"));
    }
  };

  const fileToDataUrl = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setMode("encode");
      setOutput(String(reader.result));
      setInput(`${file.name} (${file.type || "binario"})`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <ToolPage slug="base64">
      <div className="space-y-6">
        <Panel title={t("tools.base64.inputTitle")}>
          <div className="mb-5 flex flex-wrap gap-2">
            {["encode", "decode"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setOutput("");
                  setError("");
                }}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  mode === item
                    ? "border-[#0060FC] bg-[#0060FC]/15 text-white"
                    : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
                }`}
              >
                {t(`tools.base64.modes.${item}`)}
              </button>
            ))}
          </div>

          <textarea
            className={textAreaClass}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(`tools.base64.placeholders.${mode}`)}
            spellCheck={false}
          />

          {mode === "encode" && (
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={urlSafe}
                onChange={(e) => setUrlSafe(e.target.checked)}
                className="h-4 w-4 accent-[#0060FC]"
              />
              {t("tools.base64.urlSafe")}
            </label>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={run} disabled={!input.trim()}>
              {t(`tools.base64.modes.${mode}`)}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setInput("");
                setOutput("");
                setError("");
              }}
            >
              {t("tools.ui.clear")}
            </Button>
          </div>
        </Panel>

        <Panel title={t("tools.base64.fileTitle")} hint={t("tools.base64.fileHint")}>
          <Dropzone onFiles={(files) => fileToDataUrl(files[0])} label={t("tools.base64.fileDrop")} />
        </Panel>

        {error && <Alert>{error}</Alert>}

        {output && (
          <Panel title={t("tools.ui.result")}>
            <textarea readOnly className={textAreaClass} value={output} />
            <div className="mt-5">
              <CopyButton value={output} />
            </div>
          </Panel>
        )}
      </div>
    </ToolPage>
  );
};

export default Base64Tool;
