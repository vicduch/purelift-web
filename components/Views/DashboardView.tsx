import React from 'react';
import { Routine, Exercise, SetLog, WeeklyVolume } from '../../types';
import { Card } from '../UI/Card';
import { IconPlay } from '../Icons';
import ProgressChart from '../ProgressChart';

interface DashboardViewProps {
    user: any;
    routines: Routine[];
    activeRoutineId: string;
    exercises: Exercise[];
    allSets: SetLog[];
    coachInsight: string;
    onSwitchRoutine: (id: string) => void;
    onStartWorkout: (routineId?: string) => void;
    weeklyVolumes: WeeklyVolume[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
    user,
    routines,
    activeRoutineId,
    exercises,
    allSets,
    coachInsight,
    onSwitchRoutine,
    onStartWorkout,
    weeklyVolumes
}) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-slide-up">
            {/* AI Coach Insight - Full Width */}
            <section className="lg:col-span-12">
                <Card variant="glass" className="p-8 border-l-4 border-l-blue-500">
                    <div className="flex items-start gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
                            <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-black uppercase tracking-widest text-zinc-100">Coach Intelligence</h3>
                            <p className="text-zinc-400 leading-relaxed font-medium">{coachInsight}</p>
                        </div>
                    </div>
                </Card>
            </section>

            {/* Weekly Stats */}
            <section className="lg:col-span-8">
                <h3 className="text-xl font-black text-zinc-100 tracking-tight mb-6 flex items-center gap-2">
                    Weekly Volume
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase tracking-widest">Sets / Muscle</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {weeklyVolumes.map((vol) => (
                        <Card key={vol.muscle} className="p-5 flex flex-col justify-between h-32 hover:border-zinc-600 transition-colors">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{vol.muscle}</span>
                                {vol.count >= vol.goal && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
                            </div>
                            <div>
                                <div className="text-3xl font-black text-zinc-100">{vol.count}</div>
                                <div className="text-[10px] font-bold text-zinc-600">/ {vol.goal} Target</div>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-zinc-800 h-1 mt-3 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-zinc-100 transition-all duration-1000"
                                    style={{ width: `${Math.min((vol.count / vol.goal) * 100, 100)}%` }}
                                />
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Quick Start Routines */}
            <section className="lg:col-span-4 space-y-6">
                <h3 className="text-xl font-black text-zinc-100 tracking-tight mb-6">Quick Start</h3>
                <div className="space-y-4">
                    {routines.slice(0, 3).map((r, i) => (
                        <Card
                            key={r.id}
                            variant="interactive"
                            onClick={() => { onSwitchRoutine(r.id); onStartWorkout(r.id); }}
                            className="p-5 flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-5">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${i === 0 ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
                                    {r.name[0]}
                                </div>
                                <div>
                                    <div className="font-bold text-zinc-100 group-hover:text-white transition-colors uppercase tracking-tight">{r.name}</div>
                                    <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{r.exerciseIds.length} Exercises</div>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-100 group-hover:text-zinc-950 transition-colors">
                                <IconPlay className="w-3 h-3 ml-0.5" />
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Recent Progress Charts */}
            <section className="lg:col-span-12 pt-8 border-t border-zinc-900">
                <div className="flex justify-between items-end mb-8">
                    <h3 className="text-xl font-black text-zinc-100 tracking-tight">Recent Performance</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Weight Progression</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {exercises.filter(ex => allSets.some(s => s.exerciseId === ex.id && s.completed)).slice(0, 3).map(ex => {
                        const exSets = allSets
                            .filter(s => s.exerciseId === ex.id && s.completed)
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        const chartData = exSets.map(s => ({ date: s.date, weight: s.weight })); // Assuming chart handles its own sorting or is time-series aware

                        return (
                            <Card key={ex.id} className="p-6 bg-zinc-900 overflow-hidden">
                                <div className="mb-4 flex justify-between items-start">
                                    <div className="font-bold text-zinc-300">{ex.name}</div>
                                    <div className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded uppercase tracking-widest">{ex.muscleGroup}</div>
                                </div>
                                <div className="h-40 -mx-4">
                                    <ProgressChart data={chartData} exerciseName={ex.name} color="#fafafa" />
                                </div>
                            </Card>
                        );
                    })}

                    {exercises.filter(ex => allSets.some(s => s.exerciseId === ex.id && s.completed)).length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-3xl">
                            <p className="font-bold text-xs uppercase tracking-widest">No data available yet</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
