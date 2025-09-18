import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  AppState,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

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
  const loadMeals = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setMealsByDate(raw ? JSON.parse(raw) : {});
    } catch {
      setMealsByDate({});
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
  
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (raw) setMealsByDate(JSON.parse(raw));
        else setMealsByDate({});
      } catch {
        setMealsByDate({});
      }
    })();
    const sub = AsyncStorage; // placeholder to keep lints calm; no live updates available
    return () => {
      mounted = false;
    };
  }, []);

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
    <View key={m.id} style={styles.mealRow}>
      <Text style={styles.mealName}>{m.name}</Text>
      <Text style={styles.mealCalories}>{m.calories} kcal</Text>
    </View>
  );

  const renderItem = ({ item: dateKey }: { item: string }) => {
    const meals = mealsByDate[dateKey] || [];
    const total = totals[dateKey] ?? 0;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardDate}>{dateKey}</Text>
          <Text style={styles.cardTotal}>{total} kcal</Text>
        </View>
        {meals.length === 0 ? (
          <Text style={styles.emptyMeals}>No meals logged.</Text>
        ) : (
          <View style={styles.mealsList}>{meals.map(renderMeal)}</View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={dateKeys}
        keyExtractor={(k) => k}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 12 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },
  card: {
    backgroundColor: "#FFFFFF",
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
  cardTotal: { fontSize: 16, fontWeight: "700", color: "#334155" },
  mealsList: { gap: 8 },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  mealName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  mealCalories: { fontSize: 14, color: "#64748B" },
  emptyMeals: { color: "#64748B" },
});
