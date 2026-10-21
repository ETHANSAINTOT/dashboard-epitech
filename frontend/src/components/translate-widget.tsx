import { useEffect, useRef, useState } from "react";
import { api, type WidgetInstance } from "../api";
import {
  errorStyle,
  translateBodyStyle,
  translateFieldStyle,
  translateLanguagesStyle,
  translateMetaStyle,
  translateResultStyle,
  translateSelectStyle,
  translateSwapStyle,
  translateTextareaStyle,
  widgetMessageStyle,
} from "../styles";
import WidgetFrame, { type WidgetComponentProps } from "./widget-frame";
import type { SettingsField } from "./widget-form";

// the languages the back accepts (LANGUAGES in backend/catalog/translate.py): same codes, or the add is refused (422)
const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" }, { value: "fr", label: "French" }, { value: "es", label: "Spanish" },
  { value: "zh-Hans", label: "Chinese" }, { value: "ar", label: "Arabic" }, { value: "pt", label: "Portuguese" },
  { value: "hi", label: "Hindi" }, { value: "ja", label: "Japanese" }, { value: "de", label: "German" },
  { value: "ru", label: "Russian" }, { value: "id", label: "Indonesian" },
];

// the add window's fields: the 2 languages, in lists. no refresh asked (hideRefresh in widget-types.ts)
export const TRANSLATE_FIELDS: SettingsField[] = [
  { key: "source", label: "From", options: LANGUAGE_OPTIONS },
  { key: "target", label: "To", options: LANGUAGE_OPTIONS },
];

// same limit as the back (schemas.py): each pause re-translates the whole text on the CPU
const MAX_CHARS = 2000;
// one request per pause, not per key: each one re-translates the whole text
const DEBOUNCE_MS = 500;

type Language = { code: string; name: string };
type LanguageSelectProps = { label: string; value: string; languages: Language[]; onChange: (code: string) => void };

// "From" and "To" are the same select, only the label and the value change
function LanguageSelect({ label, value, languages, onChange }: LanguageSelectProps) {
  return (
    <label style={translateFieldStyle}>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} style={translateSelectStyle}>
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function TranslateWidget({ instance, onRemove, onDuplicate, onUpdate, dragHandle }: WidgetComponentProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [languages, setLanguages] = useState<Language[]>([]);
  const [source, setSource] = useState(String(instance.config.source ?? "en"));
  const [target, setTarget] = useState(String(instance.config.target ?? "fr"));
  // what is typed: never saved, only sent to POST /api/translate
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // number of the last request sent: an older answer arriving late is dropped
  const lastRequest = useRef(0);

  // Array.from counts an emoji as 1 like python, text.length would say 2
  const chars = Array.from(text).length;
  const isTooLong = chars > MAX_CHARS;

  // the language list comes from the back (GET /data), the only place it is written
  useEffect(() => {
    let cancelled = false;
    api<{ data: { languages: Language[] } }>(`/widgets/${instance.id}/data`, { auth: true })
      .then((response) => {
        if (cancelled) return;
        setLanguages(response.data.languages);
        setStatus("ready");
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setMessage(caught instanceof Error ? caught.message : "Unknown error");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [instance.id]);

  useEffect(() => {
    if (!text.trim() || isTooLong) {
      setTranslation("");
      setError(null);
      setIsTranslating(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      const requestId = ++lastRequest.current;
      setIsTranslating(true);
      try {
        const { translatedText } = await api<{ translatedText: string }>("/translate", {
          method: "POST",
          auth: true,
          body: { text, source, target },
        });
        if (requestId !== lastRequest.current) return;
        setTranslation(translatedText);
        setError(null);
      } catch (caught) {
        if (requestId === lastRequest.current) setError(caught instanceof Error ? caught.message : "Unknown error");
      } finally {
        if (requestId === lastRequest.current) setIsTranslating(false);
      }
    }, DEBOUNCE_MS);
    // new key, new language or card removed: cancel the pending timer AND drop the answer in flight
    return () => {
      window.clearTimeout(timer);
      lastRequest.current += 1;
    };
  }, [text, source, target, isTooLong]);

  // the translate effect re-runs by itself (its deps change), the PATCH is only there to remember the choice
  const changeLanguages = async (newSource: string, newTarget: string) => {
    setSource(newSource);
    setTarget(newTarget);
    setSaveError(null);
    try {
      const updated = await api<WidgetInstance>(`/widgets/${instance.id}`, {
        method: "PATCH",
        auth: true,
        body: { config: { source: newSource, target: newTarget } },
      });
      onUpdate(updated);
    } catch {
      setSaveError("Could not save the languages");
    }
  };

  // like google: the translation becomes the text to translate
  const swap = () => {
    if (translation) setText(translation);
    void changeLanguages(target, source);
  };

  const nameOf = (code: string) => languages.find((language) => language.code === code)?.name ?? code;

  return (
    <WidgetFrame
      title={status === "ready" ? `${nameOf(source)} → ${nameOf(target)}` : "Translate"}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      dragHandle={dragHandle}
    >
      {status === "loading" && <div style={widgetMessageStyle}>Loading...</div>}
      {status === "error" && <div style={widgetMessageStyle}>{message}</div>}
      {status === "ready" && (
        <div style={translateBodyStyle}>
          <div style={translateLanguagesStyle}>
            <LanguageSelect label="From" value={source} languages={languages} onChange={(code) => void changeLanguages(code, target)} />
            <button type="button" aria-label="Swap languages" title="Swap languages" onClick={swap} style={translateSwapStyle}>
              ⇄
            </button>
            <LanguageSelect label="To" value={target} languages={languages} onChange={(code) => void changeLanguages(source, code)} />
          </div>
          {/* lang + dir="auto": right font, and arabic goes right to left by itself */}
          <textarea
            aria-label="Text to translate"
            placeholder={`Type in ${nameOf(source)}...`}
            lang={source}
            dir="auto"
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            style={translateTextareaStyle}
          />
          <p style={translateMetaStyle}>
            <span>{isTranslating ? "Translating..." : ""}</span>
            <span style={isTooLong ? { color: errorStyle.color } : undefined}>
              {chars} / {MAX_CHARS} characters
            </span>
          </p>
          {/* the old translation stays while the new one loads, no flicker. polite: read without cutting the user off */}
          <div aria-live="polite" lang={target} dir="auto" style={translateResultStyle}>
            {isTooLong ? `Too long: ${MAX_CHARS} characters max` : (error ?? translation)}
          </div>
          {saveError && <p style={errorStyle}>{saveError}</p>}
        </div>
      )}
    </WidgetFrame>
  );
}
