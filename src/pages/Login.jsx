import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiAlertCircle, FiArrowLeft, FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";
import LogoFull from "../assets/images/appsline_logo_white.webp";
import LogoIcon from "../assets/images/new_appsline_icon.webp";
import { useAuth } from "../routes/AuthContext";

const highlights = [
  "Gestiona proyectos, tareas y entregables en un solo lugar.",
  "Controla usuarios, roles y permisos del equipo.",
  "Da seguimiento a productos y solicitudes de clientes.",
];

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading, isAuthenticated } = useAuth();

  // Ruta a la que se quería entrar antes de ser redirigido al login.
  const from = location.state?.from?.pathname || "/admin/dashboard";

  // Si ya hay sesión activa, no tiene sentido mostrar el login.
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, from, navigate]);

  useEffect(() => {
    document.title = "Appsline | Iniciar sesión";
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!email.trim() || !password) {
      setFormError("Ingresa tu correo y contraseña.");
      return;
    }

    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(err.message || "Credenciales incorrectas.");
    }
  };

  return (
    <div className="flex min-h-screen bg-ink-1000 text-white">
      {/* ---------- Panel de marca (desktop) ---------- */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(0,96,252,.28),transparent_45%),radial-gradient(circle_at_80%_85%,rgba(0,163,254,.2),transparent_45%)]" />
        <div className="absolute inset-0 opacity-[.06] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="absolute -left-24 bottom-[-10%] h-96 w-96 rounded-full bg-brand-700/25 blur-3xl" />

        <Link to="/" className="relative z-10 inline-flex">
          <img src={LogoFull} alt="Appsline" className="h-12 object-contain" />
        </Link>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-[-.04em] xl:text-5xl">
            Tu centro de mando{" "}
            <span className="brand-text-gradient">Appsline</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-400">
            Accede al panel administrativo para dar seguimiento a todo lo que
            está pasando en tus proyectos.
          </p>

          <ul className="mt-10 space-y-4">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-slate-300">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400 shadow-[0_0_12px_#00A3FE]" />
                <span className="leading-7">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm text-slate-600">
          © {new Date().getFullYear()} Appsline. Todos los derechos reservados.
        </p>
      </aside>

      {/* ---------- Formulario ---------- */}
      <main className="flex w-full items-center justify-center px-5 py-12 sm:px-8 lg:w-1/2 lg:bg-ink-950">
        <div className="w-full max-w-md">
          <div className="mb-10 flex flex-col items-center lg:items-start">
            <img
              src={LogoIcon}
              alt="Appsline"
              className="mb-6 h-16 w-16 object-contain drop-shadow-[0_10px_30px_rgba(0,96,252,.45)] lg:hidden"
            />
            <h2 className="text-3xl font-semibold tracking-tight">
              Iniciar sesión
            </h2>
            <p className="mt-2 text-slate-400">
              Bienvenido de nuevo. Ingresa tus credenciales para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                <FiAlertCircle className="mt-0.5 shrink-0 text-base" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <FiMail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tucorreo@appsline.com.mx"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-white/10 bg-white/[.04] py-3.5 pl-11 pr-4 text-white placeholder-slate-600 transition focus:border-brand-500 focus:bg-white/[.06] focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Contraseña
              </label>
              <div className="relative">
                <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-white/10 bg-white/[.04] py-3.5 pl-11 pr-12 text-white placeholder-slate-600 transition focus:border-brand-500 focus:bg-white/[.06] focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-60"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-brand-400"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-slate-400">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-0"
                />
                <span>Recuérdame</span>
              </label>
              <a
                href="#"
                className="font-medium text-brand-400 transition hover:text-white"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-brand-gradient py-3.5 text-base font-semibold text-white shadow-brand transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && (
                <svg
                  className="h-5 w-5 animate-spin text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-90"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              )}
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-slate-500 transition hover:text-white"
            >
              <FiArrowLeft /> Volver al sitio
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;
