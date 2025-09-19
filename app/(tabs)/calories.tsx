import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from 'react-native-safe-area-context';

const STORAGE_KEY = "MEALS_BY_DATE_V1";

function formatDateKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

type Meal = { id: string; name: string; calories: number };
type MealsByDate = Record<string, Meal[]>;

export default function CaloriesScreen() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [mealsByDate, setMealsByDate] = useState<MealsByDate>({});
  const [mealName, setMealName] = useState("");
  const [mealCalories, setMealCalories] = useState("");

  const dateKey = formatDateKey(currentDate);
  const todaysMeals = mealsByDate[dateKey] || [];

  const totalCalories = useMemo(
    () =>
      todaysMeals.reduce((sum, m) => {
        const c = Number(m.calories);
        return sum + (Number.isFinite(c) ? c : 0);
      }, 0),
    [todaysMeals]
  );

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setMealsByDate(JSON.parse(raw));
      } catch (e) {
        console.warn("Failed to load data", e);
      }
    })();
  }, []);

  const persist = async (next: MealsByDate) => {
    try {
      setMealsByDate(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to save data", e);
      Alert.alert("Save error", "Could not save your data.");
    }
  };

  const onAddMeal = async () => {
    const name = mealName.trim();
    const calories = parseFloat(mealCalories);
    if (!name) {
      Alert.alert("Missing name", "Please enter a meal name.");
      return;
    }
    if (!Number.isFinite(calories) || calories <= 0) {
      Alert.alert("Invalid calories", "Enter a positive number.");
      return;
    }
    const id = String(Date.now());
    const next: MealsByDate = {
      ...mealsByDate,
      [dateKey]: [...todaysMeals, { id, name, calories }],
    };
    await persist(next);
    setMealName("");
    setMealCalories("");
  };

  const onDeleteMeal = async (id: string) => {
    const next: MealsByDate = {
      ...mealsByDate,
      [dateKey]: todaysMeals.filter((m) => m.id !== id),
    };
    await persist(next);
  };

  const goToday = () => setCurrentDate(new Date());

  const renderItem = ({ item }: { item: Meal }) => (
    <View style={styles.mealRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.mealName}>{item.name}</Text>
        <Text style={styles.mealCalories}>{item.calories} kcal</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDeleteMeal(item.id)}
      >
        <Text style={styles.deleteBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const canAdd = mealName.trim().length > 0 && Number(mealCalories) > 0;

  return (
    <SafeAreaProvider style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentDate((d) => addDays(d, -1))}
          >
            <Text style={styles.navBtnText}>{"‹"}</Text>
          </TouchableOpacity>
          <View style={styles.dateBox}>
            <Text style={styles.dateText}>{dateKey}</Text>
            <TouchableOpacity onPress={goToday}>
              <Text style={styles.todayText}>Today</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentDate((d) => addDays(d, 1))}
          >
            <Text style={styles.navBtnText}>{"›"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{totalCalories} kcal</Text>
        </View>

        <View style={styles.inputCard}>
          <TextInput
            placeholder="Meal name (e.g., Chicken salad)"
            value={mealName}
            onChangeText={setMealName}
            style={styles.input}
            returnKeyType="next"
          />
          <TextInput
            placeholder="Calories (e.g., 450)"
            value={mealCalories}
            onChangeText={setMealCalories}
            keyboardType="numeric"
            style={styles.input}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !canAdd && { opacity: 0.5 }]}
            onPress={onAddMeal}
            disabled={!canAdd}
          >
            <Text style={styles.addBtnText}>Add Meal</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={todaysMeals}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            todaysMeals.length === 0 && { flex: 1, justifyContent: "center" }
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No meals yet. Add your first meal for {dateKey}.
            </Text>
          }
          style={{ flex: 1 }}
        />
      </KeyboardAvoidingView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EDEDED",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: { fontSize: 24, fontWeight: "600" },
  dateBox: { flex: 1, alignItems: "center" },
  dateText: { fontSize: 18, fontWeight: "700" },
  todayText: { marginTop: 2, color: "#3B82F6", fontWeight: "600" },

  totalBox: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  totalLabel: { fontSize: 16, color: "#555" },
  totalValue: { fontSize: 24, fontWeight: "800" },

  inputCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  input: {
    backgroundColor: "#F2F2F2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  addBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 12,
  },
  addBtnText: { color: "white", fontWeight: "700", fontSize: 16 },

  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  mealName: { fontSize: 16, fontWeight: "700" },
  mealCalories: { color: "#666", marginTop: 2 },
  deleteBtn: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteBtnText: { color: "white", fontWeight: "700" },

  emptyText: { textAlign: "center", color: "#777" },
});
