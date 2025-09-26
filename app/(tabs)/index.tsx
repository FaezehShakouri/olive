import { ConfirmDialog } from "@/components/confirm-dialog";
import { ThemedSafeAreaView } from "@/components/safe-area-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  addMeal,
  deleteMeal,
  getMealsByDate,
  getNameSuggestions,
  updateMeal,
} from "@/lib/db";
import { getCalorieGoal, subscribeCalorieGoal } from "@/lib/theme";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
} from "react-native-gesture-handler";

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
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [totalsByDate, setTotalsByDate] = useState<Record<string, number>>({});
  const [calorieGoal, setCalorieGoal] = useState<number>(2000);
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCalories, setEditCalories] = useState("");

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
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

  const [displayTotal, setDisplayTotal] = useState(0);
  const totalAnim = React.useRef(new Animated.Value(0)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const dateKey = formatDateKey(currentDate);
      const meals = await getMealsByDate(dateKey);
      setMealsByDate({ [dateKey]: meals });
      // Preload totals for calendar
      try {
        const { getTotalsByDate } = await import("@/lib/db");
        const totals = await getTotalsByDate();
        setTotalsByDate(totals);
      } catch {}
      // Load calorie goal
      const goal = await getCalorieGoal();
      setCalorieGoal(goal);
    })();

    // Subscribe to calorie goal changes
    const unsubGoal = subscribeCalorieGoal(setCalorieGoal);
    return unsubGoal;
  }, []);

  useEffect(() => {
    (async () => {
      const dateKey = formatDateKey(currentDate);
      const meals = await getMealsByDate(dateKey);
      setMealsByDate({ [dateKey]: meals });
    })();
  }, [currentDate]);

  useEffect(() => {
    const target = todaysMeals.reduce(
      (s, m) => s + (Number.isFinite(+m.calories) ? +m.calories : 0),
      0
    );

    totalAnim.stopAnimation();
    totalAnim.setValue(0);

    const id = totalAnim.addListener(({ value }) => {
      setDisplayTotal(Math.round(value));
    });

    Animated.timing(totalAnim, {
      toValue: target,
      duration: Math.min(1200, Math.max(350, target * 2)), // quick but smooth
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      totalAnim.removeListener(id);
      setDisplayTotal(target);
    });

    // Animate progress bar smoothly
    const progressTarget = Math.min(1.2, target / calorieGoal); // Allow slight overshoot for better visual
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, {
      toValue: progressTarget,
      duration: Math.min(1500, Math.max(600, target * 2.5)), // Slightly longer for smoother feel
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Custom smooth bezier curve
      useNativeDriver: false,
    }).start();

    return () => totalAnim.removeListener(id);
  }, [dateKey, todaysMeals, totalAnim, calorieGoal]);

  const setLocal = (next: MealsByDate) => {
    setMealsByDate(next);
  };

  // Fetch name suggestions as the user types
  useEffect(() => {
    let cancelled = false;
    const q = mealName.trim();
    if (q.length === 0) {
      setNameSuggestions([]);
      return;
    }
    (async () => {
      try {
        const list = await getNameSuggestions(q, 8);
        if (!cancelled) setNameSuggestions(list);
      } catch {
        if (!cancelled) setNameSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mealName]);

  const onAddMeal = async () => {
    Keyboard.dismiss();
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
    const id = String(Date.now()) + Math.random().toString(16).slice(2);
    await addMeal({ id, date: dateKey, name, calories });
    const refreshed = await getMealsByDate(dateKey);
    setLocal({ [dateKey]: refreshed });
    setMealName("");
    setMealCalories("");
  };

  const onDeleteMeal = async (id: string) => {
    await deleteMeal(id);
    const refreshed = await getMealsByDate(dateKey);
    setLocal({ [dateKey]: refreshed });
  };

  const confirmDeleteMeal = (id: string) => {
    setPendingDeleteId(id);
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
      Alert.alert("Invalid input", "Enter a valid name and positive calories.");
      return;
    }
    await updateMeal(editingId, n, c);
    const refreshed = await getMealsByDate(dateKey);
    setLocal({ [dateKey]: refreshed });
    setEditingId(null);
  };

  const goToday = () => setCurrentDate(new Date());

  // Swipe gesture handler
  const onGestureStateChange = (event: any) => {
    const { state, translationX, velocityX } = event.nativeEvent;

    if (state === State.END) {
      const threshold = 75; // Minimum swipe distance
      const velocityThreshold = 500; // Minimum swipe velocity

      // Check if swipe is significant enough (distance or velocity)
      const isSignificantSwipe =
        Math.abs(translationX) > threshold ||
        Math.abs(velocityX) > velocityThreshold;

      if (isSignificantSwipe) {
        if (translationX > 0 || velocityX > 0) {
          // Swipe right - go to previous day
          setCurrentDate((d) => addDays(d, -1));
        } else {
          // Swipe left - go to next day
          setCurrentDate((d) => addDays(d, 1));
        }
      }
    }
  };

  // Calendar helpers
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const addMonths = (d: Date, m: number) =>
    new Date(d.getFullYear(), d.getMonth() + m, 1);
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const monthDays = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const padStart = start.getDay();
    const days: Array<{ date: Date | null; key: string }>[] = [];
    const row: Array<{ date: Date | null; key: string }>[] = [];
    const cells: { date: Date | null; key: string }[] = [];
    // Leading blanks
    for (let i = 0; i < padStart; i++) cells.push({ date: null, key: `b${i}` });
    for (let day = 1; day <= end.getDate(); day++) {
      const d = new Date(start.getFullYear(), start.getMonth(), day);
      cells.push({ date: d, key: formatDateKey(d) });
    }
    // Trailing blanks to fill the last week
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const padEnd = 7 - remainder;
      for (let i = 0; i < padEnd; i++) cells.push({ date: null, key: `e${i}` });
    }
    // Chunk into weeks of 7
    const rows: Array<Array<{ date: Date | null; key: string }>> = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [calendarMonth]);

  const renderItem = ({ item }: { item: Meal }) => (
    <ThemedView style={styles.mealRow} darkColor="#333333">
      {editingId === item.id ? (
        <>
          <ThemedView style={{ flex: 1, gap: 6 }} darkColor="#333333">
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
          </ThemedView>
          <ThemedView
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
            }}
            darkColor="#333333"
          >
            <TouchableOpacity
              style={styles.iconBtnConfirm}
              onPress={saveEdit}
              accessibilityLabel="Save"
            >
              <IconSymbol name="checkmark" size={18} color="#2563EB" />
            </TouchableOpacity>
          </ThemedView>
        </>
      ) : (
        <>
          <ThemedView style={{ flex: 1 }} darkColor="transparent">
            <ThemedText style={styles.mealName}>{item.name}</ThemedText>
            <ThemedText style={styles.mealCalories}>
              {item.calories} kcal
            </ThemedText>
          </ThemedView>
          <ThemedView
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
            }}
            darkColor="transparent"
          >
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
          </ThemedView>
        </>
      )}
    </ThemedView>
  );

  const canAdd = mealName.trim().length > 0 && Number(mealCalories) > 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedSafeAreaView style={{ flex: 1 }}>
        <PanGestureHandler
          onHandlerStateChange={onGestureStateChange}
          minPointers={1}
          maxPointers={1}
          shouldCancelWhenOutside={false}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ThemedView style={styles.header}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCurrentDate((d) => addDays(d, -1))}
              >
                <ThemedText style={styles.navBtnText}>{"‹"}</ThemedText>
              </TouchableOpacity>
              <ThemedView style={styles.dateBox}>
                <ThemedView style={styles.dateRow}>
                  <ThemedText style={styles.dateText}>{dateKey}</ThemedText>
                  <TouchableOpacity
                    onPress={async () => {
                      setCalendarMonth(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth(),
                          1
                        )
                      );
                      try {
                        const { getTotalsByDate } = await import("@/lib/db");
                        const totals = await getTotalsByDate();
                        setTotalsByDate(totals);
                      } catch {}
                      setShowCalendar(true);
                    }}
                    style={styles.calendarBtn}
                  >
                    <IconSymbol name="calendar" size={18} color="#8B5CF6" />
                  </TouchableOpacity>
                </ThemedView>
                <TouchableOpacity onPress={goToday}>
                  <ThemedText style={styles.todayText}>Today</ThemedText>
                </TouchableOpacity>
              </ThemedView>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCurrentDate((d) => addDays(d, 1))}
              >
                <ThemedText style={styles.navBtnText}>{"›"}</ThemedText>
              </TouchableOpacity>
            </ThemedView>

            <ThemedView style={styles.totalBox}>
              <ThemedView style={styles.totalRow}>
                <ThemedText style={styles.totalLabel}>Total</ThemedText>
                <ThemedText style={styles.totalValue}>
                  {displayTotal} / {calorieGoal} kcal
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.progressContainer}>
                <ThemedView style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressBar,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                          extrapolate: "clamp",
                        }),
                        backgroundColor: progressAnim.interpolate({
                          inputRange: [0, 0.3, 0.6, 0.85, 1, 1.2],
                          outputRange: [
                            "#64748B", // Slate - very low
                            "#94A3B8", // Light slate - low
                            "#CBD5E1", // Lighter slate - medium
                            "#A78BFA", // Soft purple - good
                            "#8B5CF6", // Purple - goal reached
                            "#7C3AED", // Deep purple - exceeded
                          ],
                          extrapolate: "clamp",
                        }),
                      },
                    ]}
                  />
                </ThemedView>
                <ThemedText style={styles.progressText}>
                  {Math.round((displayTotal / calorieGoal) * 100)}%
                </ThemedText>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.inputCard}>
              <TextInput
                placeholder="Meal name (e.g., Chicken salad)"
                value={mealName}
                onChangeText={(t) => {
                  setMealName(t);
                  setShowSuggestions(true);
                }}
                style={styles.input}
                returnKeyType="next"
                placeholderTextColor="#6B7280"
              />
              {showSuggestions && nameSuggestions.length > 0 && (
                <ThemedView style={styles.suggestionsBox}>
                  {nameSuggestions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setMealName(s);
                        setShowSuggestions(false);
                      }}
                    >
                      <ThemedText style={styles.suggestionText}>{s}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ThemedView>
              )}
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
                todaysMeals.length === 0 && {
                  flex: 1,
                  justifyContent: "center",
                }
              }
              ListEmptyComponent={
                <ThemedText style={styles.emptyText}>
                  No meals yet. Add your first meal for {dateKey}.
                </ThemedText>
              }
              style={{ flex: 1 }}
            />
            <ConfirmDialog
              visible={pendingDeleteId !== null}
              title="Delete meal"
              message="Are you sure you want to delete this meal?"
              confirmText="Delete"
              cancelText="Cancel"
              onCancel={() => setPendingDeleteId(null)}
              onConfirm={async () => {
                if (!pendingDeleteId) return;
                await onDeleteMeal(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            />
            {/* Calendar Modal */}
            <Modal
              visible={showCalendar}
              transparent
              animationType="fade"
              onRequestClose={() => setShowCalendar(false)}
            >
              <TouchableWithoutFeedback onPress={() => setShowCalendar(false)}>
                <ThemedView style={styles.modalBackdrop}>
                  <TouchableWithoutFeedback>
                    <ThemedView style={styles.calendarCard} darkColor="#111827">
                      <ThemedView
                        style={styles.calendarHeader}
                        darkColor="#111827"
                      >
                        <TouchableOpacity
                          onPress={() =>
                            setCalendarMonth((d) => addMonths(d, -1))
                          }
                          style={styles.navBtnSm}
                        >
                          <ThemedText
                            style={styles.navBtnText}
                            darkColor="#333333"
                          >
                            {"‹"}
                          </ThemedText>
                        </TouchableOpacity>
                        <ThemedText style={styles.monthTitle}>
                          {calendarMonth.getFullYear()}-
                          {String(calendarMonth.getMonth() + 1).padStart(
                            2,
                            "0"
                          )}
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() =>
                            setCalendarMonth((d) => addMonths(d, 1))
                          }
                          style={styles.navBtnSm}
                        >
                          <ThemedText
                            style={styles.navBtnText}
                            darkColor="#333333"
                          >
                            {"›"}
                          </ThemedText>
                        </TouchableOpacity>
                      </ThemedView>
                      <ThemedView style={styles.weekRow} darkColor="#111827">
                        {weekdayLabels.map((w) => (
                          <ThemedText key={w} style={styles.weekday}>
                            {w}
                          </ThemedText>
                        ))}
                      </ThemedView>
                      {monthDays.map((week, i) => (
                        <ThemedView
                          key={i}
                          style={styles.weekRowDays}
                          darkColor="#111827"
                        >
                          {week.map(({ date, key }) => {
                            if (!date)
                              return (
                                <ThemedView
                                  key={key}
                                  style={styles.dayCellEmpty}
                                  darkColor="#111827"
                                />
                              );
                            const k = formatDateKey(date);
                            const total = totalsByDate[k] ?? 0;
                            const isSelected = k === formatDateKey(currentDate);
                            return (
                              <TouchableOpacity
                                key={key}
                                style={[
                                  styles.dayCell,
                                  isSelected && styles.daySelected,
                                ]}
                                onPress={() => {
                                  setCurrentDate(date);
                                  setShowCalendar(false);
                                }}
                              >
                                <ThemedText style={styles.dayNum}>
                                  {date.getDate()}
                                </ThemedText>
                                {total > 0 && (
                                  <ThemedText style={styles.dayTotal}>
                                    {total}
                                  </ThemedText>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </ThemedView>
                      ))}
                    </ThemedView>
                  </TouchableWithoutFeedback>
                </ThemedView>
              </TouchableWithoutFeedback>
            </Modal>
          </KeyboardAvoidingView>
        </PanGestureHandler>
      </ThemedSafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: { fontSize: 20, fontWeight: "300", color: "#6B7280" },
  dateBox: { flex: 1, alignItems: "center" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  calendarBtn: {
    marginLeft: 4,
    padding: 4,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  dateText: { fontSize: 20, fontWeight: "500" },
  todayText: { marginTop: 4, fontWeight: "400", fontSize: 12, opacity: 0.7 },

  totalBox: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  totalLabel: { fontSize: 14, fontWeight: "400", opacity: 0.8 },
  totalValue: { fontSize: 28, fontWeight: "300", letterSpacing: -0.5 },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(107, 114, 128, 0.2)",
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: "400",
    minWidth: 32,
    opacity: 0.7,
  },

  inputCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    gap: 12,
    backgroundColor: "transparent",
  },
  input: {
    backgroundColor: "rgba(107, 114, 128, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 0,
    color: "#F8FAFC",
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnConfirmText: { color: "white", fontWeight: "700" },
  addBtn: {
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
  },
  addBtnText: { fontWeight: "500", fontSize: 16, color: "#FFFFFF" },

  // Calendar styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  calendarCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  monthTitle: { fontSize: 18, fontWeight: "400" },
  navBtnSm: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(107, 114, 128, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  weekRowDays: {
    flexDirection: "row",
    justifyContent: "space-between",
    columnGap: 1,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 4,
  },
  dayCell: {
    width: `${(100 - 6 * 6) / 7}%`,
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(248, 250, 252, 0.1)",
    marginVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  dayCellEmpty: {
    width: `${(100 - 6 * 6) / 7}%`,
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  daySelected: {
    backgroundColor: "#8B5CF6",
    borderColor: "#A78BFA",
  },
  dayNum: {
    fontSize: 13,
    fontWeight: "500",
    color: "#F8FAFC",
    lineHeight: 16,
  },
  dayTotal: {
    fontSize: 8,
    marginTop: 1,
    fontWeight: "400",
    color: "#CBD5E1",
    lineHeight: 10,
  },

  suggestionsBox: {
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "rgba(107, 114, 128, 0.1)",
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  suggestionText: { fontSize: 14, fontWeight: "400" },

  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "rgba(107, 114, 128, 0.05)",
  },
  mealName: { fontSize: 16, fontWeight: "400" },
  mealCalories: { marginTop: 2, fontSize: 13, opacity: 0.7 },
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
