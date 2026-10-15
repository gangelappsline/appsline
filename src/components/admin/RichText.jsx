/* eslint-disable react/prop-types */
/**
 * Renderizador de texto enriquecido (descripciones de tareas y comentarios).
 *
 * Recibe el valor que guarda la API —HTML sencillo o, en datos antiguos, texto
 * plano— y lo pinta saneado (`sanitizeHtml`) con las @menciones resaltadas.
 *
 * ```jsx
 * <RichText value={task.description} />
 * <RichText value={comment.comment} people={users} className="text-[13px]" />
 * ```
 *
 * Nunca se usa `dangerouslySetInnerHTML` con el valor crudo: siempre pasa por
 * `highlightMentionsInHtml`, que sanea y resalta.
 */
import { useMemo } from "react";
import { cx } from "../../utils/format";
import {
  highlightMentionsInHtml,
  looksLikeHtml,
  richTextToPlain,
} from "../../utils/richText";

const RichText = ({
  value,
  html,
  people = [],
  className = "",
  fallback = null,
  as: Wrapper = "div",
}) => {
  const source = value ?? html ?? "";

  const rendered = useMemo(() => {
    const raw = String(source ?? "");
    if (!raw.trim()) return null;
    return {
      plain: !looksLikeHtml(raw),
      text: richTextToPlain(raw),
      html: highlightMentionsInHtml(raw, people),
    };
  }, [source, people]);

  if (!rendered || !rendered.text.trim()) return fallback;

  // Texto plano (comentarios antiguos): se respetan los saltos de línea sin
  // interpretar nada como HTML.
  if (rendered.plain) {
    return (
      <Wrapper className={cx("whitespace-pre-line", className)}>
        {rendered.text}
      </Wrapper>
    );
  }

  return (
    <Wrapper
      className={cx("rich-text", className)}
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  );
};

/**
 * Compatibilidad con el componente que se usaba antes para pintar comentarios
 * (`<MentionText text={...} people={...} />`). Ahora es un alias de `RichText`.
 */
export const MentionText = ({ text, value, className = "", people = [] }) => (
  <RichText as="span" value={text ?? value} people={people} className={className} />
);

export default RichText;
