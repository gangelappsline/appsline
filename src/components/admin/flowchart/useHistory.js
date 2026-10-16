import { useCallback, useRef, useState } from "react";

const LIMIT = 100;

/**
 * Historial de deshacer/rehacer para el editor.
 *
 * Guarda instantáneas `{ nodes, edges }`. `snapshot(key)` se llama ANTES de
 * mutar; si se repite la misma `key` en menos de `windowMs` (p. ej. mover un
 * control deslizante) no se apila otra instantánea, para que un solo Ctrl+Z
 * revierta todo el gesto.
 */
export default function useHistory(getState) {
  const past = useRef([]);
  const future = useRef([]);
  const lastKey = useRef({ key: null, at: 0 });
  const [, bump] = useState(0);

  const snapshot = useCallback(
    (key = null, windowMs = 700) => {
      const now = Date.now();
      if (key && lastKey.current.key === key && now - lastKey.current.at < windowMs) {
        lastKey.current.at = now;
        return;
      }
      lastKey.current = { key, at: now };
      const state = getState();
      past.current.push({ nodes: state.nodes, edges: state.edges });
      if (past.current.length > LIMIT) past.current.shift();
      future.current = [];
      bump((n) => n + 1);
    },
    [getState],
  );

  const undo = useCallback(() => {
    if (!past.current.length) return null;
    const current = getState();
    const previous = past.current.pop();
    future.current.push({ nodes: current.nodes, edges: current.edges });
    lastKey.current = { key: null, at: 0 };
    bump((n) => n + 1);
    return previous;
  }, [getState]);

  const redo = useCallback(() => {
    if (!future.current.length) return null;
    const current = getState();
    const next = future.current.pop();
    past.current.push({ nodes: current.nodes, edges: current.edges });
    lastKey.current = { key: null, at: 0 };
    bump((n) => n + 1);
    return next;
  }, [getState]);

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    lastKey.current = { key: null, at: 0 };
    bump((n) => n + 1);
  }, []);

  return {
    snapshot,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
