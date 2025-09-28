import AsyncStorage from "@react-native-async-storage/async-storage";

const CALORIE_GOAL_KEY = "CALORIE_GOAL_V1";

// Calorie goal functions
let currentGoal: number = 2000; // default goal
const goalListeners: Array<(value: number) => void> = [];

export async function getCalorieGoal(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(CALORIE_GOAL_KEY);
    const goal = v ? parseInt(v, 10) : 2000;
    currentGoal = goal;
    return goal;
  } catch {
    return 2000;
  }
}

export async function setCalorieGoal(goal: number): Promise<void> {
  currentGoal = goal;
  try {
    await AsyncStorage.setItem(CALORIE_GOAL_KEY, String(goal));
  } catch {}
  for (const l of goalListeners) l(currentGoal);
}

export function subscribeCalorieGoal(listener: (value: number) => void): () => void {
  goalListeners.push(listener);
  // call immediately with current cached value if available
  listener(currentGoal);
  return () => {
    const i = goalListeners.indexOf(listener);
    if (i >= 0) goalListeners.splice(i, 1);
  };
}

