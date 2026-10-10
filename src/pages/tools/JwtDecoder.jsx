import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ToolPage from "../../components/tools/ToolPage";
import {
  Alert,
  CopyButton,
  Panel,
  textAreaClass,
} from "../../components/tools/ToolUI";

const decodeSegment = (segment) => {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const json = new TextDecoder().decode(
    Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)),
  );
  return JSON.parse(json);
};

const JwtDecoder = () => {
  const { t } = useTranslation();
  const [token, setToken] = useState("");

  const decoded = useMemo(() => {
    const value = token.trim();
    if (!value) return null;
    const parts = value.split(".");
    if (parts.length < 2) return { error: t("tools.jwt.invalid") };
    try {
      return {
        header: decodeSegment(parts[0]),
        payload: decodeSegment(parts[1]),
        signature: parts[2] || "",
      };
    } catch {
      return { error: t("tools.jwt.invalid") };
    }
  }, [token, t]);

  const payload = decoded?.payload;
  const exp = payload?.exp ? new Date(payload.exp * 1000) : null;
  const iat = payload?.iat ? new Date(payload.iat * 1000) : null;
  const expired = exp ? exp.getTime() < Date.now() : null;

  return (
    <ToolPage slug="decodificador-jwt">
      <div className="space-y-6">
        <Panel title={t("tools.jwt.inputTitle")} hint={t("tools.jwt.inputHint")}>
          <textarea
            className={`${textAreaClass} min-h-[150px]`}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            spellCheck={false}
          />
        </Panel>

        {decoded?.error && <Alert>{decoded.error}</Alert>}

        {decoded && !decoded.error && (
          <>
            {exp && (
              <Alert tone={expired ? "error" : "success"}>
                {expired
                  ? t("tools.jwt.expired", { date: exp.toLocaleString() })
                  : t("tools.jwt.validUntil", { date: exp.toLocaleString() })}
              </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              {["header", "payload"].map((section) => (
                <Panel key={section} title={t(`tools.jwt.${section}`)}>
                  <pre className="max-h-96 overflow-auto rounded-xl bg-[#0d1017] p-4 font-mono text-sm leading-6 text-slate-300">
                    {JSON.stringify(decoded[section], null, 2)}
                  </pre>
                  <div className="mt-4">
                    <CopyButton value={JSON.stringify(decoded[section], null, 2)} />
                  </div>
                </Panel>
              ))}
            </div>

            <Panel title={t("tools.jwt.claims")}>
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ["iss", payload?.iss],
                  ["sub", payload?.sub],
                  ["aud", Array.isArray(payload?.aud) ? payload.aud.join(", ") : payload?.aud],
                  ["iat", iat?.toLocaleString()],
                  ["exp", exp?.toLocaleString()],
                  ["alg", decoded.header?.alg],
                ].map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-white/10 bg-[#0d1017] px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
                    <dd className="mt-1 break-all text-sm text-slate-200">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Alert tone="warning">{t("tools.jwt.note")}</Alert>
          </>
        )}
      </div>
    </ToolPage>
  );
};

export default JwtDecoder;
