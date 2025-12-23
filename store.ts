
import { Exercise, SetLog, MuscleGroup, Routine } from './types';

const STORAGE_KEYS = {
  EXERCISES: 'purelift_exercises',
  SETS: 'purelift_sets',
  ROUTINES: 'purelift_routines',
  ACTIVE_ROUTINE_ID: 'purelift_active_routine_id'
};

const DEFAULT_EXERCISES: Exercise[] = [
  { id: '1', name: 'Bench Press', muscleGroup: MuscleGroup.Chest, referenceWeight: 60 },
  { id: '2', name: 'Deadlift', muscleGroup: MuscleGroup.Back, referenceWeight: 100 },
  { id: '3', name: 'Squat', muscleGroup: MuscleGroup.Legs, referenceWeight: 80 },
  { id: '4', name: 'Overhead Press', muscleGroup: MuscleGroup.Shoulders, referenceWeight: 40 },
  { id: '5', name: 'Bicep Curls', muscleGroup: MuscleGroup.Arms, referenceWeight: 15 },
  { id: '6', name: 'Plank', muscleGroup: MuscleGroup.Core, referenceWeight: 0 },
  { id: '7', name: 'Pull-ups', muscleGroup: MuscleGroup.Back, referenceWeight: 0 },
  { id: '8', name: 'Dips', muscleGroup: MuscleGroup.Chest, referenceWeight: 0 },
  { id: '9', name: 'Dumbbell Rows', muscleGroup: MuscleGroup.Back, referenceWeight: 24 },
  { id: '10', name: 'Leg Press', muscleGroup: MuscleGroup.Legs, referenceWeight: 120 },
  { id: '11', name: 'Lateral Raises', muscleGroup: MuscleGroup.Shoulders, referenceWeight: 8 },
  { id: '12', name: 'Tricep Extensions', muscleGroup: MuscleGroup.Arms, referenceWeight: 20 }
];

const DEFAULT_ROUTINES: Routine[] = [
  { id: 'ppl-push', name: 'PPL - Push (Chest/Shoulders)', exerciseIds: ['1', '4', '8', '11'] },
  { id: 'ppl-pull', name: 'PPL - Pull (Back/Biceps)', exerciseIds: ['2', '7', '9', '5'] },
  { id: 'ppl-legs', name: 'PPL - Legs', exerciseIds: ['3', '10', '6'] },
  { id: 'full-body', name: 'Full Body Essentials', exerciseIds: ['1', '2', '3', '4'] }
];

export const getExercises = (): Exercise[] => {
  const data = localStorage.getItem(STORAGE_KEYS.EXERCISES);
  return data ? JSON.parse(data) : DEFAULT_EXERCISES;
};

export const saveExercise = (exercise: Exercise) => {
  const exercises = getExercises();
  const index = exercises.findIndex(e => e.id === exercise.id);
  if (index >= 0) exercises[index] = exercise;
  else exercises.push(exercise);
  localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
};

export const getSets = (): SetLog[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SETS);
  return data ? JSON.parse(data) : [];
};

export const saveSets = (sets: SetLog[]) => {
  const allSets = getSets();
  const updated = [...allSets, ...sets];
  localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(updated));
};

export const getRoutines = (): Routine[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ROUTINES);
  return data ? JSON.parse(data) : DEFAULT_ROUTINES;
};

export const saveRoutines = (routines: Routine[]) => {
  localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
};

export const getActiveRoutineId = (): string => {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_ROUTINE_ID) || DEFAULT_ROUTINES[0].id;
};

export const setActiveRoutineId = (id: string) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_ROUTINE_ID, id);
};
