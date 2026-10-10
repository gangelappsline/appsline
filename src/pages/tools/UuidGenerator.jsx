import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "react-icons/fi";
import ToolPage from "../../components/tools/ToolPage";
import { Button, CopyButton, Field, Panel } from "../../components/tools/ToolUI";

const uuidV4 = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> 0;
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });

/** ULID-like: timestamp en base32 + aleatoriedad criptográfica. */
const ulid = () => {
  const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let time = Date.now();
  let timePart = "";
  for (let i = 0; i < 10; i += 1) {
    timePart = ENCODING[time % 32] + timePart;
    time = Math.floor(time / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const randomPart = [...bytes]
    .map((byte) => ENCODING[byte % 32])
    .join("")
    .slice(0, 16);
  return timePart + randomPart;
};

const nanoId = (size = 21) => {
  const alphabet = "useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict";
  return [...crypto.getRandomValues(new Uint8Array(size))]
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
};

const UuidGenerator = () => {
  const { t } = useTranslation();
  const [type, setType] = useState("v4");
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [braces, setBraces] = useState(false);
  const [list, setList] = useState([]);

  const generate = useCallback(() => {
    const factory = { v4: uuidV4, ulid, nano: nanoId }[type];
    const output = Array.from({ length: Number(count) }, () => {
      let value = factory();
      if (uppercase) value = value.toUpperCase();
      if (braces) value = `{${value}}`;
      return value;
    });
    setList(output);
  }, [type, count, uppercase, braces]);

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <ToolPage slug="generador-de-uuid">
      <div className="space-y-6">
        <Panel title={t("tools.uuid.optionsTitle")}>
          <div className="mb-6 flex flex-wrap gap-2">
            {["v4", "ulid", "nano"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setType(item)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  type === item
                    ? "border-[#0060FC] bg-[#0060FC]/15 text-white"
                    : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
                }`}
              >
                {t(`tools.uuid.types.${item}`)}
              </button>
            ))}
          </div>

          <Field label={`${t("tools.uuid.quantity")}: ${count}`}>
            <input
              type="range"
              min="1"
              max="50"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="mt-3 w-full accent-[#0060FC]"
            />
          </Field>

          <div className="mt-5 flex flex-wrap gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={uppercase}
                onChange={(e) => setUppercase(e.target.checked)}
                className="h-4 w-4 accent-[#0060FC]"
              />
              {t("tools.uuid.uppercase")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={braces}
                onChange={(e) => setBraces(e.target.checked)}
                className="h-4 w-4 accent-[#0060FC]"
              />
              {t("tools.uuid.braces")}
            </label>
          </div>

          <Button className="mt-6" onClick={generate}>
            <FiRefreshCw /> {t("tools.uuid.action")}
          </Button>
        </Panel>

        {list.length > 0 && (
          <Panel title={t("tools.ui.result")}>
            <ul className="space-y-2">
              {list.map((value, index) => (
                <li
                  key={`${value}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0d1017] px-4 py-3"
                >
                  <code className="break-all font-mono text-sm text-slate-200">{value}</code>
                  <CopyButton value={value} />
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <CopyButton value={list.join("\n")} />
            </div>
          </Panel>
        )}
      </div>
    </ToolPage>
  );
};

export default UuidGenerator;
