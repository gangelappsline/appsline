import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiFileText, FiMic, FiSquare } from "react-icons/fi";
import ToolPage from "../../components/tools/ToolPage";
import {
  Alert,
  Button,
  CopyButton,
  Dropzone,
  Field,
  Panel,
  downloadBlob,
  inputClass,
  textAreaClass,
} from "../../components/tools/ToolUI";

const LANGS = [
  ["es-MX", "Español (México)"],
  ["es-ES", "Español (España)"],
  ["en-US", "English (US)"],
  ["en-GB", "English (UK)"],
  ["pt-BR", "Português (Brasil)"],
  ["fr-FR", "Français"],
  ["de-DE", "Deutsch"],
  ["it-IT", "Italiano"],
];

const getRecognition = () =>
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const AudioToText = () => {
  const { t } = useTranslation();
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState("es-MX");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const recognitionRef = useRef(null);
  const keepAliveRef = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getRecognition()));
    return () => {
      keepAliveRef.current = false;
      recognitionRef.current?.stop?.();
    };
  }, []);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const start = () => {
    const Recognition = getRecognition();
    if (!Recognition) return;
    setError("");

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          setTranscript((prev) => `${prev}${prev ? " " : ""}${result[0].transcript.trim()}`);
        } else {
          pending += result[0].transcript;
        }
      }
      setInterim(pending);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      setError(t(`tools.audioToText.errors.${event.error}`, { defaultValue: event.error }));
      keepAliveRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      if (keepAliveRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* ignorado: el navegador ya reinició el reconocimiento */
        }
      }
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    keepAliveRef.current = true;
    recognition.start();
    setListening(true);
  };

  const stop = () => {
    keepAliveRef.current = false;
    recognitionRef.current?.stop?.();
    setListening(false);
  };

  return (
    <ToolPage slug="audio-a-texto">
      <div className="space-y-6">
        {!supported && <Alert tone="warning">{t("tools.audioToText.unsupported")}</Alert>}

        <Panel title={t("tools.audioToText.liveTitle")} hint={t("tools.audioToText.liveHint")}>
          <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label={t("tools.audioToText.language")}>
              <select
                className={inputClass}
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                disabled={listening}
              >
                {LANGS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex gap-3">
              {listening ? (
                <Button variant="ghost" onClick={stop}>
                  <FiSquare /> {t("tools.audioToText.stop")}
                </Button>
              ) : (
                <Button onClick={start} disabled={!supported}>
                  <FiMic /> {t("tools.audioToText.start")}
                </Button>
              )}
            </div>
          </div>

          {listening && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-red-500/10 px-4 py-1.5 text-sm text-red-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              {t("tools.audioToText.listening")}
            </p>
          )}
        </Panel>

        <Panel title={t("tools.audioToText.fileTitle")} hint={t("tools.audioToText.fileHint")}>
          <Dropzone
            accept="audio/*,video/*"
            files={file ? [file] : []}
            onFiles={(files) => setFile(files[0])}
            onClear={() => setFile(null)}
            label={t("tools.audioToText.drop")}
            hint="MP3 · WAV · M4A · OGG · WEBM"
          />
          {audioUrl && (
            <audio controls src={audioUrl} className="mt-5 w-full">
              <track kind="captions" />
            </audio>
          )}
          <div className="mt-5">
            <Alert tone="info">{t("tools.audioToText.fileNote")}</Alert>
          </div>
        </Panel>

        <Panel title={t("tools.audioToText.transcriptTitle")}>
          <textarea
            className={`${textAreaClass} min-h-[260px]`}
            value={transcript + (interim ? ` ${interim}` : "")}
            onChange={(e) => {
              setTranscript(e.target.value);
              setInterim("");
            }}
            placeholder={t("tools.audioToText.transcriptPlaceholder")}
          />
          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <CopyButton value={transcript} />
            <Button
              variant="ghost"
              onClick={() =>
                downloadBlob(
                  new Blob([transcript], { type: "text/plain;charset=utf-8" }),
                  "transcripcion.txt",
                )
              }
              disabled={!transcript}
            >
              <FiFileText /> .txt
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setTranscript("");
                setInterim("");
              }}
              disabled={!transcript}
            >
              {t("tools.ui.clear")}
            </Button>
          </div>
        </Panel>
      </div>
    </ToolPage>
  );
};

export default AudioToText;
