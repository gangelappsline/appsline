import React from 'react';
import { Route } from 'react-router-dom';
import Dashboard from '../pages/admin/Dashboard';
import Products from '../pages/admin/Products';
import Users from '../pages/admin/Users';
import ProtectedRoute from './ProtectedRoute';

function AdminRoutes() {
  return (
    <>
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />
    </>
  );
}

export default AdminRoutes;
