
import { supabase } from './supabaseClient';
import { Exercise, SetLog, Routine, MuscleGroup } from './types';

// Auth State
export const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    if (error) throw error;
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

// Helper functions to map between DB snake_case and TS camelCase
const mapExerciseFromDB = (row: any): Exercise => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    muscleGroup: row.muscle_group as MuscleGroup,
    referenceWeight: row.reference_weight
});

const mapExerciseToDB = (ex: Exercise, userId: string) => ({
    id: ex.id,
    user_id: userId,
    name: ex.name,
    muscle_group: ex.muscleGroup,
    reference_weight: ex.referenceWeight
});

const mapSetLogFromDB = (row: any): SetLog => ({
    id: row.id,
    user_id: row.user_id,
    exerciseId: row.exercise_id,
    date: row.date,
    weight: row.weight,
    reps: row.reps,
    targetReps: row.target_reps,
    completed: row.completed
});

const mapSetLogToDB = (s: SetLog, userId: string) => ({
    id: s.id,
    user_id: userId,
    exercise_id: s.exerciseId,
    date: s.date,
    weight: s.weight,
    reps: s.reps,
    target_reps: s.targetReps,
    completed: s.completed
});

const mapRoutineFromDB = (row: any): Routine => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    exerciseIds: row.exercise_ids || [],
    targets: row.targets || {}
});

const mapRoutineToDB = (r: Routine, userId: string) => ({
    id: r.id,
    user_id: userId,
    name: r.name,
    exercise_ids: r.exerciseIds,
    targets: r.targets || {}
});

// Exercises
export const getExercises = async (): Promise<Exercise[]> => {
    const { data, error } = await supabase.from('exercises').select('*');
    if (error) throw error;
    return (data || []).map(mapExerciseFromDB);
};

export const saveExercise = async (exercise: Exercise) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const dbExercise = mapExerciseToDB(exercise, userData.user.id);
    const { error } = await supabase.from('exercises').upsert(dbExercise);
    if (error) throw error;
};

// Sets
export const getSets = async (): Promise<SetLog[]> => {
    const { data, error } = await supabase.from('set_logs').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapSetLogFromDB);
};

export const saveSets = async (sets: SetLog[]) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const dbSets = sets.map(s => mapSetLogToDB(s, userData.user!.id));
    const { error } = await supabase.from('set_logs').insert(dbSets);
    if (error) throw error;
};

// Routines
export const getRoutines = async (): Promise<Routine[]> => {
    const { data, error } = await supabase.from('routines').select('*');
    if (error) throw error;
    return (data || []).map(mapRoutineFromDB);
};

export const saveRoutines = async (routines: Routine[]) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const dbRoutines = routines.map(r => mapRoutineToDB(r, userData.user!.id));
    const { error } = await supabase.from('routines').upsert(dbRoutines);
    if (error) throw error;
};

export const deleteRoutine = async (id: string) => {
    const { error } = await supabase.from('routines').delete().eq('id', id);
    if (error) throw error;
};
