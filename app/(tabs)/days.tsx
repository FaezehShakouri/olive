import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  FlatList,
  StyleSheet,
  AppState,
} from "react-native";
import { ThemedSafeAreaView } from '@/components/safe-area-view';
import { useFocusEffect } from "@react-navigation/native";
import { getAllMealsGroupedByDate, getTotalsByDate } from "@/lib/db";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
type Meal = { id: string; name: string; calories: number };
type MealsByDate = Record<string, Meal[]>;

const STORAGE_KEY = "MEALS_BY_DATE_V1";

function formatDateKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DaysScreen() {
  const [mealsByDate, setMealsByDate] = useState<MealsByDate>({});
  const [totalMeals, setTotalMeals] = useState<Record<string, number>>({});
  const loadMeals = useCallback(async () => {
    try {
      const map = await getAllMealsGroupedByDate();
      setMealsByDate(map);
      const t = await getTotalsByDate();
      setTotalMeals(t);
    } catch {
      setMealsByDate({});
      setTotalMeals({});
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  // Reload when tab gains focus
  useFocusEffect(
    useCallback(() => {
      loadMeals();
    }, [loadMeals])
  );

  // Reload when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") loadMeals();
    });
    return () => sub.remove();
  }, [loadMeals]);

  const todayKey = formatDateKey(new Date());

  const dateKeys = useMemo(() => {
    const keys = Object.keys(mealsByDate);
    if (!keys.includes(todayKey)) keys.push(todayKey);
    return keys
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)); // desc, today first
  }, [mealsByDate, todayKey]);

  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const k of dateKeys) {
      const meals = mealsByDate[k] || [];
      map[k] = meals.reduce((sum, m) => {
        const c = Number(m.calories);
        return sum + (Number.isFinite(c) ? c : 0);
      }, 0);
    }
    return map;
  }, [dateKeys, mealsByDate]);

  const renderMeal = (m: Meal) => (
    <ThemedView key={m.id} style={styles.mealRow} darkColor="#333333">
      <ThemedText style={styles.mealName}>{m.name}</ThemedText>
      <ThemedText style={styles.mealCalories}>{m.calories} kcal</ThemedText>
    </ThemedView>
  );

  const renderItem = ({ item: dateKey }: { item: string }) => {
    const meals = mealsByDate[dateKey] || [];
    const total = totals[dateKey] ?? 0;
    return (
      <ThemedView style={styles.card} darkColor="#333333">
        <ThemedView style={styles.cardHeader} darkColor="#333333">
          <ThemedText style={styles.cardDate}>{dateKey}</ThemedText>
          <ThemedText style={styles.cardTotal}>{total} kcal</ThemedText>
        </ThemedView>
        {meals.length === 0 ? (
          <ThemedText style={styles.emptyMeals}>No meals logged.</ThemedText>
        ) : (
          <ThemedView style={styles.mealsList} darkColor="#333333">{meals.map(renderMeal)}</ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedSafeAreaView style={{flex: 1}}>
      <FlatList
        data={dateKeys}
        keyExtractor={(k) => k}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 12 }}
      />
    </ThemedSafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardDate: { fontSize: 18, fontWeight: "700" },
  cardTotal: { fontSize: 16, fontWeight: "700" },
  mealsList: { gap: 8 },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  mealName: { fontSize: 16, fontWeight: "600" },
  mealCalories: { fontSize: 14 },
  emptyMeals: {},
});
