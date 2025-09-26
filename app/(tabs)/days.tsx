import { ThemedSafeAreaView } from "@/components/safe-area-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getAllMealsGroupedByDate, getTotalsByDate } from "@/lib/db";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, FlatList, StyleSheet } from "react-native";
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
    <ThemedView key={m.id} style={styles.mealRow}>
      <ThemedText
        style={styles.mealName}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {m.name}
      </ThemedText>
      <ThemedText style={styles.mealCalories}>{m.calories} kcal</ThemedText>
    </ThemedView>
  );

  const renderItem = ({ item: dateKey }: { item: string }) => {
    const meals = mealsByDate[dateKey] || [];
    const total = totals[dateKey] ?? 0;
    return (
      <ThemedView style={styles.card}>
        <ThemedView style={styles.cardHeader}>
          <ThemedText style={styles.cardDate}>{dateKey}</ThemedText>
          <ThemedText style={styles.cardTotal}>{total} kcal</ThemedText>
        </ThemedView>
        {meals.length === 0 ? (
          <ThemedText style={styles.emptyMeals}>No meals logged.</ThemedText>
        ) : (
          <ThemedView style={styles.mealsList}>
            {meals.map(renderMeal)}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedSafeAreaView style={{ flex: 1 }}>
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
    marginHorizontal: 20,
    marginVertical: 6,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "transparent",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardDate: { fontSize: 18, fontWeight: "400" },
  cardTotal: { fontSize: 16, fontWeight: "300", opacity: 0.8 },
  mealsList: { gap: 6 },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(107, 114, 128, 0.05)",
  },
  mealName: {
    fontSize: 15,
    fontWeight: "400",
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  mealCalories: {
    fontSize: 13,
    flexShrink: 0,
    textAlign: "right",
    opacity: 0.7,
  },
  emptyMeals: { opacity: 0.6, fontSize: 14, fontWeight: "300" },
});
