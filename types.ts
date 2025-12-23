
export enum MuscleGroup {
  Chest = 'Chest',
  Back = 'Back (Posterior Chain)',
  Legs = 'Legs',
  Shoulders = 'Shoulders',
  Arms = 'Arms',
  Core = 'Core'
}

export interface Exercise {
  id: string;
  user_id?: string;
  name: string;
  muscleGroup: MuscleGroup;
  referenceWeight: number;
}

export interface SetLog {
  id: string;
  user_id?: string;
  exerciseId: string;
  date: string; // ISO string
  weight: number;
  reps: number;
  targetReps: number;
  completed: boolean;
}

export interface Routine {
  id: string;
  user_id?: string;
  name: string;
  exerciseIds: string[];
  targets?: Record<string, { sets: number; reps: number }>; // exerciseId -> target config
}

export interface WorkoutPlan {
  id: string;
  exerciseIds: string[];
}

export interface WeeklyVolume {
  muscle: MuscleGroup;
  count: number;
  goal: number;
}
