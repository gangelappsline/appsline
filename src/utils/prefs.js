/**
 * Preferencias del usuario guardadas en localStorage.
 * Se editan en Configuración > Preferencias y se consumen
 * en Mi trabajo (tamaño de página) y en el proveedor de toasts.
 */

export const PAGE_SIZE_KEY = "appsline.page_size";
export const DEFAULT_PAGE_SIZE = 10;

export const getPageSize = () => {
  const v = Number(localStorage.getItem(PAGE_SIZE_KEY));
  return [10, 20, 50].includes(v) ? v : DEFAULT_PAGE_SIZE;
};

export const setPageSize = (n) => localStorage.setItem(PAGE_SIZE_KEY, String(n));
