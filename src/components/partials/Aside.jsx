import { NavLink } from "react-router-dom";
import LogoHorizontal from "../../assets/images/appsline_logo_vertical.png"

const Aside = () => {
    return (
        <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col rounded-tr-3xl rounded-br-3xl shadow-lg overflow-hidden transition-all duration-300 md:relative z-20">
            <div className="h-20 flex items-center justify-center border-b border-gray-100 bg-white">
                <img src={LogoHorizontal} className="h-12 mx-auto block" alt="Logo Appsline" />
            </div>
            <nav className="flex-1 px-4 py-8">
                <ul className="space-y-2">
                    <li>
                        <NavLink to="/admin/dashboard" className={({isActive}) => `flex items-center gap-3 py-2 px-4 rounded-lg font-medium transition ${isActive ? 'bg-app-one text-white shadow' : 'text-app-one hover:bg-app-two/10'}` }>
                            <span className="inline-block"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg></span>
                            Dashboard
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/users" className={({isActive}) => `flex items-center gap-3 py-2 px-4 rounded-lg font-medium transition ${isActive ? 'bg-app-one text-white shadow' : 'text-app-one hover:bg-app-two/10'}` }>
                            <span className="inline-block"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg></span>
                            Users
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/projects" className={({isActive}) => `flex items-center gap-3 py-2 px-4 rounded-lg font-medium transition ${isActive ? 'bg-app-one text-white shadow' : 'text-app-one hover:bg-app-two/10'}` }>
                            <span className="inline-block"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg></span>
                            Projects
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/products" className={({isActive}) => `flex items-center gap-3 py-2 px-4 rounded-lg font-medium transition ${isActive ? 'bg-app-one text-white shadow' : 'text-app-one hover:bg-app-two/10'}` }>
                            <span className="inline-block"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg></span>
                            Products
                        </NavLink>
                    </li>
                </ul>
            </nav>
            <div className="mt-auto p-4 text-xs text-gray-400 text-center border-t border-gray-100">© Appsline 2025</div>
        </aside>
    )
}

export default Aside;