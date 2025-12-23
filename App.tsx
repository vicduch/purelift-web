
import React, { useState, useEffect, useMemo } from 'react';
import { MuscleGroup, Exercise, SetLog, WeeklyVolume, Routine } from './types';
import { getExercises, getSets, getRoutines, saveSets, saveExercise, saveRoutines, signInWithGoogle, signOut } from './supabaseStore';
import { supabase } from './supabaseClient';
import { IconDashboard, IconPlay, IconSettings, IconPlus, IconSwap } from './components/Icons';
import Timer from './components/Timer';
import { getCoachInsight, analyzeExercise, getExerciseAlternatives } from './services/geminiService';

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
      const [exs, sts, rts] = await Promise.all([
        getExercises(),
        getSets(),
        getRoutines()
      ]);
      setExercises(exs);
      setAllSets(sts);
      setRoutines(rts);
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
      goal: 15
    })) as WeeklyVolume[];
  }, [allSets, exercises]);

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
      <nav className="hidden md:flex flex-col w-72 bg-slate-900 text-white h-screen sticky top-0 p-6 overflow-y-auto no-scrollbar">
        <div className="mb-10">
          <h1 className="text-2xl font-black tracking-tighter text-blue-500">PURELIFT</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Pro Multi-Routine Engine</p>
        </div>

        <div className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800'}`}
          >
            <IconDashboard className="w-5 h-5" />
            <span className="font-semibold">Tableau de bord</span>
          </button>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
          <div className="flex items-center space-x-3 px-4">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg">
              {session.user.email?.[0].toUpperCase()}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-bold truncate">{session.user.email}</span>
              <button
                onClick={signOut}
                className="text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase text-left tracking-widest"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>

        <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Mes Programmes</div>
        {routines.map(r => (
          <button
            key={r.id}
            onClick={() => { switchActiveRoutine(r.id); setActiveTab('workout'); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${activeRoutineId === r.id && activeTab === 'workout' ? 'bg-slate-800 text-blue-400' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <span className="font-medium text-sm truncate">{r.name}</span>
            {activeRoutineId === r.id && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
          </button>
        ))}

        <button
          onClick={() => setActiveTab('plan')}
          className={`w-full flex items-center space-x-3 px-4 py-3 mt-4 rounded-xl transition-all ${activeTab === 'plan' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
        >
          <IconSettings className="w-5 h-5" />
          <span className="font-semibold">Gestion Routines</span>
        </button>
      </nav>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative overflow-x-hidden">
        <header className="sticky top-0 glass z-40 px-6 py-5 flex justify-between items-center border-b border-slate-100">
          <div className="flex flex-col">
            <h2 className="text-xl font-extrabold md:hidden text-slate-900 tracking-tight">PureLift</h2>
            <span className="hidden md:block text-sm font-black text-slate-400 uppercase tracking-widest">
              {activeTab === 'workout' ? activeRoutine?.name : activeTab}
            </span>
          </div>
          {activeTab === 'workout' && currentSessionSets.length > 0 && (
            <button
              onClick={finishWorkout}
              className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-md active:scale-95 transition-all"
            >
              Terminer la séance
            </button>
          )}
        </header>

        <main className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10 pb-32">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-slide-up">
              <section className="lg:col-span-12">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                  <div className="relative z-10">
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] opacity-50 mb-3">Conseil PureCoach</h2>
                    <p className="text-2xl font-semibold leading-relaxed max-w-3xl">"{coachInsight}"</p>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                </div>
              </section>

              <section className="lg:col-span-8 space-y-6">
                <h3 className="text-xl font-bold text-slate-800">Volume Hebdomadaire</h3>
                <div className="ios-card p-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                  {weeklyVolumes.map(v => (
                    <div key={v.muscle} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-tighter">
                        <span>{v.muscle}</span>
                        <span className={v.count >= v.goal ? 'text-green-500' : ''}>{v.count}/{v.goal}</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ease-out ${v.count >= v.goal ? 'bg-green-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.min(100, (v.count / v.goal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="lg:col-span-4 space-y-6">
                <h3 className="text-xl font-bold text-slate-800">Séance du jour</h3>
                <div className="space-y-3">
                  {routines.slice(0, 4).map(r => (
                    <button
                      key={r.id}
                      onClick={() => { switchActiveRoutine(r.id); startWorkout(r.id); }}
                      className={`w-full p-5 rounded-2xl flex items-center justify-between border-2 transition-all ${activeRoutineId === r.id ? 'border-blue-500 bg-blue-50/30' : 'border-white bg-white hover:border-slate-100'}`}
                    >
                      <div className="text-left">
                        <div className="font-bold text-slate-900">{r.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{r.exerciseIds.length} exercices</div>
                      </div>
                      <IconPlay className={`w-6 h-6 ${activeRoutineId === r.id ? 'text-blue-500' : 'text-slate-200'}`} />
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'workout' && (
            <div className="max-w-3xl mx-auto space-y-8 animate-slide-up">
              {currentSessionSets.length === 0 ? (
                <div className="space-y-6 text-center py-20">
                  <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <IconPlay className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">Prêt pour {activeRoutine?.name} ?</h2>
                  <p className="text-slate-500 max-w-xs mx-auto">Vos charges de référence ont été mises à jour selon votre dernière séance.</p>
                  <button
                    onClick={() => startWorkout()}
                    className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all"
                  >
                    Lancer l'entraînement
                  </button>
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="Ajouter un exo à la volée (ex: 'Curl Marteau')..."
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomExercise(true)}
                      className="w-full pl-6 pr-14 py-5 bg-white ios-card focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-lg font-medium"
                    />
                    <button
                      onClick={() => handleAddCustomExercise(true)}
                      disabled={isAnalyzing}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-blue-600 text-white rounded-2xl shadow-lg disabled:opacity-30 active:scale-95 transition-all"
                    >
                      {isAnalyzing ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <IconPlus className="w-6 h-6" />}
                    </button>
                  </div>

                  {Array.from(new Set(currentSessionSets.map(s => s.exerciseId))).map(exId => {
                    const ex = exercises.find(e => e.id === exId);
                    const sets = currentSessionSets.filter(s => s.exerciseId === exId);
                    const isSwapping = swappingExerciseId === exId;

                    return (
                      <div key={exId} className="space-y-4">
                        <div className="flex justify-between items-start px-2">
                          <div>
                            <h3 className="text-2xl font-black text-slate-900">{ex?.name}</h3>
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{ex?.muscleGroup}</p>
                          </div>
                          <button
                            onClick={() => ex && handleSwapRequest(ex)}
                            className="flex items-center space-x-2 text-slate-400 hover:text-blue-500 transition-colors bg-slate-100 px-3 py-1.5 rounded-lg"
                          >
                            <IconSwap className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase">Remplacer</span>
                          </button>

                        </div>

                        {/* History Context */}
                        {
                          (() => {
                            // Find last session for this exercise
                            // Sort allSets by date descending, filter by exerciseId and completed
                            const history = allSets
                              .filter(s => s.exerciseId === exId && s.completed && new Date(s.date) < new Date(new Date().setHours(0, 0, 0, 0))) // Strictly before today (or current session)
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                            if (history.length > 0) {
                              const lastDate = history[0].date.split('T')[0];
                              const lastSets = history.filter(s => s.date.startsWith(lastDate));
                              const bestSet = lastSets.reduce((prev, current) => (prev.weight > current.weight ? prev : current), lastSets[0]);

                              return (
                                <div className="px-2 pb-2 flex items-center space-x-2 text-xs font-medium text-slate-500">
                                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  <span>Dernière séance: <span className="text-slate-900 font-bold">{bestSet.weight}kg x {bestSet.reps}</span> ({new Date(lastDate).toLocaleDateString()})</span>
                                </div>
                              );
                            }
                            return null;
                          })()
                        }

                        {
                          isSwapping && (
                            <div className="ios-card p-6 bg-blue-600 text-white space-y-4 animate-slide-up">
                              <div className="flex justify-between items-center">
                                <h4 className="font-bold">Alternatives AI pour {ex?.name}</h4>
                                <button onClick={() => setSwappingExerciseId(null)} className="text-white/60">Fermer</button>
                              </div>
                              {isFindingAlternatives ? (
                                <div className="flex items-center space-x-3 text-sm italic py-4">
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Recherche de matériel équivalent...</span>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {alternatives.map((alt, i) => (
                                    <button
                                      key={i}
                                      onClick={() => ex && executeSwap(ex.id, alt.name)}
                                      className="w-full text-left bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all"
                                    >
                                      <div className="font-bold">{alt.name}</div>
                                      <div className="text-xs opacity-70">{alt.reason}</div>
                                    </button>
                                  ))}
                                  <div className="pt-2">
                                    <input
                                      type="text"
                                      placeholder="Ou tapez un autre exercice..."
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && ex) executeSwap(ex.id, (e.target as HTMLInputElement).value);
                                      }}
                                      className="w-full bg-white/20 border-none rounded-lg px-4 py-2 text-sm placeholder:text-white/40 focus:ring-0"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        }

                        <div className="ios-card overflow-hidden">
                          {sets.map((s, idx) => (
                            <div key={s.id} className={`ios-list-item px-6 py-5 flex items-center justify-between transition-colors ${s.completed ? 'bg-green-50/50' : 'hover:bg-slate-50'}`}>
                              <div className="flex items-center space-x-6">
                                <div className="w-8 h-8 flex items-center justify-center bg-slate-900 text-white rounded-xl text-xs font-black">
                                  {idx + 1}
                                </div>
                                <div className="flex space-x-6">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Poids</span>
                                    <input
                                      type="number" step="0.5" value={s.weight}
                                      onChange={(e) => updateSetData(s.id, 'weight', parseFloat(e.target.value) || 0)}
                                      className="text-lg font-bold bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none w-16"
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Reps</span>
                                    <input
                                      type="number" value={s.reps}
                                      onChange={(e) => updateSetData(s.id, 'reps', parseInt(e.target.value) || 0)}
                                      className="text-lg font-bold bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none w-12"
                                    />
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleCompleteSet(s.id)}
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${s.completed ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-slate-100 text-slate-300'}`}
                              >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


          {activeTab === 'plan' && (
            <div className="max-w-4xl mx-auto space-y-10 animate-slide-up">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-slate-900">Gestion des routines</h2>
                  <p className="text-slate-500 font-medium">Créez et personnalisez vos jours d'entraînement.</p>
                </div>
                <button
                  onClick={() => {
                    const newRoutine: Routine = { id: Math.random().toString(36).substr(2, 9), name: 'Nouvelle Routine', exerciseIds: [] };
                    const updated = [...routines, newRoutine];
                    setRoutines(updated);
                    saveRoutines(updated);
                    switchActiveRoutine(newRoutine.id);
                  }}
                  className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center space-x-2 shadow-lg"
                >
                  <IconPlus className="w-5 h-5" />
                  <span>Nouvelle Routine</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {routines.map(r => (
                  <div
                    key={r.id}
                    className={`p-6 rounded-3xl border-2 transition-all flex flex-col ${activeRoutineId === r.id ? 'border-blue-600 bg-blue-50/20 shadow-lg' : 'border-white bg-white shadow-sm hover:border-slate-100'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="font-bold text-lg text-slate-900">{r.name}</div>
                      <button
                        onClick={() => {
                          const updated = routines.filter(rt => rt.id !== r.id);
                          setRoutines(updated);
                          saveRoutines(updated);
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                      </button>
                    </div>

                    <div className="flex-1 space-y-2 mb-6">
                      {r.exerciseIds.length === 0 ? (
                        <div className="text-xs text-slate-400 italic">Aucun exercice</div>
                      ) : (
                        r.exerciseIds.slice(0, 4).map(eid => (
                          <div key={eid} className="text-xs font-semibold text-slate-500 flex items-center">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></div>
                            {exercises.find(e => e.id === eid)?.name}
                          </div>
                        ))
                      )}
                      {r.exerciseIds.length > 4 && <div className="text-[10px] font-black text-blue-500 uppercase">+{r.exerciseIds.length - 4} AUTRES</div>}
                    </div>

                    <button
                      onClick={() => switchActiveRoutine(r.id)}
                      className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${activeRoutineId === r.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {activeRoutineId === r.id ? 'Routine Active' : 'Sélectionner'}
                    </button>
                  </div>
                ))}
              </div>

              {activeRoutine && (
                <div className="mt-12 space-y-6">
                  <h3 className="text-xl font-bold">Modifier "{activeRoutine.name}"</h3>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ajouter un exo via IA (ex: 'Developpé incliné haltères')..."
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomExercise(false)}
                      className="w-full pl-6 pr-14 py-5 bg-white ios-card focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-lg"
                    />
                    <button onClick={() => handleAddCustomExercise(false)} disabled={isAnalyzing} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-blue-600">
                      {isAnalyzing ? <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <IconPlus className="w-8 h-8" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {exercises.map(ex => {
                      const isSelected = activeRoutine.exerciseIds.includes(ex.id);
                      return (
                        <div key={ex.id} className={`rounded-2xl border-2 transition-all ${isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-white bg-white hover:border-slate-100'}`}>
                          <div className="p-4 flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-900">{ex.name}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase">{ex.muscleGroup}</div>
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
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}
                            >
                              {isSelected ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /></svg> : <IconPlus className="w-4 h-4 text-slate-400" />}
                            </button>
                          </div>

                          {isSelected && (
                            <div className="px-4 pb-4 flex items-center justify-between text-sm border-t border-blue-200/50 pt-3 mt-1">
                              <span className="text-slate-500 font-bold text-xs uppercase">Objectifs:</span>
                              <div className="flex space-x-4">
                                <label className="flex items-center space-x-2">
                                  <span className="text-xs font-semibold text-slate-400">Séries</span>
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
                                    className="w-12 bg-slate-100 rounded-lg px-2 py-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </label>
                                <label className="flex items-center space-x-2">
                                  <span className="text-xs font-semibold text-slate-400">Reps</span>
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
                                    className="w-12 bg-slate-100 rounded-lg px-2 py-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
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
      </div>

      {isTimerVisible && <Timer initialSeconds={90} onClose={() => setIsTimerVisible(false)} />}
    </div>
  );
};

export default App;
