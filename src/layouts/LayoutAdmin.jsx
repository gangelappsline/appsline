import { useEffect } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { useParams, useNavigate } from "react-router-dom";
import Aside from "../components/partials/Aside";
import LogoHorizontal from "../assets/images/appsline_logo_vertical.png"

const LayoutAdmin = ({ title, children }) => {
    const AppName = 'Appsline';
    const navigate = useNavigate();

    useEffect(() => {
        document.title = AppName + " " + title;
    }, [title]);

    const handleLogout = () => {
        localStorage.removeItem("user_token");
        navigate("/login");
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Aside/>
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-20 bg-white flex items-center justify-between px-8 shadow-sm border-b border-gray-100">
                    <div className="text-2xl font-bold text-app-one tracking-tight">Panel de Administración</div>
                    <div className="flex items-center gap-4">
                        <button className="bg-app-two text-app-one font-semibold py-2 px-5 rounded-lg shadow hover:bg-app-three hover:text-white transition">Acción</button>
                        <div className="w-10 h-10 rounded-full bg-app-one flex items-center justify-center text-white font-bold">A</div>
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