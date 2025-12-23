
import React from 'react';

interface ProgressChartProps {
    data: { date: string; weight: number }[];
    exerciseName: string;
}

const ProgressChart: React.FC<ProgressChartProps> = ({ data, exerciseName }) => {
    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <div className="w-12 h-12 mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aucune donnée pour {exerciseName}</p>
            </div>
        );
    }

    const maxWeight = Math.max(...data.map(d => d.weight));
    const minWeight = Math.min(...data.map(d => d.weight));
    const range = maxWeight - minWeight || 10; // Default range if flat
    const chartHeight = 100;

    // Take last 7 sessions for a cleaner look
    const recentData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-7);

    const getX = (i: number) => (i / (recentData.length - 1 || 1)) * 100;
    const getY = (w: number) => {
        const padding = 20;
        return padding + (chartHeight - padding * 2) * (1 - (w - minWeight) / range);
    };

    const points = recentData.map((d, i) => `${getX(i)},${getY(d.weight)}`).join(' ');
    const areaPoints = `0,${chartHeight} ` + points + ` 100,${chartHeight}`;

    return (
        <div className="space-y-4 group">
            <div className="flex justify-between items-end">
                <div>
                    <h4 className="text-sm font-black text-slate-900 leading-none mb-1">{exerciseName}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Évolution du PR</p>
                </div>
                <div className="text-right">
                    <span className="text-lg font-black text-blue-600 tracking-tighter">{recentData[recentData.length - 1].weight}kg</span>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Actuel</p>
                </div>
            </div>

            <div className="relative h-32 w-full pt-4">
                <svg viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id={`gradient-${exerciseName.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Area under the line */}
                    <polyline
                        points={areaPoints}
                        fill={`url(#gradient-${exerciseName.replace(/\s+/g, '-')})`}
                        stroke="none"
                    />

                    {/* Main Line */}
                    <polyline
                        points={points}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-sm"
                    />

                    {/* Interaction Points */}
                    {recentData.map((d, i) => (
                        <circle
                            key={i}
                            cx={getX(i)}
                            cy={getY(d.weight)}
                            r="3"
                            fill="white"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            className="transition-all duration-300 group-hover:r-4"
                        />
                    ))}
                </svg>

                {/* Horizontal Guide Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-4">
                    <div className="w-full border-t border-slate-100 border-dashed"></div>
                    <div className="w-full border-t border-slate-100 border-dashed"></div>
                    <div className="w-full border-t border-slate-100 border-dashed"></div>
                </div>
            </div>

            <div className="flex justify-between px-1">
                {recentData.map((d, i) => (
                    <span key={i} className="text-[8px] font-bold text-slate-300 uppercase">
                        {new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default ProgressChart;
