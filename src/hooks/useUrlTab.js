import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Pestaña sincronizada con la URL (`?tab=proyectos`).
 *
 * Permite compartir enlaces directos a una sección concreta del panel
 * (por ejemplo `/admin/reports?tab=equipo`) y que al recargar la página
 * se mantenga la vista seleccionada.
 *
 * @param {string[]} validKeys Claves permitidas.
 * @param {string} defaultKey Clave inicial.
 * @returns {[string, (key: string) => void]}
 */
export default function useUrlTab(validKeys = [], defaultKey = "") {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("tab");
  const [tab, setTab] = useState(() => (validKeys.includes(param) ? param : defaultKey));

  // Si la URL cambia (navegación atrás/adelante o enlace externo), se refleja.
  useEffect(() => {
    if (validKeys.includes(param) && param !== tab) setTab(param);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  const change = useCallback(
    (key) => {
      setTab(key);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", key);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return [tab, change];
}
