/**
 * Lectura de errores de la API (Laravel).
 *
 * El backend responde 422 con la forma:
 *
 *   { "message": "The given data was invalid.",
 *     "errors": { "tax_id": ["Ya existe un cliente con ese identificador fiscal."] } }
 *
 * Estos helpers convierten eso en algo mostrable: un mensaje para el toast
 * y un mapa campo → mensaje para pintar el error debajo de cada input.
 */

/** Mensaje genérico que Laravel usa cuando en realidad hay errores por campo. */
const GENERIC_MESSAGES = [
  "the given data was invalid.",
  "the given data was invalid",
  "unprocessable entity",
];

/** Primer mensaje de una entrada de `errors` (Laravel siempre manda arreglos). */
const firstMessage = (value) =>
  Array.isArray(value) ? String(value[0] ?? "").trim() : String(value ?? "").trim();

/**
 * Errores de validación por campo: `{ email: "Ya existe un cliente con ese correo." }`.
 * @returns {Record<string, string>} objeto vacío si el error no es de validación.
 */
export const fieldErrors = (error) => {
  const errors = error?.response?.data?.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return {};

  return Object.fromEntries(
    Object.entries(errors)
      .map(([field, value]) => [field, firstMessage(value)])
      .filter(([, message]) => Boolean(message))
  );
};

/** Primer mensaje de validación disponible (para el toast). */
export const firstFieldError = (error) => Object.values(fieldErrors(error))[0] || "";

/**
 * Mensaje legible para el usuario a partir de un error de axios.
 * Prioriza el mensaje del backend; si es el genérico de Laravel o no hay
 * mensaje, cae al primer error de validación, a un texto por código HTTP
 * o al respaldo que envíe quien llama.
 */
export const apiErrorMessage = (error, fallback = "Ocurrió un error inesperado.") => {
  const status = error?.response?.status;
  const message = String(error?.response?.data?.message || "").trim();
  const usable = message && !GENERIC_MESSAGES.includes(message.toLowerCase());

  if (usable) {
    // 500 con el mensaje crudo del framework confunde más que ayudar.
    if (status && status >= 500) return fallback;
    return message;
  }

  const validation = firstFieldError(error);
  if (validation) return validation;

  if (status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (status === 403) return "No tienes permisos para realizar esta acción.";
  if (status === 404) return "El recurso ya no existe. Actualiza la lista.";
  if (status === 409) return "Ya existe un registro con esos datos.";
  if (status === 429) return "Demasiadas solicitudes. Espera unos segundos.";
  if (status && status >= 500) return "El servidor no pudo procesar la solicitud. Inténtalo más tarde.";
  if (error?.request && !error?.response) return "No hay conexión con el servidor. Revisa tu red.";

  return fallback;
};

export default { fieldErrors, firstFieldError, apiErrorMessage };
