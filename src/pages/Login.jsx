import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LogoAppsline from "../assets/images/appsline_logo_white.png";
import LogoVertical from "../assets/images/appsline_logo_vertical.png";
import { useAuth } from "../routes/AuthContext";

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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-app-one via-app-two to-app-three px-4 py-8">
            <div className="relative w-full max-w-4xl mx-auto flex flex-col md:flex-row items-stretch justify-center shadow-2xl rounded-3xl overflow-hidden bg-white">
                {/* Nube decorativa */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <svg viewBox="0 0 900 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                        <path d="M0 400 Q200 300 400 400 T900 400 V600 H0Z" fill="url(#cloudGradient)" opacity="0.18" />
                        <defs>
                            <linearGradient id="cloudGradient" x1="0" y1="0" x2="900" y2="600" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#2B2E83" />
                                <stop offset="1" stopColor="#3AC6F6" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>

                {/* Formulario */}
                <div className="relative z-10 flex-1 flex flex-col justify-center px-8 py-12 bg-white/90 backdrop-blur-md">
                    <form className="max-w-md w-full mx-auto" onSubmit={handleSubmit} noValidate>
                        <img src={LogoVertical} className="h-14 mx-auto mb-6 md:hidden" alt="Appsline" />
                        <h2 className="text-3xl font-bold text-app-one mb-2 text-center">¡Hola de nuevo!</h2>
                        <p className="text-center text-gray-500 mb-8">Inicia sesión en el panel administrativo</p>

                        {formError && (
                            <div
                                role="alert"
                                className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                            >
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
                                    <path
                                        fill="currentColor"
                                        d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1 5h2v7h-2V7zm0 9h2v2h-2v-2z"
                                    />
                                </svg>
                                <span>{formError}</span>
                            </div>
                        )}

                        <div className="mb-4 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-one pointer-events-none">
                                <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                                    <path fill="#2B2E83" d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4zm0-2a4 4 0 100-8 4 4 0 000 8z" />
                                </svg>
                            </span>
                            <input
                                name="email"
                                type="email"
                                autoComplete="email"
                                placeholder="Correo electrónico"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                className="pl-11 pr-4 py-3 rounded-lg shadow focus:ring-2 focus:ring-app-two focus:outline-none w-full bg-white border border-gray-200 disabled:opacity-60"
                            />
                        </div>

                        <div className="mb-2 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-one pointer-events-none">
                                <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                                    <path
                                        fill="#2B2E83"
                                        d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-7V7a6 6 0 10-12 0v3a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2zm-8-3a4 4 0 118 0v3H6V7z"
                                    />
                                </svg>
                            </span>
                            <input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                className="pl-11 pr-12 py-3 rounded-lg shadow focus:ring-2 focus:ring-app-two focus:outline-none w-full bg-white border border-gray-200 disabled:opacity-60"
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-app-one transition"
                                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            >
                                {showPassword ? (
                                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M2.1 3.51L3.51 2.1l18.39 18.39-1.41 1.41-3.1-3.1A10.78 10.78 0 0112 19c-7 0-9-7-9-7a13.35 13.35 0 013.44-4.94L2.1 3.51zM12 5c7 0 9 7 9 7a13.1 13.1 0 01-2.34 3.82l-2.9-2.9A5 5 0 0011.08 8.24l-2.3-2.3A10.5 10.5 0 0112 5z"
                                        />
                                    </svg>
                                ) : (
                                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M12 5c-7 0-9 7-9 7s2 7 9 7 9-7 9-7-2-7-9-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"
                                        />
                                    </svg>
                                )}
                            </button>
                        </div>

                        <div className="flex items-center justify-between mb-6 text-sm">
                            <label className="flex items-center gap-2">
                                <input type="checkbox" className="accent-app-two" />
                                <span className="text-gray-500">Recuérdame</span>
                            </label>
                            <a href="#" className="text-app-one hover:text-app-two transition">
                                ¿Olvidaste tu contraseña?
                            </a>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-lg font-bold text-white bg-gradient-to-r from-app-one via-app-two to-app-three shadow-lg hover:from-app-two hover:to-app-one transition text-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            {loading && (
                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                            )}
                            {loading ? "INICIANDO SESIÓN..." : "INICIAR SESIÓN"}
                        </button>

                        <p className="text-center mt-6 text-sm text-gray-500">
                            <Link to="/" className="text-app-two hover:text-app-one font-semibold">
                                ← Volver al sitio
                            </Link>
                        </p>
                    </form>
                </div>

                {/* Mensaje de bienvenida */}
                <div className="hidden md:flex flex-1 flex-col justify-center items-center bg-gradient-to-br from-app-one via-app-two to-app-three text-white px-10 py-12 relative z-10">
                    <div className="max-w-md text-center">
                        <h2 className="text-3xl font-bold mb-4">¡Bienvenido!</h2>
                        <p className="text-lg opacity-90 mb-8">
                            Administra tus proyectos, tareas, usuarios y productos desde el panel de Appsline.
                        </p>
                        <img src={LogoAppsline} className="w-40 mx-auto drop-shadow-xl" alt="Appsline" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
