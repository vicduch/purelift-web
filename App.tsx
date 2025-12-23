import React, { useState, useEffect, useMemo } from 'react';
import { MuscleGroup, Exercise, SetLog, WeeklyVolume, Routine, UserSettings, DEFAULT_VOLUME_GOALS } from './types';
import { getExercises, getSets, getRoutines, saveSets, saveExercise, saveRoutines, signInWithGoogle, signOut, seedDefaultData, getUserSettings, saveUserSettings, deleteRoutine } from './supabaseStore';
import { supabase } from './supabaseClient';
import { getCoachInsight, analyzeExercise, getExerciseAlternatives, getFormTips, generateRoutine } from './services/geminiService';

// Layout & UI
import { Shell } from './components/Layout/Shell';
import { DashboardView } from './components/Views/DashboardView';
import { WorkoutView } from './components/Views/WorkoutView';
import { PlanView } from './components/Views/PlanView';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workout' | 'plan'>('dashboard');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [allSets, setAllSets] = useState<SetLog[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeRoutineId, setLocalActiveRoutineId] = useState<string>("");

  const [isTimerVisible, setIsTimerVisible] = useState(false);
  const [coachInsight, setCoachInsight] = useState<string>("Analyzing your stats for the week...");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [customInput, setCustomInput] = useState("");

  // Swap State (Logic kept here for now, or could be in View if strictly UI)
  const [swappingExerciseId, setSwappingExerciseId] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<{ name: string; reason: string }[]>([]);
  const [isFindingAlternatives, setIsFindingAlternatives] = useState(false);

  const [currentSessionSets, setCurrentSessionSets] = useState<SetLog[]>([]);
  const [volumeGoals, setVolumeGoals] = useState<Record<MuscleGroup, number>>(DEFAULT_VOLUME_GOALS);
  const [defaultRestTime, setDefaultRestTime] = useState<number>(90);

  // Form Tips State - Currently unused in new Views or moved to local view state? 
  // We'll keep it simple: DashboardView might handle its own tips if we moved it there, 
  // but looking at DashboardView code, it doesn't seem to implement the full tips logic yet, 
  // OR strictly passing props.
  // Actually, DashboardView implementation I wrote DOES NOT include the Tips popup logic. 
  // It only has the "Quick Start" and "Progress". 
  // The WorkoutView I wrote DOES NOT include the swap logic fully (it has the button but relies on parent for logic).
  // Let's ensure top-level logic handles mostly data.

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadData = async () => {
    if (!session) return;
    try {
      const { exercises: exs, routines: rts } = await seedDefaultData();
      const sts = await getSets();
      const settings = await getUserSettings();
      setExercises(exs);
      setAllSets(sts);
      setRoutines(rts);
      if (settings) {
        setVolumeGoals(settings.volumeGoals);
        setDefaultRestTime(settings.defaultRestTime);
      }
      if (rts.length > 0 && !activeRoutineId) setLocalActiveRoutineId(rts[0].id);
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const activeRoutine = useMemo(() =>
    routines.find(r => r.id === activeRoutineId) || routines[0]
    , [routines, activeRoutineId]);

  const weeklyVolumes = useMemo(() => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const volumes: Record<string, number> = {};
    Object.values(MuscleGroup).forEach(m => volumes[m] = 0);

    allSets.filter(s => s.completed && new Date(s.date) >= startOfWeek).forEach(s => {
      const ex = exercises.find(e => e.id === s.exerciseId);
      if (ex) volumes[ex.muscleGroup]++;
    });

    return Object.entries(volumes).map(([muscle, count]) => ({
      muscle: muscle as MuscleGroup,
      count,
      goal: volumeGoals[muscle as MuscleGroup] || 15
    })) as WeeklyVolume[];
  }, [allSets, exercises, volumeGoals]);

  useEffect(() => {
    if (weeklyVolumes.length > 0 && activeTab === 'dashboard') {
      getCoachInsight(weeklyVolumes).then(setCoachInsight);
    }
  }, [weeklyVolumes, activeTab]);

  // --- Actions ---

  const handleAddCustomExercise = async (input: string) => {
    if (!input.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    const result = await analyzeExercise(input);

    let exerciseToUse = exercises.find(e => e.name.toLowerCase() === result.name.toLowerCase());
    if (!exerciseToUse) {
      exerciseToUse = {
        id: Math.random().toString(36).substr(2, 9),
        name: result.name,
        muscleGroup: result.muscleGroup,
        referenceWeight: result.suggestedWeight
      };
      await saveExercise(exerciseToUse);
      setExercises(prev => [...prev, exerciseToUse!]);
    }

    // Add to current workout
    if (activeTab === 'workout' || currentSessionSets.length > 0) {
      const newSets: SetLog[] = [];
      for (let i = 0; i < 3; i++) {
        newSets.push({
          id: Math.random().toString(36).substr(2, 9),
          exerciseId: exerciseToUse!.id,
          date: new Date().toISOString(),
          weight: exerciseToUse!.referenceWeight,
          reps: 10,
          targetReps: 10,
          completed: false
        });
      }
      setCurrentSessionSets(prev => [...prev, ...newSets]);
      setActiveTab('workout');
    }
    setCustomInput("");
    setIsAnalyzing(false);
  };

  const handleCreateRoutineAI = async (input: string) => {
    if (!input.trim() || isAnalyzing) return;
    setIsAnalyzing(true);

    try {
      const { routineName, exercises: aiExercises } = await generateRoutine(input);

      // Process exercises
      const newExerciseIds: string[] = [];
      const newTargets: Record<string, { sets: number; reps: number }> = {};
      const newKnownExercises: Exercise[] = [];

      for (const aiEx of aiExercises) {
        // Case-insensitive check
        let ex = exercises.find(e => e.name.toLowerCase() === aiEx.name.toLowerCase()) ||
          newKnownExercises.find(e => e.name.toLowerCase() === aiEx.name.toLowerCase());

        if (!ex) {
          ex = {
            id: Math.random().toString(36).substr(2, 9),
            name: aiEx.name,
            muscleGroup: aiEx.muscleGroup,
            referenceWeight: aiEx.suggestedWeight
          };
          await saveExercise(ex);
          newKnownExercises.push(ex);
        }

        newExerciseIds.push(ex.id);
        newTargets[ex.id] = { sets: aiEx.targetSets, reps: aiEx.targetReps };
      }

      if (newKnownExercises.length > 0) {
        setExercises(prev => [...prev, ...newKnownExercises]);
      }

      // Create Routine
      const newRoutine: Routine = {
        id: Math.random().toString(36).substr(2, 9),
        name: routineName,
        exerciseIds: newExerciseIds,
        targets: newTargets
      };

      const updatedRoutines = [...routines, newRoutine];
      setRoutines(updatedRoutines);
      await saveRoutines(updatedRoutines);
      setLocalActiveRoutineId(newRoutine.id);

    } catch (err) {
      console.error("Failed to generate routine:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateSetData = (setId: string, field: 'weight' | 'reps', value: number) => {
    setCurrentSessionSets(prev => prev.map(s =>
      s.id === setId ? { ...s, [field]: value } : s
    ));
  };

  const handleCompleteSet = (setId: string) => {
    setCurrentSessionSets(prev => prev.map(s => {
      if (s.id === setId) {
        if (!s.completed) setIsTimerVisible(true);
        return { ...s, completed: !s.completed };
      }
      return s;
    }));
  };

  const startWorkout = (routineId?: string) => {
    const rId = routineId || activeRoutineId;
    const targetRoutine = routines.find(r => r.id === rId);
    if (!targetRoutine) return; // Or create a default empty session

    // If we have no target routine (e.g. quick start without routine), maybe just empty?
    // For now assume routine based.

    const newSets: SetLog[] = [];
    targetRoutine.exerciseIds.forEach(exId => {
      const ex = exercises.find(e => e.id === exId);
      if (ex) {
        const target = targetRoutine.targets?.[exId] || { sets: 3, reps: 10 };
        for (let i = 0; i < target.sets; i++) {
          newSets.push({
            id: Math.random().toString(36).substr(2, 9),
            exerciseId: exId,
            date: new Date().toISOString(),
            weight: ex.referenceWeight,
            reps: target.reps,
            targetReps: target.reps,
            completed: false
          });
        }
      }
    });
    setCurrentSessionSets(newSets);
    setActiveTab('workout');
  };

  const finishWorkout = async () => {
    const sessionExerciseIds = Array.from(new Set(currentSessionSets.map(s => s.exerciseId)));
    for (const exId of sessionExerciseIds) {
      const exerciseSets = currentSessionSets.filter(s => s.exerciseId === exId);
      const ex = exercises.find(e => e.id === exId);
      if (!ex) continue;

      const completedSets = exerciseSets.filter(s => s.completed);
      const allSuccessful = completedSets.length === exerciseSets.length &&
        completedSets.every(s => s.reps >= s.targetReps);

      let newWeight = ex.referenceWeight;
      if (allSuccessful) {
        const maxLifted = Math.max(...completedSets.map(s => s.weight));
        newWeight = maxLifted + 2.5;
      } else if (completedSets.length === 0) {
        newWeight = Math.max(0, ex.referenceWeight * 0.9);
      }

      if (newWeight !== ex.referenceWeight) {
        const updatedEx = { ...ex, referenceWeight: parseFloat(newWeight.toFixed(1)) };
        await saveExercise(updatedEx);
      }
    }

    await saveSets(currentSessionSets.filter(s => s.completed));
    await loadData();
    setCurrentSessionSets([]);
    setActiveTab('dashboard');
  };

  // --- Render ---

  if (!session) {
    // Simple Login Screen replacement
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-6">
        <div className="max-w-md w-full space-y-8 text-center">
          <h1 className="text-5xl font-black tracking-tighter text-white mb-2">PURELIFT</h1>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-white text-zinc-950 py-4 px-6 rounded-2xl font-bold text-lg shadow-xl hover:bg-zinc-200 transition-all uppercase tracking-widest"
          >
            Connect with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <Shell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      user={session?.user}
      onSignIn={signInWithGoogle}
      onSignOut={signOut}
    >
      <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto h-full">
        <header className="mb-8 md:mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-3xl md:text-4xl font-[900] text-zinc-100 tracking-tight leading-none">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'workout' && 'Active Session'}
              {activeTab === 'plan' && 'Training Plan'}
            </h1>
            <p className="text-xs md:text-sm font-bold text-zinc-500 uppercase tracking-widest mt-2">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <DashboardView
            user={session?.user}
            routines={routines}
            activeRoutineId={activeRoutineId}
            exercises={exercises}
            allSets={allSets}
            coachInsight={coachInsight}
            onSwitchRoutine={setLocalActiveRoutineId}
            onStartWorkout={(id) => {
              if (id) setLocalActiveRoutineId(id);
              // If starting from quick start, we need to handle the start logic
              startWorkout(id || activeRoutineId);
            }}
            weeklyVolumes={weeklyVolumes}
          />
        )}

        {activeTab === 'workout' && (
          <WorkoutView
            activeRoutine={activeRoutine}
            exercises={exercises}
            currentSessionSets={currentSessionSets}
            onStartWorkout={() => startWorkout(activeRoutineId)}
            onAddCustomExercise={handleAddCustomExercise}
            onCompleteSet={handleCompleteSet}
            onUpdateSet={updateSetData}
            onFinishWorkout={finishWorkout}
            onSwapExercise={(ex) => setSwappingExerciseId(ex.id)} // Placeholder for now, swap logic needs View integration if popup
            isTimerVisible={isTimerVisible}
            setIsTimerVisible={setIsTimerVisible}
            timerDuration={defaultRestTime}
            isAnalyzing={isAnalyzing}
            history={allSets}
          />
        )}

        {activeTab === 'plan' && (
          <PlanView
            routines={routines}
            exercises={exercises}
            activeRoutineId={activeRoutineId}
            onSelectRoutine={setLocalActiveRoutineId}
            onUpdateRoutine={(updated) => {
              const newRoutines = routines.map(r => r.id === updated.id ? updated : r);
              setRoutines(newRoutines);
              saveRoutines(newRoutines);
            }}
            onDeleteRoutine={async (id) => {
              if (confirm('Delete this routine?')) {
                const updated = routines.filter(r => r.id !== id);
                setRoutines(updated);
                await deleteRoutine(id);
                if (updated.length > 0) setLocalActiveRoutineId(updated[0].id);
              }
            }}
            onCreateRoutineAI={handleCreateRoutineAI}
            isGeneratingAI={isAnalyzing}
            volumeGoals={volumeGoals}
            defaultRestTime={defaultRestTime}
            onUpdateSettings={async (settings) => {
              if (settings.volumeGoals) setVolumeGoals(settings.volumeGoals);
              if (settings.defaultRestTime) setDefaultRestTime(settings.defaultRestTime);
              await saveUserSettings({
                volumeGoals: settings.volumeGoals || volumeGoals,
                defaultRestTime: settings.defaultRestTime || defaultRestTime
              });
            }}
          />
        )}
      </div>
    </Shell>
  );
};

export default App;
