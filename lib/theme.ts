import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeOverride = "light" | "dark" | null;

const STORAGE_KEY = "THEME_OVERRIDE_V1";
const CALORIE_GOAL_KEY = "CALORIE_GOAL_V1";
let currentOverride: ThemeOverride = null;
const listeners: Array<(value: ThemeOverride) => void> = [];

export async function getThemeOverride(): Promise<ThemeOverride> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
    return null;
  } catch {
    return null;
  }
}

export async function setThemeOverride(value: ThemeOverride): Promise<void> {
  currentOverride = value;
  try {
    if (value === null) await AsyncStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.setItem(STORAGE_KEY, value);
  } catch {}
  for (const l of listeners) l(currentOverride);
}

export function subscribeTheme(listener: (value: ThemeOverride) => void): () => void {
  listeners.push(listener);
  // call immediately with current cached value if available
  listener(currentOverride);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
}

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

