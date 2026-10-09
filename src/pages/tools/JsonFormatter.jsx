import { useState } from "react";
import { useTranslation } from "react-i18next";
import ToolPage from "../../components/tools/ToolPage";
import {
  Alert,
  Button,
  CopyButton,
  Panel,
  downloadBlob,
  textAreaClass,
} from "../../components/tools/ToolUI";

const sortValue = (value) => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: sortValue(value[key]) }), {});
  }
  return value;
};

const JsonFormatter = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [indent, setIndent] = useState(2);
  const [sortKeys, setSortKeys] = useState(false);

  const parse = () => {
    try {
      const parsed = JSON.parse(input);
      setError("");
      return sortKeys ? sortValue(parsed) : parsed;
    } catch (err) {
      setError(err.message);
      setOutput("");
      return undefined;
    }
  };

  const format = () => {
    const parsed = parse();
    if (parsed === undefined) return;
    setOutput(JSON.stringify(parsed, null, Number(indent)));
  };

  const minify = () => {
    const parsed = parse();
    if (parsed === undefined) return;
    setOutput(JSON.stringify(parsed));
  };

  const validate = () => {
    const parsed = parse();
    if (parsed === undefined) return;
    setOutput(
      `${t("tools.json.valid")}\n\n${t("tools.json.type")}: ${
        Array.isArray(parsed) ? "array" : typeof parsed
      }\n${t("tools.json.keys")}: ${
        parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0
      }\n${t("tools.json.size")}: ${new Blob([input]).size} bytes`,
    );
  };

  return (
    <ToolPage slug="formateador-json">
      <div className="space-y-6">
        <Panel title={t("tools.json.inputTitle")}>
          <textarea
            className={textAreaClass}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"appsline": {"stack": ["React", "Laravel"], "activo": true}}'
            spellCheck={false}
          />

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              {t("tools.json.indent")}
              <select
                className="rounded-lg border border-white/10 bg-[#0d1017] px-3 py-1.5 text-sm text-white"
                value={indent}
                onChange={(e) => setIndent(e.target.value)}
              >
                <option value="2">2</option>
                <option value="4">4</option>
                <option value="8">8</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={sortKeys}
                onChange={(e) => setSortKeys(e.target.checked)}
                className="h-4 w-4 accent-[#0060FC]"
              />
              {t("tools.json.sortKeys")}
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={format} disabled={!input.trim()}>
              {t("tools.json.format")}
            </Button>
            <Button variant="ghost" onClick={minify} disabled={!input.trim()}>
              {t("tools.json.minify")}
            </Button>
            <Button variant="ghost" onClick={validate} disabled={!input.trim()}>
              {t("tools.json.validate")}
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

        {error && <Alert>{`JSON inválido — ${error}`}</Alert>}

        {output && (
          <Panel title={t("tools.ui.result")}>
            <textarea readOnly className={`${textAreaClass} min-h-[300px]`} value={output} />
            <div className="mt-5 flex flex-wrap gap-3">
              <CopyButton value={output} />
              <Button
                variant="ghost"
                onClick={() =>
                  downloadBlob(new Blob([output], { type: "application/json" }), "datos.json")
                }
              >
                .json
              </Button>
            </div>
          </Panel>
        )}
      </div>
    </ToolPage>
  );
};

export default JsonFormatter;
