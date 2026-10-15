/* eslint-disable react/prop-types */
/**
 * Caja de comentario con autocompletado de personas estilo WhatsApp/Instagram.
 *
 * Ahora es un envoltorio de `<RichTextEditor />`: el comentario admite formato
 * (negritas, listas, enlaces…) **y** menciones con "@". El valor que se guarda
 * y viaja a la API sigue siendo un `string` con HTML sencillo.
 *
 * Las personas mencionadas se calculan a partir del texto visible con
 * `peopleMentionedIn`, de modo que quien guarda el comentario puede enviarlas
 * al backend:
 *
 *   const mencionados = peopleMentionedIn(richTextToPlain(comment), users);
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
import { forwardRef } from "react";
import RichTextEditor from "./RichTextEditor";
import { MentionText } from "./RichText";

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
  return (
    <RichTextEditor
      ref={forwardedRef}
      value={value}
      onValueChange={onValueChange}
      people={people}
      viewer={viewer}
      placeholder={placeholder}
      hint={hint}
      submitLabel={submitLabel}
      onSubmit={onSubmit}
      showMentions
      showAvatar
      showSubmit
      minHeightClass={rows > 2 ? "min-h-24" : "min-h-[88px]"}
      ariaLabel="Escribe un comentario"
    />
  );
});

export { MentionText };
export default MentionComposer;
