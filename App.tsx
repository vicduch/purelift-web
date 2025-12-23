
import React, { useState, useEffect, useMemo } from 'react';
import { MuscleGroup, Exercise, SetLog, WeeklyVolume, Routine, UserSettings, DEFAULT_VOLUME_GOALS } from './types';
import { getExercises, getSets, getRoutines, saveSets, saveExercise, saveRoutines, signInWithGoogle, signOut, seedDefaultData, getUserSettings, saveUserSettings, deleteRoutine } from './supabaseStore';
import { supabase } from './supabaseClient';
import { IconDashboard, IconPlay, IconSettings, IconPlus, IconSwap } from './components/Icons';
import Timer from './components/Timer';
import ProgressChart from './components/ProgressChart';
import { getCoachInsight, analyzeExercise, getExerciseAlternatives, getFormTips, generateRoutine } from './services/geminiService';

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

  // Swap State
  const [swappingExerciseId, setSwappingExerciseId] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<{ name: string; reason: string }[]>([]);
  const [isFindingAlternatives, setIsFindingAlternatives] = useState(false);

  const [currentSessionSets, setCurrentSessionSets] = useState<SetLog[]>([]);
  const [volumeGoals, setVolumeGoals] = useState<Record<MuscleGroup, number>>(DEFAULT_VOLUME_GOALS);
  const [defaultRestTime, setDefaultRestTime] = useState<number>(90);

  // Form Tips State
  const [formTipsExerciseId, setFormTipsExerciseId] = useState<string | null>(null);
  const [formTips, setFormTips] = useState<string[]>([]);
  const [isLoadingFormTips, setIsLoadingFormTips] = useState(false);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup | 'All'>('All');

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
      // Seed default data for new users, or fetch existing
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
      if (rts.length > 0) setLocalActiveRoutineId(rts[0].id);
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

  const handleAddCustomExercise = async (toWorkout: boolean = false) => {
    if (!customInput.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    const result = await analyzeExercise(customInput);

    const existing = exercises.find(e => e.name.toLowerCase() === result.name.toLowerCase());
    let exerciseToUse: Exercise;

    if (existing) {
      exerciseToUse = existing;
    } else {
      exerciseToUse = {
        id: Math.random().toString(36).substr(2, 9),
        name: result.name,
        muscleGroup: result.muscleGroup,
        referenceWeight: result.suggestedWeight
      };
      await saveExercise(exerciseToUse);
      setExercises(prev => [...prev, exerciseToUse]);
    }

    if (toWorkout) {
      const newSets: SetLog[] = [];
      for (let i = 0; i < 3; i++) {
        newSets.push({
          id: Math.random().toString(36).substr(2, 9),
          exerciseId: exerciseToUse.id,
          date: new Date().toISOString(),
          weight: exerciseToUse.referenceWeight,
          reps: 10,
          targetReps: 10,
          completed: false
        });
      }
      setCurrentSessionSets(prev => [...prev, ...newSets]);
      setActiveTab('workout');
    } else if (activeRoutine) {
      const updatedRoutines = routines.map(r => {
        if (r.id === activeRoutineId && !r.exerciseIds.includes(exerciseToUse.id)) {
          return { ...r, exerciseIds: [...r.exerciseIds, exerciseToUse.id] };
        }
        return r;
      });
      setRoutines(updatedRoutines);
      await saveRoutines(updatedRoutines);
    }

    setCustomInput("");
    setIsAnalyzing(false);
  };

  const handleCreateRoutineAI = async () => {
    if (!customInput.trim() || isAnalyzing) return;
    setIsAnalyzing(true);

    const { routineName, exercises: aiExercises } = await generateRoutine(customInput);

    const newRoutineId = Math.random().toString(36).substr(2, 9);
    const newExerciseIds: string[] = [];
    const newTargets: Record<string, { sets: number; reps: number }> = {};
    const newKnownExercises: Exercise[] = [];

    for (const aiEx of aiExercises) {
      // Reuse existing exercise if name matches (fuzzy match could be better but strict for now)
      let ex = exercises.find(e => e.name.toLowerCase() === aiEx.name.toLowerCase()) || newKnownExercises.find(e => e.name.toLowerCase() === aiEx.name.toLowerCase());

      if (!ex) {
        ex = {
          id: Math.random().toString(36).substr(2, 9),
          name: aiEx.name,
          muscleGroup: aiEx.muscleGroup as MuscleGroup, // Ensure type safety or mapping
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

    const newRoutine: Routine = {
      id: newRoutineId,
      name: routineName,
      exerciseIds: newExerciseIds,
      targets: newTargets
    };

    const updatedRoutines = [...routines, newRoutine];
    setRoutines(updatedRoutines);
    await saveRoutines(updatedRoutines);
    setLocalActiveRoutineId(newRoutineId);

    setCustomInput("");
    setIsAnalyzing(false);
  };

  const handleSwapRequest = async (ex: Exercise) => {
    setSwappingExerciseId(ex.id);
    setIsFindingAlternatives(true);
    const alts = await getExerciseAlternatives(ex.name, ex.muscleGroup);
    setAlternatives(alts);
    setIsFindingAlternatives(false);
  };

  const executeSwap = async (oldExId: string, newExName: string) => {
    setIsAnalyzing(true);
    const result = await analyzeExercise(newExName);
    const existing = exercises.find(e => e.name.toLowerCase() === result.name.toLowerCase());

    let replacement: Exercise;
    if (existing) {
      replacement = existing;
    } else {
      replacement = {
        id: Math.random().toString(36).substr(2, 9),
        name: result.name,
        muscleGroup: result.muscleGroup,
        referenceWeight: result.suggestedWeight
      };
      await saveExercise(replacement);
      setExercises(prev => [...prev, replacement]);
    }

    setCurrentSessionSets(prev => prev.map(s =>
      s.exerciseId === oldExId ? { ...s, exerciseId: replacement.id, weight: replacement.referenceWeight } : s
    ));

    setSwappingExerciseId(null);
    setAlternatives([]);
    setIsAnalyzing(false);
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
    if (!targetRoutine) return;

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

  const switchActiveRoutine = (id: string) => {
    setLocalActiveRoutineId(id);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h1 className="text-5xl font-black tracking-tighter text-blue-500 mb-2">PURELIFT</h1>
            <p className="text-slate-400 font-medium">Connectez-vous pour sauvegarder votre progression</p>
          </div>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center space-x-3 bg-white text-slate-900 py-4 px-6 rounded-2xl font-bold text-lg shadow-xl hover:bg-slate-50 transition-all"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continuer avec Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      {/* Sidebar Navigation (Desktop) */}
      <nav className="hidden md:flex flex-col w-24 bg-[#0f172a] text-white h-screen sticky top-0 py-8 items-center border-r border-slate-800/50 z-50">

        <div className="mb-12 flex justify-center w-full">
          <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center font-black text-xl tracking-tighter shadow-xl shadow-slate-900/20">
            PL
          </div>
        </div>

        <div className="flex-1 flex flex-col space-y-8 w-full px-4">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-300 relative group ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-300 hover:bg-slate-50 hover:text-blue-500'}`}
          >
            <IconDashboard className="w-6 h-6" />
            {activeTab === 'dashboard' && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full"></div>}
            <div className="absolute left-20 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-[60] border border-white/10">
              Dashboard
            </div>
          </button>

          <button
            onClick={() => setActiveTab('workout')}
            className={`w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-300 relative group ${activeTab === 'workout' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-300 hover:bg-slate-50 hover:text-blue-500'}`}
          >
            <IconPlay className="w-6 h-6" />
            {activeTab === 'workout' && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full"></div>}
            <div className="absolute left-20 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-[60] border border-white/10">
              Workout
            </div>
          </button>

          <button
            onClick={() => setActiveTab('plan')}
            className={`w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-300 relative group ${activeTab === 'plan' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-300 hover:bg-slate-50 hover:text-blue-500'}`}
          >
            <IconSettings className="w-6 h-6" />
            {activeTab === 'plan' && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full"></div>}
            <div className="absolute left-20 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-[60] border border-white/10">
              Plan
            </div>
          </button>
        </div>

        <div className="mt-auto flex flex-col items-center space-y-6 pb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 border-2 border-white shadow-lg"></div>
          {session && (
            <button
              onClick={signOut}
              className="text-[10px] text-slate-500 hover:text-red-400 font-black uppercase tracking-widest transition-colors"
            >
              Out
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 bg-[#FAFAFA] min-h-screen pb-24 md:pb-0">
        <header className="sticky top-0 z-40 bg-[#FAFAFA]/80 backdrop-blur-md px-6 py-6 md:px-12 md:py-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-[900] text-slate-900 tracking-tight">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'workout' && 'Training Session'}
              {activeTab === 'plan' && 'Programme'}
            </h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Mobile User Menu / Sign In could go here if needed, but keeping it simple for now */}
          </div>
        </header>

        <div className="px-4 md:px-12 py-4 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-slide-up">
              {/* AI Coach Insight */}
              <section className="lg:col-span-12">
                <div className="relative group perspective-1000">
                  <div className="absolute inset-0 bg-blue-600 rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative bg-[#0f172a] rounded-[2.5rem] p-10 overflow-hidden shadow-2xl border border-white/5">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-[900] uppercase tracking-widest rounded-full border border-blue-500/20">PureCoach Intelligence</span>
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse delay-75"></div>
                          </div>
                        </div>
                        <p className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight italic">
                          "{coachInsight}"
                        </p>
                      </div>
                    </div>
                    {/* Abstract Shapes */}
                    <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-[-20%] left-[10%] w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl"></div>
                  </div>
                </div>
              </section>

              {/* Weekly Volume Stats */}
              <section className="lg:col-span-8 space-y-8">
                <div className="flex justify-between items-end px-2">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Analyse du Volume</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Semaine en cours</p>
                </div>
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-10">
                  {weeklyVolumes.map(v => (
                    <div key={v.muscle} className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${v.count >= v.goal ? 'bg-green-500' : 'bg-blue-600'}`}></div>
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{v.muscle}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-black ${v.count >= v.goal ? 'text-green-500' : 'text-slate-800'}`}>{v.count}</span>
                          <span className="text-xs font-bold text-slate-300 ml-1">/ {v.goal} séries</span>
                        </div>
                      </div>
                      <div className="h-4 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-[3px]">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${v.count >= v.goal ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}
                          style={{ width: `${Math.min(100, (v.count / v.goal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Quick Start */}
              <section className="lg:col-span-4 space-y-8">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight px-2">Démarrage Rapide</h3>
                <div className="space-y-4">
                  {routines.slice(0, 3).map((r, i) => (
                    <button
                      key={r.id}
                      onClick={() => { switchActiveRoutine(r.id); startWorkout(r.id); }}
                      className="group w-full p-6 rounded-[2rem] bg-white border border-slate-100 shadow-lg shadow-slate-200/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black ${i === 0 ? 'bg-blue-50 text-blue-600' : i === 1 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
                          {r.name[0]}
                        </div>
                        <div className="text-left">
                          <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{r.name}</div>
                          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{r.exerciseIds.length} exercices certifiés</div>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-blue-600 flex items-center justify-center transition-all group-hover:scale-110">
                        <IconPlay className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Progress Charts Section */}
              <section className="lg:col-span-12 space-y-8 pt-6">
                <div className="flex justify-between items-end px-2">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Progression des Exercices</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Performances récentes</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {exercises.filter(ex => allSets.some(s => s.exerciseId === ex.id && s.completed)).slice(0, 6).map(ex => {
                    const exSets = allSets
                      .filter(s => s.exerciseId === ex.id && s.completed)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    const chartData = exSets.map(s => ({ date: s.date, weight: s.weight }));
                    return (
                      <div key={ex.id} className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 hover:shadow-2xl hover:border-blue-100 transition-all group">
                        <ProgressChart data={chartData} exerciseName={ex.name} />
                      </div>
                    );
                  })}
                  {exercises.filter(ex => allSets.some(s => s.exerciseId === ex.id && s.completed)).length === 0 && (
                    <div className="col-span-full py-20 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm mb-4 flex items-center justify-center">
                        <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 12l3-3 3 3 4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
                      </div>
                      <p className="font-bold text-sm uppercase tracking-widest">Connectez-vous pour voir votre progression</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'workout' && (
            <div className="max-w-4xl mx-auto space-y-12 animate-slide-up">
              {currentSessionSets.length === 0 ? (
                <div className="relative group perspective-1000 py-10">
                  <div className="absolute inset-0 bg-blue-600/5 rounded-[3rem] blur-3xl"></div>
                  <div className="relative bg-white rounded-[3rem] p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 text-center space-y-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                      <IconPlay className="w-10 h-10 text-white" />
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-3xl font-[900] text-slate-900 tracking-tight">Prêt pour {activeRoutine?.name} ?</h2>
                      <p className="text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
                        Chaque répétition compte. Vos charges de référence ont été calibrées sur votre dernière performance.
                      </p>
                    </div>
                    <div className="pt-4 flex flex-col items-center gap-4">
                      <button
                        onClick={() => startWorkout()}
                        className="bg-[#0f172a] text-white px-12 py-5 rounded-[2rem] font-black shadow-2xl shadow-slate-900/20 active:scale-95 hover:bg-blue-600 transition-all duration-300 tracking-tight"
                      >
                        Lancer l'entraînement
                      </button>
                      <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                        <span>Sync cloud active</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-12 bg-slate-50/50 p-6 md:p-10 rounded-[3rem] border border-slate-100/50">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-10 group-focus-within:opacity-20 transition duration-500"></div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ajouter un exercice à la volée..."
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomExercise(true)}
                        className="w-full pl-8 pr-20 py-6 bg-white rounded-[2rem] shadow-xl shadow-slate-200/30 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-xl font-black placeholder:text-slate-300 text-slate-900"
                      />
                      <button
                        onClick={() => handleAddCustomExercise(true)}
                        disabled={isAnalyzing}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center hover:bg-blue-700"
                      >
                        {isAnalyzing ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <IconPlus className="w-6 h-6" />}
                      </button>
                    </div>
                  </div>

                  {Array.from(new Set(currentSessionSets.map(s => s.exerciseId))).map(exId => {
                    const ex = exercises.find(e => e.id === exId);
                    const sets = currentSessionSets.filter(s => s.exerciseId === exId);
                    const isSwapping = swappingExerciseId === exId;

                    return (
                      <div key={exId} className="relative group/ex">
                        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                          {/* Exercise Header */}
                          <div className="px-8 py-8 border-b border-slate-50">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <button
                                  onClick={async () => {
                                    if (formTipsExerciseId === exId) {
                                      setFormTipsExerciseId(null);
                                      return;
                                    }
                                    setFormTipsExerciseId(exId);
                                    setIsLoadingFormTips(true);
                                    const tips = await getFormTips(ex?.name || '');
                                    setFormTips(tips);
                                    setIsLoadingFormTips(false);
                                  }}
                                  className="group flex flex-col items-start transition-all"
                                >
                                  <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-blue-600 group-active:scale-95 transition-all">{ex?.name}</h3>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest rounded-md">{ex?.muscleGroup}</span>
                                    <span className="text-[10px] font-bold text-slate-300">•</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IA Tips Dispo</span>
                                  </div>
                                </button>
                              </div>
                              <button
                                onClick={() => ex && handleSwapRequest(ex)}
                                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-2xl transition-all"
                                title="Remplacer"
                              >
                                <IconSwap className="w-5 h-5" />
                              </button>
                            </div>

                            {/* History Context inside header for clean look */}
                            {(() => {
                              const history = allSets
                                .filter(s => s.exerciseId === exId && s.completed && new Date(s.date) < new Date(new Date().setHours(0, 0, 0, 0)))
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                              if (history.length > 0) {
                                const lastDate = history[0].date.split('T')[0];
                                const lastSets = history.filter(s => s.date.startsWith(lastDate));
                                const bestSet = lastSets.reduce((prev, current) => (prev.weight > current.weight ? prev : current), lastSets[0]);

                                return (
                                  <div className="mt-4 flex items-center space-x-4 bg-slate-50 p-3 rounded-2xl">
                                    <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                      <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dernier Record</span>
                                      <div className="text-sm">
                                        <span className="font-black text-slate-900">{bestSet.weight}kg</span>
                                        <span className="text-slate-400 font-bold mx-1">×</span>
                                        <span className="font-black text-slate-900">{bestSet.reps}</span>
                                        <span className="text-[10px] text-slate-400 ml-2 font-medium">({new Date(lastDate).toLocaleDateString()})</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {/* Form Tips Overlay */}
                          {formTipsExerciseId === exId && (
                            <div className="bg-[#0f172a] text-white p-8 animate-slide-up border-b border-white/5 relative">
                              <button onClick={() => setFormTipsExerciseId(null)} className="absolute right-6 top-6 w-8 h-8 flex items-center justify-center bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">✕</button>
                              <div className="flex items-center space-x-3 mb-6">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,1)]"></div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Assistant Technique AI</span>
                              </div>
                              {isLoadingFormTips ? (
                                <div className="py-4 flex items-center space-x-4 text-slate-400">
                                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                  <span className="text-sm font-medium italic">Analyse du mouvement en cours...</span>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  {formTips.map((tip, i) => (
                                    <div key={i} className="bg-white/5 p-4 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all">
                                      <div className="text-blue-500 font-black mb-2 flex items-center space-x-2">
                                        <span className="text-xs">0{i + 1}</span>
                                        <div className="h-px w-4 bg-blue-500/30"></div>
                                      </div>
                                      <p className="text-sm font-medium leading-relaxed text-slate-300">{tip}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Swap Overlay */}
                          {isSwapping && (
                            <div className="bg-blue-600 text-white p-8 animate-slide-up">
                              <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center space-x-3">
                                  <IconSwap className="w-5 h-5" />
                                  <h4 className="font-black uppercase tracking-tight">Remplaçants Recommandés</h4>
                                </div>
                                <button onClick={() => setSwappingExerciseId(null)} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all">✕</button>
                              </div>
                              {isFindingAlternatives ? (
                                <div className="flex items-center space-x-3 py-10 opacity-60 italic">
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Génération de variantes ergonomiques...</span>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {alternatives.map((alt, i) => (
                                    <button
                                      key={i}
                                      onClick={() => ex && executeSwap(ex.id, alt.name)}
                                      className="p-5 bg-white/10 hover:bg-white/20 rounded-[1.5rem] text-left transition-all border border-white/10 hover:border-white/30 group/alt"
                                    >
                                      <div className="font-black text-lg group-hover/alt:translate-x-1 transition-transform">{alt.name}</div>
                                      <div className="text-xs text-white/60 mt-1 line-clamp-2 leading-relaxed">{alt.reason}</div>
                                    </button>
                                  ))}
                                  <div className="group/input relative hidden md:block">
                                    <input
                                      type="text"
                                      placeholder="Nom de l'exercice..."
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && ex) executeSwap(ex.id, (e.target as HTMLInputElement).value);
                                      }}
                                      className="w-full h-full bg-black/10 border-2 border-dashed border-white/20 rounded-[1.5rem] px-5 py-4 text-sm placeholder:text-white/30 focus:outline-none focus:border-white/50 transition-all"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sets List */}
                          <div className="divide-y divide-slate-50">
                            {sets.map((s, idx) => (
                              <div key={s.id} className={`flex items-center gap-6 px-8 py-6 transition-all group/set ${s.completed ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}>
                                <div className={`w-12 h-12 flex items-center justify-center rounded-2xl text-lg font-black transition-all ${s.completed ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 rotate-12' : 'bg-[#0f172a] text-white shadow-md'}`}>
                                  {idx + 1}
                                </div>

                                <div className="flex-1 flex items-center gap-10">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Charge (kg)</span>
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="number" step="0.5" value={s.weight}
                                        onChange={(e) => updateSetData(s.id, 'weight', parseFloat(e.target.value) || 0)}
                                        className="text-2xl font-black bg-transparent border-none focus:ring-0 w-24 p-0 text-slate-900"
                                      />
                                      <div className="flex flex-col opacity-0 group-hover/set:opacity-100 transition-opacity">
                                        <button onClick={() => updateSetData(s.id, 'weight', s.weight + 2.5)} className="text-slate-300 hover:text-blue-500">▲</button>
                                        <button onClick={() => updateSetData(s.id, 'weight', Math.max(0, s.weight - 2.5))} className="text-slate-300 hover:text-blue-500">▼</button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Objectif</span>
                                    <div className="flex items-baseline space-x-2">
                                      <input
                                        type="number" value={s.reps}
                                        onChange={(e) => updateSetData(s.id, 'reps', parseInt(e.target.value) || 0)}
                                        className="text-2xl font-black bg-transparent border-none focus:ring-0 w-16 p-0 text-slate-900"
                                      />
                                      <span className="text-slate-300 font-bold text-sm">/ {s.targetReps}</span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleCompleteSet(s.id)}
                                  className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 ${s.completed ? 'bg-emerald-500 text-white scale-90' : 'bg-slate-100 text-slate-300 hover:bg-blue-600 hover:text-white hover:shadow-xl hover:shadow-blue-500/20 active:scale-90 scale-100'}`}
                                >
                                  {s.completed ? (
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                                  ) : (
                                    <span className="font-black text-sm uppercase">Done</span>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Floating Action Menu for exercise */}
                        <div className="absolute -right-3 top-[-10px] hidden group-hover/ex:flex flex-col gap-2 z-10 animate-slide-up">
                          <div className="w-8 h-8 bg-white border border-slate-100 rounded-full shadow-lg flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors pointer-cursor">✕</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


          {activeTab === 'plan' && (
            <div className="max-w-5xl mx-auto space-y-16 animate-slide-up">
              {/* Header section with Action */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-slate-100 pb-10">
                <div className="space-y-2">
                  <h2 className="text-4xl font-[900] text-slate-900 tracking-tight">Configuration</h2>
                  <p className="text-slate-500 font-medium">Structurez vos programmes et vos objectifs physiologiques.</p>
                </div>
                <button
                  onClick={() => {
                    const newRoutine: Routine = { id: Math.random().toString(36).substr(2, 9), name: 'Nouvelle Routine', exerciseIds: [] };
                    const updated = [...routines, newRoutine];
                    setRoutines(updated);
                    saveRoutines(updated);
                    switchActiveRoutine(newRoutine.id);
                  }}
                  className="bg-[#0f172a] text-white px-8 py-4 rounded-[1.5rem] font-black flex items-center space-x-3 shadow-xl hover:bg-blue-600 transition-all active:scale-95 group"
                >
                  <IconPlus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                  <span>Nouveau Programme</span>
                </button>
              </div>

              {/* Routines Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {routines.map(r => (
                  <div
                    key={r.id}
                    className={`relative p-8 rounded-[2.5rem] border-2 transition-all duration-300 flex flex-col group ${activeRoutineId === r.id ? 'border-blue-600 bg-blue-50/20 shadow-xl' : 'border-white bg-white shadow-lg shadow-slate-200/30 hover:border-slate-100'}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1">
                        <div className="font-black text-xl text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{r.name}</div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.exerciseIds.length} Exercices</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm('Supprimer cette routine ?')) {
                            const updated = routines.filter(rt => rt.id !== r.id);
                            setRoutines(updated);
                            await deleteRoutine(r.id);
                          }
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                      </button>
                    </div>

                    <div className="flex-1 space-y-3 mb-8">
                      {r.exerciseIds.length === 0 ? (
                        <div className="text-sm text-slate-400 italic py-4">Pas d'exercices configurés</div>
                      ) : (
                        r.exerciseIds.slice(0, 5).map(eid => (
                          <div key={eid} className="text-[11px] font-bold text-slate-500 flex items-center">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-3"></div>
                            <span className="truncate">{exercises.find(e => e.id === eid)?.name}</span>
                          </div>
                        ))
                      )}
                      {r.exerciseIds.length > 5 && <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest pt-1">+{r.exerciseIds.length - 5} autres types</div>}
                    </div>

                    <button
                      onClick={() => switchActiveRoutine(r.id)}
                      className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeRoutineId === r.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-900 hover:text-white'}`}
                    >
                      {activeRoutineId === r.id ? 'Sélectionné' : 'Configurer'}
                    </button>
                  </div>
                ))}
              </div>

              {activeRoutine && (
                <div className="mt-20 space-y-10 animate-slide-up">
                  <div className="bg-[#0f172a] rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Édition avancée</span>
                        <h3 className="text-3xl font-[900] tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-lg">{activeRoutine.name}</h3>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Décrivez votre séance idéale (ex: 'Dos Largeur & Biceps')..."
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateRoutineAI()}
                          className="w-full pl-6 pr-14 py-5 bg-white ios-card focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-lg font-black placeholder:text-slate-400 text-slate-900"
                        />
                        <button onClick={() => handleCreateRoutineAI()} disabled={isAnalyzing} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                          {isAnalyzing ? <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <div className="flex items-center space-x-1"><span className="text-xs font-black uppercase">Générer</span><IconPlus className="w-5 h-5" /></div>}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Muscle Group Filter */}
                  <div className="flex flex-wrap gap-2 overflow-x-auto pb-4 no-scrollbar">
                    <button
                      onClick={() => setSelectedMuscleGroup('All')}
                      className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${selectedMuscleGroup === 'All' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
                    >
                      Tous
                    </button>
                    {Object.values(MuscleGroup).map(m => (
                      <button
                        key={m}
                        onClick={() => setSelectedMuscleGroup(m)}
                        className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedMuscleGroup === m ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4"></div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {exercises
                      .filter(ex => selectedMuscleGroup === 'All' || ex.muscleGroup === selectedMuscleGroup)
                      .map(ex => {
                        const isSelected = activeRoutine.exerciseIds.includes(ex.id);
                        return (
                          <div key={ex.id} className={`rounded-[2rem] border-2 transition-all duration-300 overflow-hidden ${isSelected ? 'border-blue-500 bg-white shadow-xl shadow-blue-500/5' : 'border-white bg-white shadow-sm opacity-60 hover:opacity-100 hover:border-slate-100'}`}>
                            <div className="p-6 flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-400'}`}>
                                  {ex.name[0]}
                                </div>
                                <div>
                                  <div className="font-black text-slate-900 group-hover:text-blue-600">{ex.name}</div>
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ex.muscleGroup}</div>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const newIds = isSelected
                                    ? activeRoutine.exerciseIds.filter(id => id !== ex.id)
                                    : [...activeRoutine.exerciseIds, ex.id];
                                  const updatedRoutines = routines.map(r => r.id === activeRoutineId ? { ...r, exerciseIds: newIds } : r);
                                  setRoutines(updatedRoutines);
                                  saveRoutines(updatedRoutines);
                                }}
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-300'}`}
                              >
                                {isSelected ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" /></svg> : <IconPlus className="w-5 h-5" />}
                              </button>
                            </div>

                            {isSelected && (
                              <div className="px-6 py-6 bg-slate-50 flex items-center justify-between gap-6 border-t border-slate-100">
                                <div className="flex items-center gap-6">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Séries</span>
                                    <input
                                      type="number" min="1" max="10"
                                      value={activeRoutine.targets?.[ex.id]?.sets || 3}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 3;
                                        const currentTargets = activeRoutine.targets || {};
                                        const updatedRoutines = routines.map(r => r.id === activeRoutineId ? {
                                          ...r,
                                          targets: { ...currentTargets, [ex.id]: { ...(currentTargets[ex.id] || { reps: 10 }), sets: val } }
                                        } : r);
                                        setRoutines(updatedRoutines);
                                        saveRoutines(updatedRoutines);
                                      }}
                                      className="w-16 bg-white border border-slate-200 rounded-xl px-2 py-2 text-center font-black text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Répétitions</span>
                                    <input
                                      type="number" min="1" max="50"
                                      value={activeRoutine.targets?.[ex.id]?.reps || 10}
                                      onChange={async (e) => {
                                        const val = parseInt(e.target.value) || 10;
                                        const currentTargets = activeRoutine.targets || {};
                                        const updatedRoutines = routines.map(r => r.id === activeRoutineId ? {
                                          ...r,
                                          targets: { ...currentTargets, [ex.id]: { ...(currentTargets[ex.id] || { sets: 3 }), reps: val } }
                                        } : r);
                                        setRoutines(updatedRoutines);
                                        await saveRoutines(updatedRoutines);
                                      }}
                                      className="w-16 bg-white border border-slate-200 rounded-xl px-2 py-2 text-center font-black text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Advanced System Settings */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-16 border-t border-slate-100">
                <div className="lg:col-span-12">
                  <h3 className="text-3xl font-[900] text-slate-900 tracking-tight mb-2">Objectifs de Performance</h3>
                  <p className="text-slate-500 font-medium">Déterminez vos seuils de surcharge progressive hebdomadaires.</p>
                </div>

                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.values(MuscleGroup).map(muscle => (
                    <div key={muscle} className="bg-white p-6 rounded-[2rem] shadow-lg shadow-slate-200/30 border border-slate-50 flex items-center justify-between group hover:border-blue-500/20 transition-all">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{muscle}</span>
                        <span className="text-sm font-black text-slate-900 leading-none">Sets/Semaine</span>
                      </div>
                      <input
                        type="number" min="0" max="30"
                        value={volumeGoals[muscle] || 15}
                        onChange={async (e) => {
                          const newGoals = { ...volumeGoals, [muscle]: parseInt(e.target.value) || 0 };
                          setVolumeGoals(newGoals);
                          await saveUserSettings({ volumeGoals: newGoals, defaultRestTime });
                        }}
                        className="w-14 bg-slate-50 rounded-xl px-2 py-3 text-center font-black text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 group-hover:bg-blue-50 transition-colors"
                      />
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-4">
                  <div className="bg-[#0f172a] p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden h-full flex flex-col justify-center">
                    <div className="relative z-10 space-y-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
                        </div>
                        <span className="text-sm font-black uppercase tracking-widest text-blue-400">Rest Engine</span>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-xl font-black">Repos Préconisé</h4>
                        <div className="flex items-center justify-between bg-white/5 p-4 rounded-3xl border border-white/5">
                          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Secondes</span>
                          <input
                            type="number" min="30" max="300" step="15"
                            value={defaultRestTime}
                            onChange={async (e) => {
                              const newTime = parseInt(e.target.value) || 90;
                              setDefaultRestTime(newTime);
                              await saveUserSettings({ volumeGoals, defaultRestTime: newTime });
                            }}
                            className="w-20 bg-white/10 rounded-xl px-3 py-2 text-center font-black text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Glow effect */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Nav Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-slate-200 flex justify-around items-center h-20 px-4 z-50">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}>
          <IconDashboard className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Stats</span>
        </button>
        <button onClick={() => setActiveTab('workout')} className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'workout' ? 'text-blue-600' : 'text-slate-400'}`}>
          <div className={`p-3 rounded-2xl -mt-8 shadow-lg transition-all ${activeTab === 'workout' ? 'bg-blue-600 text-white scale-110' : 'bg-slate-900 text-white'}`}>
            <IconPlay className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-1">SÉANCE</span>
        </button>
        <button onClick={() => setActiveTab('plan')} className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'plan' ? 'text-blue-600' : 'text-slate-400'}`}>
          <IconSettings className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">PLANS</span>
        </button>
      </nav>
      {isTimerVisible && <Timer initialSeconds={defaultRestTime} onClose={() => setIsTimerVisible(false)} />}
    </div>
  );
};

export default App;
