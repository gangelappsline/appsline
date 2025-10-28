import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './font_awesome_full.css'
import './i18n'; // Importa la configuración de i18n

import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";
import Home from './pages/Home.jsx';
import NoPage from './pages/NoPage.jsx';
import AboutUs from './pages/AboutUs.jsx';
import Login from './pages/Login.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AuthProvider from './routes/AuthContext.jsx';
import Products from './pages/admin/Products.jsx';
import Users from './pages/admin/Users.jsx';
import Projects from './pages/admin/Projects.jsx';
import Project from './pages/admin/Project.jsx';
import Product from './pages/admin/Product.jsx';
import ProjectLead from './pages/ProjectLead';

createRoot(document.getElementById('root')).render(
  <StrictMode>

    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/">
            <Route index element={<Home />} />
            <Route path="about-us" element={<AboutUs />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="*" element={<NoPage />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/solicitar-proyecto" element={<ProjectLead />} />

          {/* Rutas protegidas: */}
          <Route
            path="/admin/dashboard"
            element={

              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={

              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products"
            element={

              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products/:id"
            element={

              <ProtectedRoute>
                <Product />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/projects"
            element={

              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/projects/:id"
            element={

              <ProtectedRoute>
                <Project />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>

  </StrictMode>,
)
