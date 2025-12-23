import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
    return (
        <div className="w-full space-y-2">
            {label && (
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}
            <div className="relative group">
                <input
                    className={`
            w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 
            text-zinc-100 placeholder:text-zinc-600 font-medium transition-all
            focus:outline-none focus:border-zinc-500 focus:bg-zinc-900 focus:ring-1 focus:ring-zinc-500
            hover:border-zinc-700
            ${error ? 'border-red-500/50 focus:border-red-500' : ''}
            ${className}
          `}
                    {...props}
                />
                {/* Glow effect on focus */}
                <div className="absolute inset-0 rounded-xl bg-zinc-500/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity -z-10" />
            </div>
            {error && <p className="text-xs text-red-500 font-medium ml-1">{error}</p>}
        </div>
    );
};
