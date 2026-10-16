import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./font_awesome_full.css";
import "./i18n"; // Importa la configuración de i18n

import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import Home from "./pages/Home.jsx";
import NoPage from "./pages/NoPage.jsx";
import AboutUs from "./pages/AboutUs.jsx";
import WhatWeDo from "./pages/WhatWeDo.jsx";
import Login from "./pages/Login.jsx";
import Portfolio from "./pages/Portfolio.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import Analytics from "./pages/admin/Analytics.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import AuthProvider from "./routes/AuthContext.jsx";
import PushProvider from "./routes/PushContext.jsx";
import { ToastProvider } from "./components/admin/Toasts";
import Products from "./pages/admin/Products.jsx";
import Users from "./pages/admin/Users.jsx";
import Projects from "./pages/admin/Projects.jsx";
import Project from "./pages/admin/Project.jsx";
import Diagrams from "./pages/admin/Diagrams.jsx";
import Product from "./pages/admin/Product.jsx";
import Tasks from "./pages/admin/Tasks.jsx";
import Calendar from "./pages/admin/Calendar.jsx";
import Clients from "./pages/admin/Clients.jsx";
import Reports from "./pages/admin/Reports.jsx";
import Settings from "./pages/admin/Settings.jsx";
import ProjectLead from "./pages/ProjectLead";
import ToolsAliasRedirect from "./routes/ToolsAliasRedirect.jsx";
import ToolsFallback from "./components/tools/ToolsFallback.jsx";

/* Las herramientas se cargan bajo demanda (pdf.js, docx y qrcode pesan). */
/* El editor de diagramas (React Flow) solo se descarga al abrir un diagrama. */
const DiagramEditor = lazy(() => import("./pages/admin/DiagramEditor.jsx"));
const ToolsIndex = lazy(() => import("./pages/tools/ToolsIndex.jsx"));
const QrGenerator = lazy(() => import("./pages/tools/QrGenerator.jsx"));
const PdfToWord = lazy(() => import("./pages/tools/PdfToWord.jsx"));
const PdfSummary = lazy(() => import("./pages/tools/PdfSummary.jsx"));
const PdfToText = lazy(() => import("./pages/tools/PdfToText.jsx"));
const ImageToWebp = lazy(() => import("./pages/tools/ImageToWebp.jsx"));
const ImageEnhancer = lazy(() => import("./pages/tools/ImageEnhancer.jsx"));
const AudioToText = lazy(() => import("./pages/tools/AudioToText.jsx"));
const JsonFormatter = lazy(() => import("./pages/tools/JsonFormatter.jsx"));
const Base64Tool = lazy(() => import("./pages/tools/Base64Tool.jsx"));
const HashGenerator = lazy(() => import("./pages/tools/HashGenerator.jsx"));
const PasswordGenerator = lazy(() => import("./pages/tools/PasswordGenerator.jsx"));
const UuidGenerator = lazy(() => import("./pages/tools/UuidGenerator.jsx"));
const JwtDecoder = lazy(() => import("./pages/tools/JwtDecoder.jsx"));
const ColorConverter = lazy(() => import("./pages/tools/ColorConverter.jsx"));
import { HelmetProvider } from "react-helmet-async";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          {/* Las notificaciones viven por encima de las páginas para que
              cualquier `useToast()` (que se monta antes del LayoutAdmin)
              reciba el contexto real y no el no-op por defecto. */}
          <ToastProvider>
          {/* Notificaciones push (FCM): requiere sesión + toasts, así que va
              dentro de AuthProvider y ToastProvider y encima de las rutas. */}
          <PushProvider>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/">
              <Route index element={<Home />} />
              <Route path="about-us" element={<AboutUs />} />
              <Route path="what-we-do" element={<WhatWeDo />} />
              <Route path="portfolio" element={<Portfolio />} />

              {/* Herramientas gratuitas para desarrolladores */}
              <Route
                path="herramientas"
                element={
                  <Suspense fallback={<ToolsFallback />}>
                    <Outlet />
                  </Suspense>
                }
              >
                <Route index element={<ToolsIndex />} />
                <Route path="generador-de-qr" element={<QrGenerator />} />
                <Route path="pdf-a-word" element={<PdfToWord />} />
                <Route path="resumen-de-pdf" element={<PdfSummary />} />
                <Route path="extraer-texto-de-pdf" element={<PdfToText />} />
                <Route path="imagen-a-webp" element={<ImageToWebp />} />
                <Route path="mejorar-imagen" element={<ImageEnhancer />} />
                <Route path="audio-a-texto" element={<AudioToText />} />
                <Route path="formateador-json" element={<JsonFormatter />} />
                <Route path="base64" element={<Base64Tool />} />
                <Route path="generador-de-hash" element={<HashGenerator />} />
                <Route
                  path="generador-de-contrasenas"
                  element={<PasswordGenerator />}
                />
                <Route path="generador-de-uuid" element={<UuidGenerator />} />
                <Route path="decodificador-jwt" element={<JwtDecoder />} />
                <Route path="conversor-de-color" element={<ColorConverter />} />
              </Route>
              {/* Alias en inglés */}
              <Route path="tools" element={<Navigate to="/herramientas" replace />} />
              <Route path="tools/:slug" element={<ToolsAliasRedirect />} />
              <Route path="*" element={<NoPage />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/solicitar-proyecto" element={<ProjectLead />} />

            {/* Panel administrativo (requiere sesión) */}
            <Route
              path="/admin"
              element={<Navigate to="/admin/dashboard" replace />}
            />
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
            <Route
              path="/admin/projects/:id/diagrams/:diagramId"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">Cargando el editor de diagramas…</div>}>
                    <DiagramEditor />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/diagrams"
              element={
                <ProtectedRoute>
                  <Diagrams />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks"
              element={
                <ProtectedRoute>
                  <Tasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/calendar"
              element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/clients"
              element={
                <ProtectedRoute>
                  <Clients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Routes>
          </PushProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
);
