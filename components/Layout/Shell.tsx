import React from 'react';
import { IconDashboard, IconPlay, IconSettings } from '../Icons';

interface ShellProps {
    children: React.ReactNode;
    activeTab: 'dashboard' | 'workout' | 'plan';
    onTabChange: (tab: 'dashboard' | 'workout' | 'plan') => void;
    user?: any;
    onSignOut?: () => void;
    onSignIn?: () => void;
}

export const Shell: React.FC<ShellProps> = ({
    children,
    activeTab,
    onTabChange,
    user,
    onSignOut,
    onSignIn
}) => {
    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-700 selection:text-white">
            {/* Desktop Sidebar (Slim, Acrylic) */}
            <nav className="hidden md:flex flex-col w-20 h-screen sticky top-0 border-r border-white/5 bg-zinc-950/80 backdrop-blur-xl z-50 items-center py-8">
                <div className="mb-8">
                    <div className="w-10 h-10 bg-gradient-to-br from-zinc-100 to-zinc-400 rounded-xl flex items-center justify-center text-zinc-950 font-black text-lg shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                        PL
                    </div>
                </div>

                <div className="flex-1 w-full flex flex-col items-center space-y-6 px-2">
                    <NavButton
                        active={activeTab === 'dashboard'}
                        onClick={() => onTabChange('dashboard')}
                        icon={<IconDashboard className="w-5 h-5" />}
                        label="Dashboard"
                    />
                    <NavButton
                        active={activeTab === 'workout'}
                        onClick={() => onTabChange('workout')}
                        icon={<IconPlay className="w-5 h-5" />}
                        label="Workout"
                    />
                    <NavButton
                        active={activeTab === 'plan'}
                        onClick={() => onTabChange('plan')}
                        icon={<IconSettings className="w-5 h-5" />}
                        label="Planifier"
                    />
                </div>

                <div className="mt-auto flex flex-col items-center space-y-4 pb-4">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10">
                        {/* User Avatar Placeholder */}
                    </div>
                    {user ? (
                        <button
                            onClick={onSignOut}
                            className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors"
                        >
                            Exit
                        </button>
                    ) : (
                        <button
                            onClick={onSignIn}
                            className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                        >
                            Login
                        </button>
                    )}
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 w-full min-w-0 pb-24 md:pb-0">
                {children}
            </main>

            {/* Mobile Bottom Tab Bar (Floating, Blur) */}
            <nav className="md:hidden fixed bottom-6 left-4 right-4 h-16 bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-full flex justify-around items-center px-2 z-50 shadow-2xl shadow-black/50">
                <MobileNavButton
                    active={activeTab === 'dashboard'}
                    onClick={() => onTabChange('dashboard')}
                    icon={<IconDashboard className="w-5 h-5" />}
                    label="Stats"
                />
                <div className="relative -top-6">
                    <button
                        onClick={() => onTabChange('workout')}
                        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${activeTab === 'workout' ? 'bg-zinc-100 text-zinc-950 shadow-white/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}
                    >
                        <IconPlay className="w-6 h-6 fill-current" />
                    </button>
                </div>
                <MobileNavButton
                    active={activeTab === 'plan'}
                    onClick={() => onTabChange('plan')}
                    icon={<IconSettings className="w-5 h-5" />}
                    label="Plan"
                />
            </nav>
        </div>
    );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`group relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${active ? 'bg-zinc-800 text-white shadow-lg shadow-black/20' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}
    >
        {icon}
        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />}

        {/* Tooltip */}
        <div className="absolute left-14 px-3 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
            {label}
        </div>
    </button>
);

const MobileNavButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center space-y-1 transition-all w-16 ${active ? 'text-white' : 'text-zinc-500'}`}
    >
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
);
