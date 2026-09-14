import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * Protege las rutas del panel administrativo.
 * Si no hay token de sesión, redirige al login recordando la ruta
 * a la que se intentaba entrar para volver ahí después de autenticarse.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;
