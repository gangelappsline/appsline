/* eslint-disable react/prop-types, react-refresh/only-export-components */
/**
 * Editor de texto enriquecido del panel (descripciones de tareas y comentarios).
 *
 * Es un `contenteditable` con barra de herramientas: negrita, cursiva,
 * subrayado, tachado, encabezado, listas con viñetas/numeradas, cita, código,
 * enlaces y "quitar formato". El valor que se guarda y viaja a la API es
 * **HTML sencillo** (`<strong>`, `<ul><li>`, …), saneado al pintarlo con
 * `<RichText />` y también en el backend (ver `docs/API-TASKS.md`).
 *
 * Sobre el texto plano: si `value` viene como texto (comentarios antiguos) se
 * escapa y los saltos de línea se convierten en `<br>`, así que nada se rompe.
 *
 * @example Comentario con menciones y botón de enviar
 * <RichTextEditor
 *   value={comment} onChange={setComment} people={users} viewer={me}
 *   placeholder="Escribe un comentario... usa @ para mencionar"
 *   onSubmit={addComment} submitLabel="Enviar"
 * />
 *
 * @example Descripción de una tarea (sin menciones ni botón)
 * <RichTextEditor
 *   value={draft.description} onChange={(html) => setDraft({ ...draft, description: html })}
 *   placeholder="Contexto, criterios de aceptación, enlaces..." autoFocus
 * />
 *
 * La barra del editor (`RICH_TEXT_TOOLBAR`) se exporta desde aquí para que
 * cualquiera pueda reutilizarla; el aviso de fast-refresh no aplica.
 */
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiSend } from "react-icons/fi";
import {
  TbBlockquote,
  TbBold,
  TbClearFormatting,
  TbCode,
  TbH2,
  TbItalic,
  TbLink,
  TbList,
  TbListNumbers,
  TbStrikethrough,
  TbUnderline,
  TbUnlink,
} from "react-icons/tb";
import Avatar from "./Avatar";
import { cx } from "../../utils/format";
import {
  isEmptyRichText,
  removeMentionFromHtml,
  richTextToPlain,
  toRichHtml,
} from "../../utils/richText";
import {
  mentionQueryAt,
  peopleMentionedIn,
  suggestPeople,
} from "../../utils/mentions";

const MAX_SUGGESTIONS = 8;

/**
 * Acciones de la barra. `command` va directo a `document.execCommand`
 * (sigue siendo la forma más compatible de aplicar formato en un
 * `contenteditable`); `value` es el argumento del comando.
 */
export const RICH_TEXT_TOOLBAR = [
  { key: "bold", label: "Negrita", icon: TbBold, command: "bold" },
  { key: "italic", label: "Cursiva", icon: TbItalic, command: "italic" },
  { key: "underline", label: "Subrayado", icon: TbUnderline, command: "underline" },
  { key: "strike", label: "Tachado", icon: TbStrikethrough, command: "strikeThrough" },
  { key: "separator-1", separator: true },
  { key: "heading", label: "Encabezado", icon: TbH2, command: "formatBlock", value: "h3" },
  { key: "ul", label: "Lista con viñetas", icon: TbList, command: "insertUnorderedList" },
  { key: "ol", label: "Lista numerada", icon: TbListNumbers, command: "insertOrderedList" },
  { key: "blockquote", label: "Cita", icon: TbBlockquote, command: "formatBlock", value: "blockquote" },
  { key: "code", label: "Código", icon: TbCode, command: "formatBlock", value: "pre" },
  { key: "separator-2", separator: true },
  { key: "link", label: "Enlace", icon: TbLink, action: "link" },
  { key: "unlink", label: "Quitar enlace", icon: TbUnlink, command: "unlink" },
  { key: "clear", label: "Quitar formato", icon: TbClearFormatting, command: "removeFormat" },
];

/** Claves de la barra que se muestran por defecto. */
export const DEFAULT_TOOLBAR_KEYS = RICH_TEXT_TOOLBAR.filter((i) => !i.separator).map(
  (i) => i.key
);

/**
 * Ejecuta un comando de edición dentro del `contenteditable`.
 * `styleWithCSS = false` fuerza etiquetas (`<strong>`) en lugar de `style`,
 * que es lo que guarda el panel.
 */
const exec = (command, value = null) => {
  try {
    document.execCommand("styleWithCSS", false, false);
    document.execCommand(command, false, value);
  } catch {
    /* comando no soportado por el navegador: se ignora */
  }
};

/** Estado de los botones (negrita activa, lista activa…) leído del navegador. */
const readFormatState = () => {
  const state = {};
  try {
    ["bold", "italic", "underline", "strikeThrough"].forEach((command) => {
      state[command] = document.queryCommandState(command);
    });
    state.block = String(document.queryCommandValue("formatBlock") || "")
      .toLowerCase()
      .replace(/[<>]/g, "");
  } catch {
    /* sin selección o comando desconocido */
  }
  return state;
};

const RichTextEditor = forwardRef(function RichTextEditor(
  {
    value = "",
    onChange,
    onValueChange,
    people = [],
    viewer = { name: "Tú" },
    placeholder = "",
    onBlur,
    onFocus,
    onSubmit,
    submitLabel = "Enviar",
    hint = "",
    showToolbar = true,
    toolbarKeys = DEFAULT_TOOLBAR_KEYS,
    showMentions = false,
    showAvatar = false,
    showSubmit = false,
    autoFocus = false,
    disabled = false,
    ariaLabel = "Editor de texto enriquecido",
    minHeightClass = "min-h-[88px]",
    maxHeightClass = "max-h-72",
    className = "",
    editorClassName = "",
  },
  forwardedRef
) {
  const editorRef = useRef(null);
  const emit = onValueChange || onChange;
  // `null` hasta que se monte: el primer efecto escribe el contenido inicial.
  const lastEmitted = useRef(null);
  const [active, setActive] = useState(null); // { start, end, query, node }
  const [highlighted, setHighlighted] = useState(0);
  const [mentions, setMentions] = useState(() =>
    peopleMentionedIn(richTextToPlain(value), people)
  );
  const [hasContent, setHasContent] = useState(() => !isEmptyRichText(value));
  const [formatState, setFormatState] = useState({});

  const setRefs = useCallback(
    (node) => {
      editorRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );

  /* ---------------------------------------------------------------- */
  /* Puente con el estado del consumidor                              */
  /* ---------------------------------------------------------------- */

  /** Publica el contenido actual del editor hacia el componente padre. */
  const publish = useCallback(
    (html) => {
      const node = editorRef.current;
      if (node) {
        node.innerHTML = html;
        lastEmitted.current = html;
      }
      setMentions(peopleMentionedIn(richTextToPlain(html), people));
      setHasContent(!isEmptyRichText(html));
      emit?.(html);
    },
    [emit, people]
  );

  /** Lee lo que hay escrito y lo publica (tras un clic, una tecla o un comando). */
  const syncFromDom = useCallback(() => {
    const node = editorRef.current;
    if (!node) return;
    const html = node.innerHTML;
    lastEmitted.current = html;
    setMentions(peopleMentionedIn(richTextToPlain(html), people));
    setHasContent(!isEmptyRichText(html));
    emit?.(html);
  }, [emit, people]);

  // El valor puede cambiar por fuera (cargar la tarea, limpiar el comentario al
  // enviarlo). Solo se reescribe el contenido cuando es distinto de lo último
  // emitido, para no perder la posición del cursor mientras se escribe.
  useEffect(() => {
    const node = editorRef.current;
    if (!node) return;
    const incoming = toRichHtml(value);
    if (incoming === lastEmitted.current) return;
    lastEmitted.current = incoming;
    node.innerHTML = incoming;
    setMentions(peopleMentionedIn(richTextToPlain(incoming), people));
    setHasContent(!isEmptyRichText(incoming));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (autoFocus) editorRef.current?.focus();
  }, [autoFocus]);

  /* ---------------------------------------------------------------- */
  /* @Menciones                                                       */
  /* ---------------------------------------------------------------- */

  const suggestions = useMemo(() => {
    if (!active) return [];
    return suggestPeople(people, active.query, {
      excludeId: viewer?.id,
      limit: MAX_SUGGESTIONS,
    });
  }, [active, people, viewer?.id]);

  useEffect(() => setHighlighted(0), [active?.query]);

  /** ¿Se está escribiendo un "@consulta" justo en el cursor? */
  const readCaretMention = useCallback(() => {
    const node = editorRef.current;
    const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
    if (!node || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!range.collapsed || !node.contains(range.startContainer)) return null;
    const target = range.startContainer;
    if (target.nodeType !== Node.TEXT_NODE) return null;
    const before = target.data.slice(0, range.startOffset);
    const query = mentionQueryAt(before, before.length);
    return query ? { ...query, node: target } : null;
  }, []);

  const refreshMentionQuery = useCallback(() => {
    if (!showMentions || disabled) {
      setActive(null);
      return;
    }
    setActive(readCaretMention());
  }, [disabled, readCaretMention, showMentions]);

  const insertMention = useCallback(
    (person) => {
      const node = editorRef.current;
      if (!node || !person) return;
      const token = `@${String(person.name || "").trim()} `;
      const info = active;
      node.focus();

      if (info?.node?.isConnected) {
        const selection = window.getSelection();
        const range = document.createRange();
        const end = Math.min(info.end, info.node.data.length);
        range.setStart(info.node, Math.min(info.start, end));
        range.setEnd(info.node, end);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      exec("insertText", token);
      setActive(null);
      syncFromDom();
    },
    [active, syncFromDom]
  );

  /* ---------------------------------------------------------------- */
  /* Eventos                                                          */
  /* ---------------------------------------------------------------- */

  const handleInput = () => {
    syncFromDom();
    refreshMentionQuery();
  };

  const handleKeyDown = (event) => {
    // El navegador aplica los atajos de formato (⌘B, ⌘U, ⌘I…).
    if (suggestions.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted((old) => {
          const step = event.key === "ArrowDown" ? 1 : -1;
          return (old + step + suggestions.length) % suggestions.length;
        });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertMention(suggestions[highlighted] || suggestions[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setActive(null);
        return;
      }
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit?.();
    }
  };

  const handleBlur = () => {
    const node = editorRef.current;
    // Un contenido "vacío" (solo `<br>` o `<p></p>`) se limpia para que el
    // marcador de posición vuelva a verse.
    if (node && isEmptyRichText(node.innerHTML)) node.innerHTML = "";
    setActive(null);
    setFormatState({});
    onBlur?.(node ? node.innerHTML : "");
  };

  const handleFocus = (event) => {
    setFormatState(readFormatState());
    onFocus?.(event);
  };

  /** Pega siempre como texto plano + saltos: evita arrastrar estilos ajenos. */
  const handlePaste = (event) => {
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!text) return;
    event.preventDefault();
    const parts = text.split(/\r\n?|\n/);
    parts.forEach((part, index) => {
      if (index > 0) exec("insertLineBreak");
      if (part) exec("insertText", part);
    });
    syncFromDom();
    refreshMentionQuery();
  };

  /** Los botones no pueden quitarle el foco al editor (se perdería el cursor). */
  const runToolbarItem = (item) => {
    const node = editorRef.current;
    if (!node || disabled) return;
    node.focus();
    if (item.action === "link") {
      const url = window.prompt("Dirección del enlace (https://…)", "https://");
      if (url) exec("createLink", url.trim());
    } else {
      exec(item.command, item.value ?? null);
    }
    setFormatState(readFormatState());
    syncFromDom();
  };

  // Refresca el estado de los botones al mover el cursor dentro del editor.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onSelectionChange = () => {
      const node = editorRef.current;
      if (!node || document.activeElement !== node) return;
      setFormatState(readFormatState());
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const toolbarItems = useMemo(
    () => RICH_TEXT_TOOLBAR.filter((item) => item.separator || toolbarKeys.includes(item.key)),
    [toolbarKeys]
  );

  const isItemActive = (item) =>
    (item.command && formatState[item.command]) ||
    (item.command === "formatBlock" && formatState.block === String(item.value));

  const showFooter = showSubmit || showMentions || Boolean(hint);

  return (
    <div className="flex items-start gap-2">
      {showAvatar && <Avatar user={viewer} size="xs" />}

      <div className="relative min-w-0 flex-1">
        <div
          className={cx(
            "overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10",
            disabled && "opacity-60",
            className
          )}
        >
          {showToolbar && (
            <div
              role="toolbar"
              aria-label="Formato de texto"
              className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50/70 px-1.5 py-1"
            >
              {toolbarItems.map((item) =>
                item.separator ? (
                  <span key={item.key} className="mx-1 h-4 w-px bg-slate-200" />
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    aria-pressed={isItemActive(item) ? true : undefined}
                    disabled={disabled}
                    // Sin esto el botón se lleva el foco y el cursor se pierde.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runToolbarItem(item)}
                    className={cx(
                      "rounded-md p-1.5 text-sm transition disabled:opacity-40",
                      isItemActive(item)
                        ? "bg-brand-100 text-brand-700"
                        : "text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"
                    )}
                  >
                    <item.icon />
                  </button>
                )
              )}
            </div>
          )}

          <div
            ref={setRefs}
            contentEditable={!disabled}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={ariaLabel}
            aria-autocomplete={showMentions ? "list" : undefined}
            aria-expanded={suggestions.length > 0 || undefined}
            data-placeholder={placeholder}
            spellCheck
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onKeyUp={refreshMentionQuery}
            onClick={refreshMentionQuery}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onPaste={handlePaste}
            className={cx(
              "rich-text rich-text-editor w-full overflow-y-auto px-2.5 py-2 text-[13px] leading-6 text-slate-700 focus:outline-none",
              minHeightClass,
              maxHeightClass,
              editorClassName
            )}
          />

          {showFooter && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 px-2.5 py-1.5">
              {showMentions && mentions.length > 0 ? (
                <>
                  <span className="text-[11px] font-semibold text-brand-600">
                    Se notificará a
                  </span>
                  {mentions.map((person) => (
                    <span
                      key={person.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2 pr-1 text-[11px] font-semibold text-brand-700"
                    >
                      <span className="truncate">@{person.name}</span>
                      <button
                        type="button"
                        title={`Quitar mención a ${person.name}`}
                        onClick={() =>
                          publish(
                            removeMentionFromHtml(
                              editorRef.current?.innerHTML || "",
                              person.name
                            )
                          )
                        }
                        className="rounded-full px-1 leading-none text-brand-500 transition hover:bg-brand-100 hover:text-brand-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </>
              ) : (
                hint && (
                  <span className="hidden text-[11px] text-slate-400 sm:block">{hint}</span>
                )
              )}

              {showSubmit && (
                <button
                  type="button"
                  disabled={!hasContent}
                  onClick={onSubmit}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
                >
                  <FiSend /> {submitLabel}
                </button>
              )}
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div
            role="listbox"
            aria-label="Sugerencias de personas"
            className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
          >
            {suggestions.map((person, index) => (
              <button
                key={person.id}
                type="button"
                role="option"
                aria-selected={index === highlighted}
                // preventDefault: el clic no debe quitarle el foco al editor.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertMention(person)}
                onMouseEnter={() => setHighlighted(index)}
                className={cx(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition",
                  index === highlighted ? "bg-brand-50" : "hover:bg-slate-50"
                )}
              >
                <Avatar user={person} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-slate-700">
                    {person.name}
                  </span>
                  {person.email && (
                    <span className="block truncate text-[11px] text-slate-400">
                      {person.email}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default RichTextEditor;
