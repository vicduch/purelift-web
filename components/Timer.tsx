
import React, { useState, useEffect, useRef } from 'react';
import { playBeep } from '../utils/audio';

interface TimerProps {
  initialSeconds?: number;
  onClose: () => void;
}

const Timer: React.FC<TimerProps> = ({ initialSeconds = 90, onClose }) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);
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

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-24 right-4 md:right-8 z-50 animate-bounce-in">
      <div className="glass text-slate-900 px-6 py-4 rounded-3xl flex items-center space-x-6 shadow-2xl border border-white/50">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Resting</span>
          <div className="text-2xl font-mono font-black text-blue-600">
            {formatTime(timeLeft)}
          </div>
        </div>
        <div className="h-10 w-px bg-slate-200" />
        <div className="flex space-x-3">
          <button
            onClick={() => setTimeLeft(prev => prev + 30)}
            className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg font-bold hover:bg-slate-200 transition-colors"
          >
            +
          </button>
          <button
            onClick={() => setTimeLeft(prev => Math.max(0, prev - 30))}
            className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg font-bold hover:bg-slate-200 transition-colors"
          >
            -
          </button>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center font-bold hover:bg-red-200 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
      <style>{`
        @keyframes bounceIn { 
          0% { transform: translateY(100px); opacity: 0; }
          60% { transform: translateY(-10px); opacity: 1; }
          100% { transform: translateY(0); }
        }
        .animate-bounce-in { animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      `}</style>
    </div>
  );
};

export default Timer;
