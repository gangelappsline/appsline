import axios from "axios";
import { getToken, clearSession } from "./session";

const API_URL =
  import.meta.env.VITE_API_URL || "https://api.appsline.com.mx/api";

/**
 * Cliente HTTP central para la API de Appsline (Laravel Passport).
 * - Agrega automáticamente el Bearer token a cada petición.
 * - Si la API responde 401 (token expirado/revocado) limpia la sesión
 *   y redirige al login cuando el usuario está dentro del panel.
 */
const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isLoginRequest = error?.config?.url?.includes("/login");

    if (status === 401 && !isLoginRequest) {
      clearSession();
      // Solo forzamos la redirección si el usuario está dentro del panel.
      if (window.location.pathname.startsWith("/admin")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export { API_URL };
export default api;
