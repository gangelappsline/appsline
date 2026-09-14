import { useTranslation } from "react-i18next";

const LanguageSelector = () => {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("en") ? "en" : "es";
  return (
    <div className="flex rounded-full border border-white/15 bg-white/5 p-1 text-xs font-bold" aria-label="Language selector">
      {["es", "en"].map((code) => (
        <button key={code} onClick={() => i18n.changeLanguage(code)} className={`rounded-full px-2.5 py-1.5 transition ${language === code ? "bg-white text-[#0a0c12]" : "text-slate-400 hover:text-white"}`} aria-pressed={language === code}>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
export default LanguageSelector;
