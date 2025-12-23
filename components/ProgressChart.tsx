
import React from 'react';

interface ProgressChartProps {
    data: { date: string; weight: number }[];
    exerciseName: string;
}

const ProgressChart: React.FC<ProgressChartProps> = ({ data, exerciseName }) => {
    if (data.length === 0) {
        return (
            <div className="text-center text-slate-400 py-8 text-sm">
                Pas encore de données pour {exerciseName}
            </div>
        );
    }

    const maxWeight = Math.max(...data.map(d => d.weight));
    const minWeight = Math.min(...data.map(d => d.weight));
    const range = maxWeight - minWeight || 1;
    const chartHeight = 120;
    const chartWidth = 100; // percentage

    // Take last 10 sessions
    const recentData = data.slice(0, 10).reverse();

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>{exerciseName}</span>
                <span>Max: {maxWeight}kg</span>
            </div>
            <div className="relative bg-slate-50 rounded-xl p-4" style={{ height: chartHeight + 40 }}>
                {/* Y-axis labels */}
                <div className="absolute left-0 top-4 bottom-8 w-8 flex flex-col justify-between text-[10px] text-slate-400 font-medium">
                    <span>{maxWeight}kg</span>
                    <span>{minWeight}kg</span>
                </div>

                {/* Chart area */}
                <div className="ml-10 h-full relative">
                    <svg width="100%" height={chartHeight} className="overflow-visible">
                        {/* Line */}
                        <polyline
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={recentData.map((d, i) => {
                                const x = (i / (recentData.length - 1 || 1)) * 100;
                                const y = chartHeight - ((d.weight - minWeight) / range) * (chartHeight - 20);
                                return `${x}%,${y}`;
                            }).join(' ')}
                        />

                        {/* Points */}
                        {recentData.map((d, i) => {
                            const x = (i / (recentData.length - 1 || 1)) * 100;
                            const y = chartHeight - ((d.weight - minWeight) / range) * (chartHeight - 20);
                            return (
                                <circle
                                    key={i}
                                    cx={`${x}%`}
                                    cy={y}
                                    r="5"
                                    fill="#3b82f6"
                                    stroke="white"
                                    strokeWidth="2"
                                />
                            );
                        })}
                    </svg>

                    {/* X-axis labels */}
                    <div className="flex justify-between mt-2 text-[9px] text-slate-400">
                        {recentData.map((d, i) => (
                            <span key={i}>{new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgressChart;
