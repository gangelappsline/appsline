/**
 * Manejo centralizado de la sesión en localStorage.
 * Claves únicas para toda la app:
 *  - user_token : access token de Laravel Passport
 *  - user       : objeto del usuario autenticado (JSON)
 */
const TOKEN_KEY = "user_token";
const USER_KEY = "user";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveSession = (token, user) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Claves usadas por versiones anteriores de la app:
  localStorage.removeItem("token");
  localStorage.removeItem("site");
};
