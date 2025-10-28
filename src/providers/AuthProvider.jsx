import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL;

const LOGIN_API_URL = `${API_URL}/login`;

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  // State to hold the authentication token
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");


  const loginAction = async (data) => {
    const response = await fetch(LOGIN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al iniciar sesión.');
      }

      const datares = await response.json();

      if (datares.token) {
        setToken(datares.token);
        setUser(datares.user);
      } else {
        throw new Error('No se recibió un token de autenticación.');
      }
  
      return datares;
    };

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  // Memoized value of the authentication context
  const contextValue = useMemo(
    () => ({
      token,
      setToken,
    }),
    [token]
  );

  const logOut = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("token");
    navigate("/");
  };

  // Provide the authentication context to the children components
  return (
    <AuthContext.Provider value={{ token, user, loginAction, logOut }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};

export default AuthProvider;