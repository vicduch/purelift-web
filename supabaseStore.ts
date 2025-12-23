
import { supabase } from './supabaseClient';
import { Exercise, SetLog, Routine, MuscleGroup, UserSettings, DEFAULT_VOLUME_GOALS } from './types';

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

// User Settings
export const getUserSettings = async (): Promise<UserSettings | null> => {
    // Using limit(1) instead of single() to avoid 406 Not Acceptable if multiple rows exist (due to poor previous upsert logic)
    const { data, error } = await supabase.from('user_settings').select('*').limit(1);
    if (error) {
        console.error('Get settings error:', error);
        return null;
    }
    if (!data || data.length === 0) return null;
    const row = data[0];
    return {
        id: row.id,
        user_id: row.user_id,
        volumeGoals: row.volume_goals || DEFAULT_VOLUME_GOALS,
        defaultRestTime: row.default_rest_time || 90
    };
};

export const saveUserSettings = async (settings: UserSettings) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // We use the user_id as the predictable primary key ID if not provided, 
    // to ensure we only ever have ONE row per user in the table.
    const dbSettings = {
        id: settings.id || `settings_${userData.user.id}`,
        user_id: userData.user.id,
        volume_goals: settings.volumeGoals,
        default_rest_time: settings.defaultRestTime
    };
    const { error } = await supabase.from('user_settings').upsert(dbSettings);
    if (error) throw error;
};

// Default PPL Templates
const DEFAULT_EXERCISES: Exercise[] = [
    // Push
    { id: 'ex-bench', name: 'Bench Press', muscleGroup: MuscleGroup.Chest, referenceWeight: 60 },
    { id: 'ex-ohp', name: 'Overhead Press', muscleGroup: MuscleGroup.Shoulders, referenceWeight: 40 },
    { id: 'ex-incline-db', name: 'Incline Dumbbell Press', muscleGroup: MuscleGroup.Chest, referenceWeight: 24 },
    { id: 'ex-lateral-raise', name: 'Lateral Raises', muscleGroup: MuscleGroup.Shoulders, referenceWeight: 8 },
    { id: 'ex-tricep-ext', name: 'Tricep Extensions', muscleGroup: MuscleGroup.Arms, referenceWeight: 20 },
    { id: 'ex-dips', name: 'Dips', muscleGroup: MuscleGroup.Chest, referenceWeight: 0 },
    // Pull
    { id: 'ex-deadlift', name: 'Deadlift', muscleGroup: MuscleGroup.Back, referenceWeight: 100 },
    { id: 'ex-pullups', name: 'Pull-ups', muscleGroup: MuscleGroup.Back, referenceWeight: 0 },
    { id: 'ex-barbell-row', name: 'Barbell Row', muscleGroup: MuscleGroup.Back, referenceWeight: 60 },
    { id: 'ex-cable-row', name: 'Cable Row', muscleGroup: MuscleGroup.Back, referenceWeight: 50 },
    { id: 'ex-bicep-curl', name: 'Bicep Curls', muscleGroup: MuscleGroup.Arms, referenceWeight: 15 },
    { id: 'ex-face-pull', name: 'Face Pulls', muscleGroup: MuscleGroup.Shoulders, referenceWeight: 20 },
    // Legs
    { id: 'ex-squat', name: 'Squat', muscleGroup: MuscleGroup.Legs, referenceWeight: 80 },
    { id: 'ex-leg-press', name: 'Leg Press', muscleGroup: MuscleGroup.Legs, referenceWeight: 120 },
    { id: 'ex-rdl', name: 'Romanian Deadlift', muscleGroup: MuscleGroup.Legs, referenceWeight: 60 },
    { id: 'ex-leg-curl', name: 'Leg Curl', muscleGroup: MuscleGroup.Legs, referenceWeight: 40 },
    { id: 'ex-calf-raise', name: 'Calf Raises', muscleGroup: MuscleGroup.Legs, referenceWeight: 60 },
    { id: 'ex-leg-ext', name: 'Leg Extensions', muscleGroup: MuscleGroup.Legs, referenceWeight: 40 }
];

const DEFAULT_ROUTINES: Routine[] = [
    {
        id: 'ppl-push',
        name: 'PPL - Push',
        exerciseIds: ['ex-bench', 'ex-ohp', 'ex-incline-db', 'ex-lateral-raise', 'ex-tricep-ext', 'ex-dips'],
        targets: {
            'ex-bench': { sets: 4, reps: 8 },
            'ex-ohp': { sets: 3, reps: 10 },
            'ex-incline-db': { sets: 3, reps: 10 },
            'ex-lateral-raise': { sets: 3, reps: 15 },
            'ex-tricep-ext': { sets: 3, reps: 12 },
            'ex-dips': { sets: 3, reps: 10 }
        }
    },
    {
        id: 'ppl-pull',
        name: 'PPL - Pull',
        exerciseIds: ['ex-deadlift', 'ex-pullups', 'ex-barbell-row', 'ex-cable-row', 'ex-bicep-curl', 'ex-face-pull'],
        targets: {
            'ex-deadlift': { sets: 3, reps: 5 },
            'ex-pullups': { sets: 3, reps: 8 },
            'ex-barbell-row': { sets: 3, reps: 10 },
            'ex-cable-row': { sets: 3, reps: 12 },
            'ex-bicep-curl': { sets: 3, reps: 12 },
            'ex-face-pull': { sets: 3, reps: 15 }
        }
    },
    {
        id: 'ppl-legs',
        name: 'PPL - Legs',
        exerciseIds: ['ex-squat', 'ex-leg-press', 'ex-rdl', 'ex-leg-curl', 'ex-calf-raise', 'ex-leg-ext'],
        targets: {
            'ex-squat': { sets: 4, reps: 6 },
            'ex-leg-press': { sets: 3, reps: 12 },
            'ex-rdl': { sets: 3, reps: 10 },
            'ex-leg-curl': { sets: 3, reps: 12 },
            'ex-calf-raise': { sets: 4, reps: 15 },
            'ex-leg-ext': { sets: 3, reps: 12 }
        }
    }
];

export const seedDefaultData = async (): Promise<{ exercises: Exercise[], routines: Routine[] }> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { exercises: [], routines: [] };

    const userId = userData.user.id;

    // Check if user already has data
    const existingExercises = await getExercises();
    const existingRoutines = await getRoutines();

    if (existingExercises.length > 0 || existingRoutines.length > 0) {
        return { exercises: existingExercises, routines: existingRoutines };
    }

    // Seed exercises
    const dbExercises = DEFAULT_EXERCISES.map(ex => mapExerciseToDB(ex, userId));
    const { error: exError } = await supabase.from('exercises').insert(dbExercises);
    if (exError) console.error('Seed exercises error:', exError);

    // Seed routines
    const dbRoutines = DEFAULT_ROUTINES.map(r => mapRoutineToDB(r, userId));
    const { error: rtError } = await supabase.from('routines').insert(dbRoutines);
    if (rtError) console.error('Seed routines error:', rtError);

    // Return freshly seeded data
    const exercises = await getExercises();
    const routines = await getRoutines();
    return { exercises, routines };
};
