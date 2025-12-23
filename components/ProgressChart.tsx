
import React from 'react';

interface ProgressChartProps {
    data: { date: string; weight: number }[];
    exerciseName: string;
    color?: string;
}

const ProgressChart: React.FC<ProgressChartProps> = ({ data, exerciseName, color = '#fafafa' }) => {
    // Helper to convert hex to RGB for gradients would be nice, but simple opacity works for now if color is standard.
    // For now we'll stick to a white/zinc theme if color is not passed or specific.

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <div className="w-12 h-12 mb-3 bg-zinc-800 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">No data for {exerciseName}</p>
            </div>
        );
    }

    const maxWeight = Math.max(...data.map(d => d.weight));
    const minWeight = Math.min(...data.map(d => d.weight));
    const range = maxWeight - minWeight || 10;
    const chartHeight = 100;

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
                    <h4 className="text-sm font-black text-zinc-100 leading-none mb-1">{exerciseName}</h4>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">PR Evolution</p>
                </div>
                <div className="text-right">
                    <span className="text-lg font-black text-zinc-100 tracking-tighter" style={{ color: color }}>{recentData[recentData.length - 1].weight}kg</span>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Current</p>
                </div>
            </div>

            <div className="relative h-32 w-full pt-4">
                <svg viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id={`gradient-${exerciseName.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    <polyline
                        points={areaPoints}
                        fill={`url(#gradient-${exerciseName.replace(/\s+/g, '-')})`}
                        stroke="none"
                    />

                    <polyline
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-sm"
                    />

                    {recentData.map((d, i) => (
                        <circle
                            key={i}
                            cx={getX(i)}
                            cy={getY(d.weight)}
                            r="3"
                            fill="#18181b"
                            stroke={color}
                            strokeWidth="2"
                            className="transition-all duration-300 group-hover:r-4"
                        />
                    ))}
                </svg>

                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-4">
                    <div className="w-full border-t border-zinc-800 border-dashed"></div>
                    <div className="w-full border-t border-zinc-800 border-dashed"></div>
                    <div className="w-full border-t border-zinc-800 border-dashed"></div>
                </div>
            </div>

            <div className="flex justify-between px-1">
                {recentData.map((d, i) => (
                    <span key={i} className="text-[8px] font-bold text-zinc-600 uppercase">
                        {new Date(d.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default ProgressChart;
