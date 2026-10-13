/* eslint-disable react/prop-types */
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { FiSend } from "react-icons/fi";
import Avatar from "./Avatar";
import { cx } from "../../utils/format";
import {
  findMentionSpans,
  mentionQueryAt,
  peopleMentionedIn,
  removeMentionFromText,
  suggestPeople,
} from "../../utils/mentions";

const MAX_SUGGESTIONS = 8;

/**
 * Caja de comentario con autocompletado de personas estilo WhatsApp/Instagram.
 *
 * Al escribir "@" aparece la lista del personal; el nombre se inserta con
 * Enter/Tab o con clic (y se navega con las flechas). Las personas mencionadas
 * se calculan a partir del texto con `peopleMentionedIn`, de modo que quien
 * guarda el comentario puede enviarlas al backend:
 *
 *   const mencionados = peopleMentionedIn(comment, users);
 *   addTaskComment(id, task.id, comment, mencionados.map((p) => p.id));
 *
 * @example
 * <MentionComposer
 *   value={comment}
 *   onValueChange={setComment}
 *   people={users}
 *   onSubmit={addComment}
 * />
 */
const MentionComposer = forwardRef(function MentionComposer(
  {
    value = "",
    onValueChange,
    people = [],
    onSubmit,
    viewer = { name: "Tú" },
    placeholder = "Escribe un comentario...",
    hint = "Usa @ para mencionar · ⌘ + Enter para enviar",
    submitLabel = "Enviar",
    rows = 2,
  },
  forwardedRef
) {
  const textRef = useRef(null);
  const [active, setActive] = useState(null); // {start, end, query}
  const [highlighted, setHighlighted] = useState(0);

  /* Personas mencionadas (se recalcula con cada cambio del texto). */
  const mentions = useMemo(() => peopleMentionedIn(value, people), [value, people]);

  const setRefs = (node) => {
    textRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const suggestions = useMemo(() => {
    if (!active) return [];
    return suggestPeople(people, active.query, {
      excludeId: viewer?.id,
      limit: MAX_SUGGESTIONS,
    });
  }, [active, people, viewer?.id]);

  useEffect(() => setHighlighted(0), [active?.query]);

  const focusCaret = (caret) => {
    // El textarea recibe el nuevo valor después de onValueChange: esperamos un frame.
    requestAnimationFrame(() => {
      const node = textRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(caret, caret);
    });
  };

  const insertMention = (person) => {
    const range = active || {
      start: String(value).length,
      end: String(value).length,
    };
    const name = String(person.name || "").trim();
    const token = `@${name}`;
    const before = String(value).slice(0, range.start);
    const after = String(value).slice(range.end);
    // Un espacio después del nombre evita que quede pegado al texto siguiente.
    const trailing = after === "" || /^[\s,.;:!?)]/.test(after) ? "" : " ";
    const next = `${before}${token}${trailing}${after}`;

    onValueChange?.(next);
    setActive(null);
    focusCaret(before.length + token.length + trailing.length);
  };

  const handleChange = (event) => {
    const text = event.target.value;
    setActive(mentionQueryAt(text, event.target.selectionStart ?? text.length));
    onValueChange?.(text);
  };

  const handleKeyDown = (event) => {
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

  return (
    <div className="flex items-start gap-2">
      <Avatar user={viewer} size="xs" />

      <div className="relative min-w-0 flex-1">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10">
          <textarea
            ref={setRefs}
            rows={rows}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setActive(null)}
            placeholder={placeholder}
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            className="w-full resize-none p-2.5 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 px-2.5 py-1.5">
            {mentions.length > 0 ? (
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
                      onClick={() => onValueChange?.(removeMentionFromText(value, person.name))}
                      className="rounded-full px-1 leading-none text-brand-500 transition hover:bg-brand-100 hover:text-brand-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </>
            ) : (
              <span className="hidden text-[11px] text-slate-400 sm:block">{hint}</span>
            )}

            <button
              type="button"
              disabled={!String(value).trim()}
              onClick={onSubmit}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              <FiSend /> {submitLabel}
            </button>
          </div>
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
                // preventDefault: el clic no debe quitarle el foco al textarea.
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

/**
 * Texto de un comentario con las @menciones resaltadas.
 * @example <MentionText text={c.comment} people={users} />
 */
export const MentionText = ({ text, people = [], className = "" }) => {
  const content = String(text ?? "");
  const spans = findMentionSpans(content, people);
  if (!spans.length) return <span className={className}>{content}</span>;

  const parts = [];
  let cursor = 0;
  spans.forEach((span, index) => {
    if (span.start > cursor) parts.push(content.slice(cursor, span.start));
    parts.push(
      <span
        key={`${span.start}-${index}`}
        className="rounded bg-brand-50 px-0.5 font-semibold text-brand-700"
      >
        {content.slice(span.start, span.end)}
      </span>
    );
    cursor = span.end;
  });
  if (cursor < content.length) parts.push(content.slice(cursor));

  return <span className={className}>{parts}</span>;
};

export default MentionComposer;
