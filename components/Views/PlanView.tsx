import React, { useState } from 'react';
import { Routine, Exercise, MuscleGroup, UserSettings } from '../../types';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { IconSettings, IconPlus } from '../Icons';

interface PlanViewProps {
    routines: Routine[];
    exercises: Exercise[];
    activeRoutineId: string;
    onSelectRoutine: (id: string) => void;
    onUpdateRoutine: (routine: Routine) => void;
    onDeleteRoutine: (id: string) => void;
    onCreateRoutineAI: (input: string) => Promise<void>;
    isGeneratingAI: boolean;
    volumeGoals: Record<MuscleGroup, number>;
    defaultRestTime: number;
    onUpdateSettings: (settings: Partial<UserSettings>) => void;
}

export const PlanView: React.FC<PlanViewProps> = ({
    routines,
    exercises,
    activeRoutineId,
    onSelectRoutine,
    onUpdateRoutine,
    onDeleteRoutine,
    onCreateRoutineAI,
    isGeneratingAI,
    volumeGoals,
    defaultRestTime,
    onUpdateSettings
}) => {
    const [customInput, setCustomInput] = useState("");
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup | 'All'>('All');

    const activeRoutine = routines.find(r => r.id === activeRoutineId) || routines[0];

    return (
        <div className="space-y-12 animate-slide-up">

            {/* Routine Selector & AI Generation */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Routine List */}
                <div className="lg:col-span-4 space-y-4">
                    <h3 className="text-xl font-black text-zinc-100 tracking-tight px-2">Your Routines</h3>
                    <div className="space-y-3">
                        {routines.map(r => (
                            <Card
                                key={r.id}
                                variant={activeRoutineId === r.id ? 'default' : 'interactive'}
                                onClick={() => onSelectRoutine(r.id)}
                                className={`p-4 flex items-center justify-between group ${activeRoutineId === r.id ? 'border-zinc-100 bg-zinc-800' : ''}`}
                            >
                                <div>
                                    <div className={`font-bold uppercase tracking-tight ${activeRoutineId === r.id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{r.name}</div>
                                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{r.exerciseIds.length} Exercises</div>
                                </div>
                                {activeRoutineId === r.id && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteRoutine(r.id); }}
                                        className="text-zinc-600 hover:text-red-500 transition-colors p-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </Card>
                        ))}
                        <div className="pt-4">
                            <div className="relative group">
                                <Input
                                    placeholder="Describe a new routine..."
                                    value={customInput}
                                    onChange={(e) => setCustomInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && onCreateRoutineAI(customInput)}
                                />
                                <div className="absolute right-2 top-1.5 md:top-2">
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => onCreateRoutineAI(customInput)}
                                        isLoading={isGeneratingAI}
                                        disabled={!customInput.trim()}
                                    >
                                        Generate
                                    </Button>
                                </div>
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-2 ml-2 font-medium">✨ Powered by Gemini AI. Try "Legs and Core focus"</p>
                        </div>
                    </div>
                </div>

                {/* Routine Editor */}
                <div className="lg:col-span-8">
                    <Card className="p-8 min-h-[600px]">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Editing</span>
                                <h2 className="text-3xl font-black text-white tracking-tighter mt-1">{activeRoutine?.name}</h2>
                            </div>
                            {/* Muscle Filter */}
                            <div className="flex gap-2">
                                <select
                                    className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-widest rounded-xl px-4 py-2 focus:outline-none focus:border-zinc-600"
                                    value={selectedMuscleGroup}
                                    onChange={(e) => setSelectedMuscleGroup(e.target.value as MuscleGroup | 'All')}
                                >
                                    <option value="All">All Muscles</option>
                                    {Object.values(MuscleGroup).map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {exercises
                                .filter(ex => selectedMuscleGroup === 'All' || ex.muscleGroup === selectedMuscleGroup)
                                .map(ex => {
                                    const isSelected = activeRoutine?.exerciseIds.includes(ex.id);
                                    return (
                                        <div
                                            key={ex.id}
                                            className={`
                              relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer group
                              ${isSelected
                                                    ? 'bg-zinc-800 border-zinc-600'
                                                    : 'bg-zinc-950/50 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900'}
                           `}
                                            onClick={() => {
                                                const newIds = isSelected
                                                    ? activeRoutine.exerciseIds.filter(id => id !== ex.id)
                                                    : [...activeRoutine.exerciseIds, ex.id];

                                                // Add default targets if adding
                                                let newTargets = { ...activeRoutine.targets };
                                                if (!isSelected) {
                                                    newTargets[ex.id] = { sets: 3, reps: 10 };
                                                }

                                                onUpdateRoutine({
                                                    ...activeRoutine,
                                                    exerciseIds: newIds,
                                                    targets: newTargets
                                                });
                                            }}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black ${isSelected ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-900 text-zinc-600'}`}>
                                                        {ex.name[0]}
                                                    </div>
                                                    <div>
                                                        <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{ex.name}</div>
                                                        <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{ex.muscleGroup}</div>
                                                    </div>
                                                </div>
                                                {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>}
                                            </div>

                                            {isSelected && (
                                                <div className="mt-4 pt-4 border-t border-white/5 flex gap-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex-1">
                                                        <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Sets</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:border-blue-500 focus:outline-none"
                                                            value={activeRoutine.targets?.[ex.id]?.sets || 3}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                onUpdateRoutine({
                                                                    ...activeRoutine,
                                                                    targets: {
                                                                        ...activeRoutine.targets,
                                                                        [ex.id]: { ...(activeRoutine.targets?.[ex.id] || { reps: 10 }), sets: val }
                                                                    }
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Reps</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-center text-white font-bold text-xs focus:border-blue-500 focus:outline-none"
                                                            value={activeRoutine.targets?.[ex.id]?.reps || 10}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                onUpdateRoutine({
                                                                    ...activeRoutine,
                                                                    targets: {
                                                                        ...activeRoutine.targets,
                                                                        [ex.id]: { ...(activeRoutine.targets?.[ex.id] || { sets: 3 }), reps: val }
                                                                    }
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </Card>
                </div>
            </section>

            {/* Settings Section */}
            <section className="bg-zinc-900/30 rounded-[2.5rem] border border-zinc-800 p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center">
                        <IconSettings className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">System Configuration</h3>
                        <p className="text-zinc-500 text-xs font-medium">Fine-tune your progressive overload parameters.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-4">
                        <h4 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Weekly Sets Targets</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {Object.values(MuscleGroup).map(muscle => (
                                <div key={muscle} className="bg-zinc-950 border border-white/5 rounded-xl p-3 flex flex-col justify-between hover:border-zinc-700 transition-colors">
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{muscle}</span>
                                    <input
                                        type="number"
                                        className="bg-transparent text-xl font-black text-white focus:outline-none w-full mt-1"
                                        value={volumeGoals[muscle] || 15}
                                        onChange={(e) => onUpdateSettings({ volumeGoals: { ...volumeGoals, [muscle]: parseInt(e.target.value) || 0 } })}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Rest Engine</h4>
                        <Card className="p-6 bg-zinc-950 flex flex-col items-center justify-center text-center space-y-4 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Base Rest Timer</span>
                            <div className="flex items-baseline justify-center gap-2">
                                <input
                                    type="number" step="15"
                                    className="bg-transparent text-4xl font-black text-white text-center w-24 focus:outline-none"
                                    value={defaultRestTime}
                                    onChange={(e) => onUpdateSettings({ defaultRestTime: parseInt(e.target.value) || 90 })}
                                />
                                <span className="text-sm font-bold text-zinc-600">sec</span>
                            </div>
                        </Card>
                    </div>
                </div>
            </section>
        </div>
    );
};
