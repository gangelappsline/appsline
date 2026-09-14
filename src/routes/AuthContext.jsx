import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import api from "../services/api";
import {
  getToken,
  getStoredUser,
  saveSession,
  clearSession,
} from "../services/session";

const AuthContext = createContext(null);

/**
 * Proveedor de autenticación contra la API de Appsline (Laravel Passport).
 *
 * Flujo:
 *  - login(email, password)  -> POST /login  (devuelve access token de Passport)
 *  - logout()                -> POST /logout (revoca el token en el servidor)
 *
 * El token y el usuario se guardan en localStorage (user_token / user)
 * para que las peticiones del panel lo usen como `Authorization: Bearer`.
 */
const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(getToken());
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = useCallback(async ({ email, password }) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/login", { email, password });
      const payload = response?.data ?? {};

      // La API puede responder { data: { token, user } } o { token, user }
      // o, en instalaciones de Passport, { access_token, user }.
      const body = payload.data ?? payload;
      const accessToken =
        body.token ?? body.access_token ?? payload.token ?? "";
      const authUser = body.user ?? payload.user ?? null;

      if (!accessToken) {
        throw new Error(
          payload.message || "No se recibió un token de autenticación."
        );
      }

      saveSession(accessToken, authUser);
      setToken(accessToken);
      setUser(authUser);
      return { token: accessToken, user: authUser };
    } catch (err) {
      let message = "No se pudo iniciar sesión. Inténtalo de nuevo.";
      const status = err?.response?.status;

      if (status === 401 || status === 422) {
        message =
          err?.response?.data?.message || "Credenciales incorrectas.";
      } else if (err?.response?.data?.message) {
        message = err.response.data.message;
      } else if (err?.request && !err?.response) {
        message = "No hay conexión con el servidor. Verifica tu red.";
      } else if (err?.message) {
        message = err.message;
      }

      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Revocar el token de Passport en el servidor (si sigue siendo válido).
      await api.post("/logout");
    } catch {
      // Aunque falle la revocación remota, cerramos la sesión local.
    } finally {
      clearSession();
      setToken("");
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      error,
      isAuthenticated: Boolean(token),
      login,
      logout,
      setError,
    }),
    [token, user, loading, error, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  }
  return ctx;
};

export default AuthProvider;
