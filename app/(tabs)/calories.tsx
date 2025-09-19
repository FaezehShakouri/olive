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
import { ThemedSafeAreaView } from '@/components/safe-area-view';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

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
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCalories, setEditCalories] = useState('');

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
  
  const confirmDeleteMeal = (id: string) => {
    Alert.alert('Delete meal', 'Are you sure you want to delete this meal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteMeal(id) },
    ]);
  };
  
  const startEdit = (m: Meal) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditCalories(String(m.calories));
  };
  
  const saveEdit = async () => {
    if (!editingId) return;
    const n = editName.trim();
    const c = Number(editCalories);
    if (!n || !Number.isFinite(c) || c <= 0) {
      Alert.alert('Invalid input', 'Enter a valid name and positive calories.');
      return;
    }
    const next: MealsByDate = {
      ...mealsByDate,
      [dateKey]: todaysMeals.map((m) => (m.id === editingId ? { ...m, name: n, calories: c } : m)),
    };
    await persist(next);
    setEditingId(null);
  };

  const goToday = () => setCurrentDate(new Date());

  const renderItem = ({ item }: { item: Meal }) => (
    <ThemedView style={styles.mealRow}>
      {editingId === item.id ? (
        <>
          <View style={{ flex: 1, gap: 6 }}>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Meal name"
              style={styles.input}
              placeholderTextColor="#6B7280"
            />
            <TextInput
              value={editCalories}
              onChangeText={setEditCalories}
              placeholder="Calories"
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor="#6B7280"
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <TouchableOpacity
              style={styles.iconBtnConfirm}
              onPress={saveEdit}
              accessibilityLabel="Save"
            >
              <IconSymbol name="checkmark" size={18} color="#2563EB" />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.mealName}>{item.name}</ThemedText>
            <ThemedText style={styles.mealCalories}>{item.calories} kcal</ThemedText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => startEdit(item)}
              accessibilityLabel="Edit meal"
            >
              <IconSymbol name="pencil" size={18} color="#2563EB" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtnDanger}
              onPress={() => confirmDeleteMeal(item.id)}
              accessibilityLabel="Delete meal"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <IconSymbol name="xmark" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </ThemedView>
  );

  const canAdd = mealName.trim().length > 0 && Number(mealCalories) > 0;

  return (
    <ThemedSafeAreaView style={{flex: 1}}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ThemedView style={styles.header}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentDate((d) => addDays(d, -1))}
          >
            <ThemedText style={styles.navBtnText} darkColor="#333333">{"‹"}</ThemedText>
          </TouchableOpacity>
          <ThemedView style={styles.dateBox}>
            <ThemedText style={styles.dateText}>{dateKey}</ThemedText>
            <TouchableOpacity onPress={goToday}>
              <ThemedText style={styles.todayText} darkColor="#A1CEDC">Today</ThemedText>
            </TouchableOpacity>
          </ThemedView>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentDate((d) => addDays(d, 1))}
          >
            <ThemedText style={styles.navBtnText} darkColor="#333333">{"›"}</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={styles.totalBox} darkColor="#333333">
          <ThemedText style={styles.totalLabel}>Total</ThemedText>
          <ThemedText style={styles.totalValue}>{totalCalories} kcal</ThemedText>
        </ThemedView>

        <ThemedView style={styles.inputCard}>
          <TextInput
            placeholder="Meal name (e.g., Chicken salad)"
            value={mealName}
            onChangeText={setMealName}
            style={styles.input}
            returnKeyType="next"
            placeholderTextColor="#6B7280"
          />
          <TextInput
            placeholder="Calories (e.g., 450)"
            value={mealCalories}
            onChangeText={setMealCalories}
            keyboardType="numeric"
            style={styles.input}
            returnKeyType="done"
            placeholderTextColor="#6B7280"
          />
          <TouchableOpacity
            style={[styles.addBtn, !canAdd && { opacity: 0.5 }]}
            onPress={onAddMeal}
            disabled={!canAdd}
          >
            <ThemedText style={styles.addBtnText}>Add Meal</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <FlatList
          data={todaysMeals}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            todaysMeals.length === 0 && { flex: 1, justifyContent: "center" }
          }
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>
              No meals yet. Add your first meal for {dateKey}.
            </ThemedText>
          }
          style={{ flex: 1 }}
        />
      </KeyboardAvoidingView>
    </ThemedSafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  todayText: { marginTop: 2, fontWeight: "600" },

  totalBox: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
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
  totalLabel: { fontSize: 16 },
  totalValue: { fontSize: 24, fontWeight: "800" },

  inputCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    color: "#111827",
  },
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDanger: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnConfirm: {
    backgroundColor: "#333333",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnConfirmText: { color: "white", fontWeight: "700" },
  addBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 12,
  },
  addBtnText: { fontWeight: "700", fontSize: 16 },

  mealRow: {
    flexDirection: "row",
    alignItems: "center",
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
  mealCalories: { marginTop: 2 },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: { color: "#EF4444", fontWeight: "700" },

  emptyText: { textAlign: "center" },
});
