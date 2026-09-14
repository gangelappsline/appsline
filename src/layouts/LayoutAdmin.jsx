import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Aside from "../components/partials/Aside";
import { useAuth } from "../routes/AuthContext";

const LayoutAdmin = ({ title, children }) => {
    const AppName = 'Appsline';
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    useEffect(() => {
        document.title = AppName + " " + (title || "");
    }, [title]);

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    const userName = user?.name || "Admin";
    const userInitial = userName.charAt(0).toUpperCase();

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Aside />
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-20 bg-white flex items-center justify-between px-8 shadow-sm border-b border-gray-100">
                    <div className="text-2xl font-bold text-app-one tracking-tight">Panel de Administración</div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col items-end leading-tight">
                            <span className="font-semibold text-app-one">{userName}</span>
                            {user?.email && (
                                <span className="text-xs text-gray-400">{user.email}</span>
                            )}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-app-one flex items-center justify-center text-white font-bold" title={userName}>
                            {userInitial}
                        </div>
                        <button
                            onClick={handleLogout}
                            className="ml-2 bg-red-100 text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-200 transition"
                        >
                            Cerrar sesión
                        </button>
                    </div>
                </header>
                <main className="flex-1 p-6 md:p-10 bg-gray-50 overflow-x-auto">
                    <div className="">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}

export default LayoutAdmin;
