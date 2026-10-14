import { useEffect, useState } from "react";

/** Preferencias visuales booleanas; siguen funcionando si el almacenamiento está bloqueado. */
export default function useDisplayPreference(name, defaultValue = false) {
  const key = `appsline.display.${name}`;
  const [value, setValue] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      return typeof stored === "boolean" ? stored : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // La preferencia se conserva en memoria durante esta visita.
    }
  }, [key, value]);

  return [value, setValue];
}
