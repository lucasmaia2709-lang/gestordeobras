import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    List,
    CalendarBlank,
    CheckSquare,
    CurrencyDollar,
    Buildings,
    SignOut,
    UserCircle,
    HardHat,
    CaretLeft,
    Flag,
    Users
} from '@phosphor-icons/react';
// Fix clsx import if needed, assuming it's default
import clsx from 'clsx';

export const AppShell: React.FC = () => {
    const { user, profile, logout } = useAuth();
    const location = useLocation();

    // Extract project ID from path: /project/:id/...
    const projectMatch = location.pathname.match(/\/project\/([^\/]+)/);
    const projectId = projectMatch ? projectMatch[1] : null;
    const isProjectSelected = !!projectId;

    const projectNavItems = [
        { path: `/project/${projectId}/calendar`, icon: CalendarBlank, label: 'Calendário' },
        { path: `/project/${projectId}/checklist`, icon: CheckSquare, label: 'Checklist', roles: ['master', 'user'] },
        { path: `/project/${projectId}/financial`, icon: CurrencyDollar, label: 'Financeiro' },
        { path: `/project/${projectId}/benchmarks`, icon: Flag, label: 'Balizamentos' },
        { path: `/project/${projectId}/companies`, icon: Buildings, label: 'Cadastros', roles: ['master', 'user'] },
    ];

    const handleLogout = async () => {
        if (confirm('Deseja sair?')) {
            await logout();
        }
    };

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex w-72 bg-white border-r border-gray-200 flex-col z-20 shadow-sm">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-ios-blue rounded-xl flex items-center justify-center text-gray-900 shadow-yellow-200 shadow-lg">
                        <HardHat size={24} weight="fill" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-none">ObraApp</h1>
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                            {profile?.role || 'Guest'}
                        </span>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                    {/* General Nav */}
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) => clsx(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                            isActive ? "bg-ios-blue text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        <List size={20} weight="bold" />
                        <span>Minhas Obras</span>
                    </NavLink>

                    {profile?.role === 'master' && (
                        <NavLink
                            to="/team"
                            className={({ isActive }) => clsx(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                                isActive ? "bg-ios-blue text-gray-900 shadow-md shadow-yellow-200" : "text-gray-600 hover:bg-gray-50"
                            )}
                        >
                            <Users size={20} weight="bold" />
                            <span>Gerir Equipe</span>
                        </NavLink>
                    )}

                    {isProjectSelected && (
                        <>
                            <div className="my-4 border-t border-gray-100 mx-2"></div>
                            <p className="px-4 text-xs font-bold text-gray-400 uppercase mb-2">Projeto Atual</p>

                            {projectNavItems.map((item) => {
                                if (item.roles && !item.roles.includes(profile?.role || '')) return null;
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) => clsx(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                                            isActive ? "bg-ios-blue text-gray-900 shadow-md shadow-yellow-200" : "text-gray-600 hover:bg-gray-50"
                                        )}
                                    >
                                        <item.icon size={20} weight={location.pathname.endsWith(item.path) ? "fill" : "regular"} />
                                        <span>{item.label}</span>
                                    </NavLink>
                                );
                            })}
                        </>
                    )}
                </nav>

                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                                <UserCircle size={24} weight="fill" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-700 truncate">{user?.email}</p>
                                <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 font-medium">
                                    Sair da conta
                                </button>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                            <SignOut size={20} weight="bold" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Mobile Header */}
                <header className="md:hidden bg-white/80 backdrop-blur-md border-b border-gray-200 h-14 flex items-center justify-between px-4 sticky top-0 z-30">
                    <div className="flex items-center gap-2">
                        <HardHat size={24} weight="fill" className="text-ios-blue" />
                        <span className="font-bold text-gray-800">ObraApp</span>
                    </div>
                    <button onClick={handleLogout} className="text-gray-400">
                        <SignOut size={24} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto pb-24 md:pb-0 scroll-smooth">
                    <Outlet />
                </div>

                {/* Mobile Bottom Tab Bar */}
                {isProjectSelected && (
                    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-40 flex justify-around items-center h-20 px-2 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                        <NavLink to="/" end className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-gray-600 active:scale-95 transition-transform">
                            <CaretLeft size={24} weight="bold" />
                            <span className="text-[10px] font-medium mt-1">Voltar</span>
                        </NavLink>

                        {projectNavItems.map((item) => {
                            if (item.roles && !item.roles.includes(profile?.role || '')) return null;
                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) => clsx(
                                        "flex flex-col items-center justify-center w-full h-full transition-all active:scale-95",
                                        isActive ? "text-ios-blue" : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    <item.icon size={24} weight={location.pathname.endsWith(item.path) ? "fill" : "regular"} />
                                    <span className="text-[10px] font-medium mt-1">{item.label}</span>
                                </NavLink>
                            );
                        })}
                    </nav>
                )}
            </main>
        </div>
    );
};
