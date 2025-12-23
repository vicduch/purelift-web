import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    variant?: 'default' | 'glass' | 'interactive';
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, variant = 'default' }) => {
    const baseStyles = "relative rounded-3xl border transition-all duration-300";
    const variants = {
        default: "bg-zinc-900 border-zinc-800 text-zinc-100 shadow-xl",
        glass: "bg-zinc-900/60 backdrop-blur-xl border-white/5 text-white shadow-2xl",
        interactive: "bg-zinc-900 border-zinc-800 text-zinc-100 shadow-xl hover:border-zinc-700 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] cursor-pointer"
    };

    return (
        <div
            className={`${baseStyles} ${variants[variant]} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};
