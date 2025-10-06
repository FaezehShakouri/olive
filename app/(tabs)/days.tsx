import { ThemedSafeAreaView } from "@/components/safe-area-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getAllMealsGroupedByDate, getTotalsByDate } from "@/lib/db";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, FlatList, StyleSheet, TouchableOpacity } from "react-native";

type Meal = {
  id: string;
  name: string;
  calories: number;
  time: string;
  ingredients?: string;
  created_at?: number;
};
type MealsByDate = Record<string, Meal[]>;

// Helper function to format time from 24-hour to 12-hour AM/PM format
const formatTime = (time24: string): string => {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

// Helper function to format creation date and time for meal display
const formatMealCreationTime = (created_at?: number): string => {
  if (!created_at) {
    return "Unknown time";
  }

  const creationDate = new Date(created_at);
  const time = formatTime(creationDate.toTimeString().slice(0, 5));
  const date = creationDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${time} • ${date}`;
};

// Helper function to format date relatively
const formatRelativeDate = (dateKey: string): string => {
  const today = new Date();
  const targetDate = new Date(dateKey);

  // Reset time to start of day for accurate comparison
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays <= 30) {
    return `${diffDays} days ago`;
  } else {
    // For dates older than 1 month, show the actual date
    return targetDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
};

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

  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());

  const toggleMealExpansion = (mealId: string) => {
    setExpandedMeals((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(mealId)) {
        newSet.delete(mealId);
      } else {
        newSet.add(mealId);
      }
      return newSet;
    });
  };

  const renderMeal = (m: Meal) => {
    const isExpanded = expandedMeals.has(m.id);
    const hasIngredients = m.ingredients && m.ingredients.trim().length > 0;
    const ingredients = m.ingredients?.trim() || "";
    const isLongIngredients = ingredients.length > 50; // Threshold for showing "Tap to see more"

    return (
      <TouchableOpacity
        key={m.id}
        style={[
          styles.mealRow,
          hasIngredients && styles.mealRowClickable,
          isExpanded && styles.mealRowExpanded,
        ]}
        onPress={() => hasIngredients && toggleMealExpansion(m.id)}
        disabled={!hasIngredients}
      >
        <ThemedView style={styles.mealInfo}>
          <ThemedText
            style={styles.mealName}
            numberOfLines={isExpanded ? undefined : 1}
            ellipsizeMode="tail"
          >
            {isExpanded && hasIngredients ? ingredients : m.name}
          </ThemedText>
          <ThemedText style={styles.mealTime}>
            {formatMealCreationTime(m.created_at)}
          </ThemedText>
          {hasIngredients && isLongIngredients && !isExpanded && (
            <ThemedText style={styles.tapToSeeMore}>Tap to see more</ThemedText>
          )}
        </ThemedView>
        <ThemedText style={styles.mealCalories}>{m.calories} kcal</ThemedText>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item: dateKey }: { item: string }) => {
    const meals = mealsByDate[dateKey] || [];
    const total = totals[dateKey] ?? 0;
    return (
      <ThemedView style={styles.card}>
        <ThemedView style={styles.cardHeader}>
          <ThemedText style={styles.cardDate}>
            {formatRelativeDate(dateKey)}
          </ThemedText>
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
    backgroundColor: "rgba(156, 175, 136, 0.08)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  cardDate: { fontSize: 18, fontWeight: "400", backgroundColor: "transparent" },
  cardTotal: {
    fontSize: 16,
    fontWeight: "600",
    opacity: 0.8,
    backgroundColor: "transparent",
  },
  mealsList: { gap: 6, backgroundColor: "transparent" },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(107, 142, 35, 0.2)",
  },
  mealRowClickable: {
    backgroundColor: "rgba(107, 142, 35, 0.02)",
    borderColor: "rgba(107, 142, 35, 0.3)",
  },
  mealRowExpanded: {
    backgroundColor: "rgba(107, 142, 35, 0.05)",
    borderColor: "rgba(107, 142, 35, 0.4)",
  },
  mealInfo: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
    backgroundColor: "transparent",
  },
  mealName: {
    fontSize: 15,
    fontWeight: "400",
    backgroundColor: "transparent",
    marginBottom: 2,
    lineHeight: 18,
  },
  mealTime: {
    fontSize: 10,
    opacity: 0.6,
    fontWeight: "300",
    color: "#6B8E23",
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  mealIngredients: {
    fontSize: 12,
    color: "#D1D5DB",
    fontWeight: "400",
    marginTop: 3,
    fontStyle: "italic",
    lineHeight: 14,
    opacity: 0.7,
  },
  tapToSeeMore: {
    fontSize: 10,
    color: "#6B8E23",
    fontWeight: "500",
    marginTop: 2,
    fontStyle: "italic",
    opacity: 0.8,
  },
  mealCalories: {
    fontSize: 13,
    flexShrink: 0,
    textAlign: "right",
    opacity: 0.7,
    backgroundColor: "transparent",
  },
  emptyMeals: { opacity: 0.6, fontSize: 14, fontWeight: "300" },
});
