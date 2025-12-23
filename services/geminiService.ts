
import { GoogleGenAI, Type } from "@google/genai";
import { WeeklyVolume, MuscleGroup } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const getCoachInsight = async (volumes: WeeklyVolume[]): Promise<string> => {
  const volumeSummary = volumes.map(v => `${v.muscle}: ${v.count}/${v.goal} sets`).join(', ');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert bodybuilding coach named "PureCoach". Based on this week's volume: ${volumeSummary}, give a very short (max 2 sentences), encouraging, and professional insight. Focus on what's missing or congratulate on high volume. Use a direct, minimalist tone.`,
    });
    return response.text || "Keep pushing, consistency is key to growth.";
  } catch (error) {
    console.error("Coach insight error:", error);
    return "Focus on progressive overload and hitting your weekly volume goals.";
  }
};

export const analyzeExercise = async (userInput: string): Promise<{ name: string; muscleGroup: MuscleGroup; suggestedWeight: number }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this exercise input: "${userInput}". Categorize it into one of these muscle groups: ${Object.values(MuscleGroup).join(', ')}. Provide a suggested starting weight in kg for an intermediate lifter.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Corrected formal name of the exercise" },
            muscleGroup: { type: Type.STRING, enum: Object.values(MuscleGroup), description: "The primary muscle group targeted" },
            suggestedWeight: { type: Type.NUMBER, description: "Suggested starting weight in kg" }
          },
          required: ["name", "muscleGroup", "suggestedWeight"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      name: result.name || userInput,
      muscleGroup: (result.muscleGroup as MuscleGroup) || MuscleGroup.Chest,
      suggestedWeight: result.suggestedWeight || 20
    };
  } catch (error) {
    console.error("AI Analysis error:", error);
    return { name: userInput, muscleGroup: MuscleGroup.Chest, suggestedWeight: 20 };
  }
};

export const getExerciseAlternatives = async (exerciseName: string, muscleGroup: MuscleGroup): Promise<{ name: string; reason: string }[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The user is at the gym and the machine for "${exerciseName}" (${muscleGroup}) is unavailable. Suggest 3 direct alternatives targeting the same muscle group. For each, give the name and a very brief reason why it's a good swap.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ["name", "reason"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("AI Alternatives error:", error);
    return [];
  }
};

export const getFormTips = async (exerciseName: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert strength coach. Give exactly 3 concise, actionable form tips for the exercise "${exerciseName}". Each tip should be one short sentence focusing on technique, safety, or muscle activation. Return as JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("AI Form Tips error:", error);
    return ["Gardez le dos droit", "Contrôlez le mouvement", "Respirez correctement"];
  }
};

export const generateRoutine = async (prompt: string): Promise<{ routineName: string; exercises: { name: string; muscleGroup: MuscleGroup; suggestedWeight: number; targetSets: number; targetReps: number }[] }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create a comprehensive workout routine based on this request: "${prompt}". 
      Return a JSON object with a creative 'routineName' and an array of 'exercises'. 
      For each exercise, provide:
      - 'name' (formal exercise name)
      - 'muscleGroup' (one of: ${Object.values(MuscleGroup).join(', ')})
      - 'suggestedWeight' (number, in kg, reasonable for intermediate)
      - 'targetSets' (integer, usually 3-5)
      - 'targetReps' (integer, usually 8-15)
      Ensure the routine is balanced and effective.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            routineName: { type: Type.STRING },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  muscleGroup: { type: Type.STRING, enum: Object.values(MuscleGroup) },
                  suggestedWeight: { type: Type.NUMBER },
                  targetSets: { type: Type.INTEGER },
                  targetReps: { type: Type.INTEGER }
                },
                required: ["name", "muscleGroup", "suggestedWeight", "targetSets", "targetReps"]
              }
            }
          },
          required: ["routineName", "exercises"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      routineName: result.routineName || "New Routine",
      exercises: result.exercises || []
    };
  } catch (error) {
    console.error("AI Routine Generation error:", error);
    return { routineName: "New Routine", exercises: [] };
  }
};
