import React, { useState } from 'react';
import { Routine, Exercise, SetLog } from '../../types';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { IconPlay, IconPlus, IconSwap } from '../Icons';

interface WorkoutViewProps {
    activeRoutine: Routine | undefined;
    exercises: Exercise[];
    currentSessionSets: SetLog[];
    onStartWorkout: () => void;
    onAddCustomExercise: (input: string) => Promise<void>;
    onCompleteSet: (setId: string) => void;
    onUpdateSet: (setId: string, field: 'reps' | 'weight', value: number) => void;
    onFinishWorkout: () => void;
    onSwapExercise: (ex: Exercise) => void;
    timerDuration: number;
    isAnalyzing: boolean;
    history: SetLog[];
}

export const WorkoutView: React.FC<WorkoutViewProps> = ({
    activeRoutine,
    exercises,
    currentSessionSets,
    onStartWorkout,
    onAddCustomExercise,
    onCompleteSet,
    onUpdateSet,
    onFinishWorkout,
    onSwapExercise,
    timerDuration,
    isAnalyzing,
    history
}) => {
    const [customInput, setCustomInput] = useState("");

    const activeExercises = Array.from(new Set(currentSessionSets.map(s => s.exerciseId)));

    if (currentSessionSets.length === 0) {
        return (
            <div className="max-w-xl mx-auto py-20 animate-slide-up">
                <Card className="p-12 text-center space-y-8 bg-zinc-900 border-zinc-800 shadow-2xl">
                    <div className="w-24 h-24 mx-auto bg-zinc-800 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                        <IconPlay className="w-10 h-10 text-white ml-1" />
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-3xl font-black text-white tracking-tighter">Ready for {activeRoutine?.name || 'Workout'}?</h2>
                        <p className="text-zinc-500 font-medium">Focus mode enabled. No distractions.</p>
                    </div>
                    <Button
                        size="lg"
                        variant="primary"
                        className="w-full h-16 text-sm"
                        onClick={onStartWorkout}
                    >
                        START SESSION
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-32 animate-slide-up">
            {/* Quick Add */}
            <div className="relative group z-10">
                <input
                    type="text"
                    placeholder="Add exercise on the fly..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-full px-6 py-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all shadow-xl"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onAddCustomExercise(customInput)}
                />
                <button
                    className="absolute right-2 top-2 p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors"
                    onClick={() => onAddCustomExercise(customInput)}
                    disabled={isAnalyzing}
                >
                    {isAnalyzing ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <IconPlus className="w-5 h-5 text-white" />}
                </button>
            </div>

            {/* Active Exercises */}
            <div className="space-y-6">
                {activeExercises.map(exId => {
                    const ex = exercises.find(e => e.id === exId);
                    const sets = currentSessionSets.filter(s => s.exerciseId === exId);
                    if (!ex) return null;

                    return (
                        <Card key={exId} className="overflow-hidden bg-zinc-950 border-zinc-800">
                            {/* Header */}
                            <div className="px-6 py-6 bg-zinc-900/50 border-b border-white/5 flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight">{ex.name}</h3>
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900 px-2 py-1 rounded inline-block mt-2">{ex.muscleGroup}</span>
                                </div>
                                <button onClick={() => onSwapExercise(ex)} className="text-zinc-600 hover:text-white transition-colors">
                                    <IconSwap className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Sets Grid */}
                            <div className="p-4 space-y-2">
                                <div className="grid grid-cols-12 gap-4 text-[9px] font-black text-zinc-600 uppercase tracking-widest px-4 mb-2">
                                    <div className="col-span-2">Set</div>
                                    <div className="col-span-4 text-center">KG</div>
                                    <div className="col-span-4 text-center">Reps</div>
                                    <div className="col-span-2 text-center">Done</div>
                                </div>

                                {sets.map((set, idx) => (
                                    <div key={set.id} className={`grid grid-cols-12 gap-4 items-center bg-zinc-900/40 rounded-xl p-2 border ${set.completed ? 'border-green-500/20 bg-green-500/5' : 'border-transparent'}`}>
                                        <div className="col-span-2 flex justify-center">
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                                                {idx + 1}
                                            </div>
                                        </div>
                                        <div className="col-span-4">
                                            <input
                                                type="number"
                                                className="w-full bg-transparent text-center font-black text-lg text-white focus:outline-none border-b border-transparent focus:border-zinc-600"
                                                value={set.weight}
                                                onChange={(e) => onUpdateSet(set.id, 'weight', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="col-span-4 flex items-center justify-center gap-1">
                                            <input
                                                type="number"
                                                className="w-12 bg-transparent text-right font-black text-lg text-white focus:outline-none border-b border-transparent focus:border-zinc-600"
                                                value={set.reps}
                                                onChange={(e) => onUpdateSet(set.id, 'reps', parseFloat(e.target.value) || 0)}
                                            />
                                            <span className="text-zinc-600 text-xs font-bold">/ {set.targetReps}</span>
                                        </div>
                                        <div className="col-span-2 flex justify-center">
                                            <button
                                                onClick={() => onCompleteSet(set.id)}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${set.completed ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-zinc-800 text-zinc-600 hover:bg-zinc-700 hover:text-white'}`}
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Add Set Button (Optional, could add later) */}
                            </div>
                        </Card>
                    );
                })}
            </div>

            <div className="pt-8 pb-32 flex justify-center">
                <Button
                    variant="primary"
                    size="lg"
                    onClick={onFinishWorkout}
                    className="w-full md:w-auto shadow-2xl shadow-green-500/20 bg-zinc-100 hover:bg-white text-zinc-950"
                >
                    FINISH WORKOUT
                </Button>
            </div>
        </div>
    );
};
