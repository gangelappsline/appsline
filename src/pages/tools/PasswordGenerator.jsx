import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "react-icons/fi";
import ToolPage from "../../components/tools/ToolPage";
import { Button, CopyButton, Field, Panel } from "../../components/tools/ToolUI";

const SETS = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  numbers: "23456789",
  symbols: "!@#$%&*?-_=+.",
  ambiguous: "ilIO01o",
};

const randomInt = (max) => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
};

const strengthOf = (password, poolSize) => {
  const bits = password.length * Math.log2(poolSize || 1);
  if (bits < 40) return { level: 0, bits };
  if (bits < 60) return { level: 1, bits };
  if (bits < 90) return { level: 2, bits };
  return { level: 3, bits };
};

const PasswordGenerator = () => {
  const { t } = useTranslation();
  const [length, setLength] = useState(18);
  const [options, setOptions] = useState({
    lower: true,
    upper: true,
    numbers: true,
    symbols: true,
    ambiguous: false,
  });
  const [count, setCount] = useState(5);
  const [list, setList] = useState([]);

  const generate = useCallback(() => {
    let pool = Object.keys(SETS)
      .filter((key) => key !== "ambiguous" && options[key])
      .map((key) => SETS[key])
      .join("");
    if (options.ambiguous) pool += SETS.ambiguous;
    if (!pool) {
      setList([]);
      return;
    }
    const output = Array.from({ length: Number(count) }, () =>
      Array.from({ length: Number(length) }, () => pool[randomInt(pool.length)]).join(""),
    );
    setList(output.map((password) => ({ password, ...strengthOf(password, pool.length) })));
  }, [length, options, count]);

  useEffect(() => {
    generate();
  }, [generate]);

  const levels = [
    "bg-red-500",
    "bg-amber-500",
    "bg-[#00A3FE]",
    "bg-emerald-500",
  ];

  return (
    <ToolPage slug="generador-de-contrasenas">
      <div className="space-y-6">
        <Panel title={t("tools.password.optionsTitle")}>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={`${t("tools.password.length")}: ${length}`}>
              <input
                type="range"
                min="6"
                max="64"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="mt-3 w-full accent-[#0060FC]"
              />
            </Field>
            <Field label={`${t("tools.password.quantity")}: ${count}`}>
              <input
                type="range"
                min="1"
                max="20"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="mt-3 w-full accent-[#0060FC]"
              />
            </Field>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.keys(SETS).map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#0d1017] px-4 py-3 text-sm text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => setOptions((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="h-4 w-4 accent-[#0060FC]"
                />
                {t(`tools.password.sets.${key}`)}
              </label>
            ))}
          </div>

          <Button className="mt-6" onClick={generate}>
            <FiRefreshCw /> {t("tools.password.action")}
          </Button>
        </Panel>

        {list.length > 0 && (
          <Panel title={t("tools.ui.result")}>
            <div className="space-y-3">
              {list.map((item, index) => (
                <div
                  key={`${item.password}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0d1017] px-4 py-3"
                >
                  <code className="break-all font-mono text-sm text-white">{item.password}</code>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full ${levels[item.level]}`}
                          style={{ width: `${(item.level + 1) * 25}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{Math.round(item.bits)} bits</span>
                    </div>
                    <CopyButton value={item.password} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <CopyButton value={list.map((item) => item.password).join("\n")} />
            </div>
          </Panel>
        )}
      </div>
    </ToolPage>
  );
};

export default PasswordGenerator;
