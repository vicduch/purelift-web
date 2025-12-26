
import React, { useState, useEffect, useRef } from 'react';
import { playBeep } from '../utils/audio';

interface TimerProps {
  initialSeconds?: number;
  onClose: () => void;
}

const Timer: React.FC<TimerProps> = ({ initialSeconds = 90, onClose }) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      playBeep();
      setIsActive(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    if (timeLeft === 10 && isActive) {
      playBeep();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (timeLeft / initialSeconds) * 100;

  if (!isExpanded) {
    return (
      <div
        className="fixed bottom-24 md:bottom-8 right-6 z-[60] animate-slide-up"
        onClick={() => setIsExpanded(true)}
      >
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full cursor-pointer hover:bg-zinc-800 transition-all shadow-xl flex items-center space-x-3 group">
          <div className="relative w-6 h-6 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="transparent"
                className="text-white transition-all duration-1000 opacity-40"
                strokeDasharray={62.8}
                strokeDashoffset={62.8 - (62.8 * progress) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center ${timeLeft < 10 ? 'animate-pulse text-red-500' : ''}`}>
              <div className="w-1 h-1 bg-white rounded-full"></div>
            </div>
          </div>
          <span className={`text-sm font-black tracking-tighter ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {formatTime(timeLeft)}
          </span>
          <div className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8h16M4 16h16" /></svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] md:inset-auto md:bottom-24 md:right-8 animate-slide-up flex items-center justify-center pointer-events-none md:block">
      <div
        className="bg-[#0f172a] text-white p-8 rounded-[3rem] shadow-2xl shadow-blue-500/20 border border-white/5 flex flex-col items-center space-y-6 min-w-[300px] relative overflow-hidden pointer-events-auto"
      >
        <div className="absolute top-6 right-8">
          <button
            onClick={() => setIsExpanded(false)}
            className="p-2 text-white/40 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        {/* Background Glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl"></div>

        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* SVG Progress Circle */}
          <svg className="w-full h-full -rotate-90">
            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent"
              className="text-blue-500 transition-all duration-1000"
              strokeDasharray={364.4}
              strokeDashoffset={364.4 - (364.4 * progress) / 100}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-[900] tracking-tighter">{formatTime(timeLeft)}</span>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1">Repos</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 w-full">
          <button
            onClick={() => setTimeLeft(prev => prev + 30)}
            className="flex-1 h-14 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-sm font-black transition-all border border-white/5 active:scale-95"
          >
            +30s
          </button>
          <button
            onClick={() => setTimeLeft(prev => Math.max(0, prev - 30))}
            className="flex-1 h-14 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-sm font-black transition-all border border-white/5 active:scale-95"
          >
            -30s
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full h-16 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          Reprendre l'effort
        </button>
      </div>
    </div>
  );
};

export default Timer;
