import React from 'react';
import { Navigate } from 'react-router-dom';

// Este componente verifica si el usuario está autenticado
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('user_token');

  if (!token) {
    // Si no hay token, redirigir al login
    return <Navigate to="/login" />;
  }

  // Si hay token, renderizar el componente protegido
  return children;
}

export default ProtectedRoute;