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
  ScrollView,
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

type Meal = {
  id: string;
  name: string;
  calories: number;
  time: string;
  ingredients?: string;
};
type MealsByDate = Record<string, Meal[]>;

// Helper function to format time from 24-hour to 12-hour AM/PM format
const formatTime = (time24: string): string => {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

export default function CaloriesScreen() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [mealsByDate, setMealsByDate] = useState<MealsByDate>({});
  const [mealName, setMealName] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealIngredients, setMealIngredients] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState<
    { name: string; calories: number }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [totalsByDate, setTotalsByDate] = useState<Record<string, number>>({});
  const [calorieGoal, setCalorieGoal] = useState<number>(2000);
  const [showCalorieInfo, setShowCalorieInfo] = useState<boolean>(false);
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCalories, setEditCalories] = useState("");

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const dateKey = formatDateKey(currentDate);
  const todaysMeals = useMemo(() => {
    const meals = mealsByDate[dateKey] || [];
    // Sort by time (most recent first), then by creation order
    return [...meals].sort((a, b) => {
      // First sort by time (descending - latest time first)
      const timeA = a.time || "00:00";
      const timeB = b.time || "00:00";
      if (timeA !== timeB) {
        return timeB.localeCompare(timeA);
      }
      // If times are equal, sort by ID (descending - most recent first)
      return b.id.localeCompare(a.id);
    });
  }, [mealsByDate, dateKey]);

  const totalCalories = useMemo(
    () =>
      todaysMeals.reduce((sum, m) => {
        const c = Number(m.calories);
        return sum + (Number.isFinite(c) ? c : 0);
      }, 0),
    [todaysMeals]
  );

  const [displayTotal, setDisplayTotal] = useState(0);
  const [displayRemaining, setDisplayRemaining] = useState(0);
  const totalAnim = React.useRef(new Animated.Value(0)).current;
  const remainingAnim = React.useRef(new Animated.Value(0)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  // Swipe indicator animation
  const swipeIndicatorAnim = React.useRef(new Animated.Value(0)).current;
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null
  );
  const swipeProgressAnim = React.useRef(new Animated.Value(0)).current;

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
    const remainingTarget = Math.max(0, calorieGoal - target);

    totalAnim.stopAnimation();
    totalAnim.setValue(0);
    remainingAnim.stopAnimation();
    remainingAnim.setValue(0);

    const totalId = totalAnim.addListener(({ value }) => {
      setDisplayTotal(Math.round(value));
    });

    const remainingId = remainingAnim.addListener(({ value }) => {
      setDisplayRemaining(Math.round(value));
    });

    Animated.timing(totalAnim, {
      toValue: target,
      duration: Math.min(1200, Math.max(350, target * 2)), // quick but smooth
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      totalAnim.removeListener(totalId);
      setDisplayTotal(target);
    });

    Animated.timing(remainingAnim, {
      toValue: remainingTarget,
      duration: Math.min(1200, Math.max(350, remainingTarget * 2)), // quick but smooth
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      remainingAnim.removeListener(remainingId);
      setDisplayRemaining(remainingTarget);
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

    return () => {
      totalAnim.removeListener(totalId);
      remainingAnim.removeListener(remainingId);
    };
  }, [dateKey, todaysMeals, totalAnim, remainingAnim, calorieGoal]);

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
    const ingredients = mealIngredients.trim();
    if (!name) {
      Alert.alert("Missing name", "Please enter a meal name.");
      return;
    }
    if (!Number.isFinite(calories) || calories <= 0) {
      Alert.alert("Invalid calories", "Enter a positive number.");
      return;
    }
    const id = String(Date.now()) + Math.random().toString(16).slice(2);
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    await addMeal({ id, date: dateKey, name, calories, time, ingredients });
    const refreshed = await getMealsByDate(dateKey);
    setLocal({ [dateKey]: refreshed });
    setMealName("");
    setMealCalories("");
    setMealIngredients("");
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

    if (state === State.BEGAN) {
      // Show swipe indicator when gesture starts
      setIsSwiping(true);
      setSwipeDirection(null);
      swipeProgressAnim.setValue(0);
      Animated.timing(swipeIndicatorAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (state === State.END) {
      // Hide swipe indicator when gesture ends
      setIsSwiping(false);
      setSwipeDirection(null);

      Animated.timing(swipeIndicatorAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      Animated.timing(swipeProgressAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

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
          <ThemedView style={{ flex: 1, gap: 6 }} darkColor="transparent">
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
            darkColor="transparent"
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
            <ThemedView style={styles.mealNameRow}>
              <ThemedText style={styles.mealName}>{item.name}</ThemedText>
              <ThemedText style={styles.mealCalories}>
                {item.calories} kcal
              </ThemedText>
            </ThemedView>
            <ThemedText style={styles.mealTime}>
              {formatTime(item.time || "12:00")}
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
          onGestureEvent={(event) => {
            const { translationX } = event.nativeEvent;
            if (Math.abs(translationX) > 5) {
              const direction = translationX > 0 ? "right" : "left";
              setSwipeDirection(direction);

              // Calculate swipe progress (0 to 1)
              const progress = Math.min(Math.abs(translationX) / 150, 1);
              swipeProgressAnim.setValue(progress);
            }
          }}
          minPointers={1}
          maxPointers={1}
          shouldCancelWhenOutside={false}
          activeOffsetX={[-10, 10]}
          failOffsetY={[-5, 5]}
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
                    <IconSymbol name="calendar" size={18} color="#6B8E23" />
                  </TouchableOpacity>
                </ThemedView>
                <TouchableOpacity onPress={goToday}>
                  <ThemedText style={styles.todayText}>Go to Today</ThemedText>
                </TouchableOpacity>

                {/* Swipe Indicator */}
                <Animated.View
                  style={[
                    styles.swipeIndicator,
                    {
                      opacity: swipeIndicatorAnim,
                      transform: [
                        {
                          scale: swipeIndicatorAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1],
                          }),
                        },
                        {
                          translateX: swipeProgressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange:
                              swipeDirection === "right"
                                ? [0, 30]
                                : swipeDirection === "left"
                                ? [0, -30]
                                : [0, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <ThemedText style={styles.swipeIndicatorText}>
                    {swipeDirection === "right"
                      ? "⬅️ Previous day"
                      : swipeDirection === "left"
                      ? "Next day ➡️"
                      : "Swipe to change day"}
                  </ThemedText>

                  {/* Swipe Progress Bar */}
                  <Animated.View
                    style={[
                      styles.swipeProgressBar,
                      {
                        transform: [
                          {
                            scaleX: swipeProgressAnim,
                          },
                        ],
                      },
                    ]}
                  />
                </Animated.View>
              </ThemedView>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCurrentDate((d) => addDays(d, 1))}
              >
                <ThemedText style={styles.navBtnText}>{"›"}</ThemedText>
              </TouchableOpacity>
            </ThemedView>

            <ThemedView style={styles.calorieCard}>
              <ThemedText style={styles.remainingValue}>
                {displayRemaining} kcal
              </ThemedText>
              <ThemedText style={styles.remainingSubtext}>Left</ThemedText>

              <ThemedView style={styles.statsRow} darkColor="transparent">
                <ThemedView style={styles.statItem} darkColor="transparent">
                  <ThemedText style={styles.statValue}>
                    {displayTotal}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>Consumed</ThemedText>
                </ThemedView>
                <ThemedView style={styles.statDivider} />
                <ThemedView style={styles.statItem} darkColor="transparent">
                  <ThemedText style={styles.statValue}>
                    {calorieGoal}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>Daily Goal</ThemedText>
                </ThemedView>
              </ThemedView>
              <ThemedView
                style={styles.progressContainer}
                darkColor="transparent"
              >
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
                            "#94A3B8", // Cool gray - very low
                            "#A3A3A3", // Warm gray - low
                            "#D4AF37", // Golden - medium
                            "#9CAF88", // Sage green - good
                            "#6B8E23", // Olive green - goal reached
                            "#556B2F", // Dark olive - exceeded
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

            <ThemedView style={{ flex: 1 }}>
              <FlatList
                data={todaysMeals}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={
                  todaysMeals.length === 0
                    ? { flex: 1, justifyContent: "center" }
                    : { paddingBottom: 20 }
                }
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={true}
                bounces={true}
                scrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              />
            </ThemedView>
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

            {/* Floating Action Button */}
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.fabIcon}>+</ThemedText>
            </TouchableOpacity>

            {/* Add Meal Modal */}
            <Modal
              visible={showAddModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => {
                setShowAddModal(false);
                setMealName("");
                setMealCalories("");
                setMealIngredients("");
                setShowSuggestions(false);
                setShowCalorieInfo(false);
              }}
            >
              <KeyboardAvoidingView
                style={styles.modalOverlay}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
              >
                <TouchableWithoutFeedback
                  onPress={() => {
                    setShowAddModal(false);
                    setMealName("");
                    setMealCalories("");
                    setMealIngredients("");
                    setShowSuggestions(false);
                    setShowCalorieInfo(false);
                  }}
                >
                  <ThemedView style={styles.modalOverlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                      <ThemedView style={styles.addModalCard}>
                        <ThemedText style={styles.addModalTitle}>
                          Add Meal
                        </ThemedText>

                        <TextInput
                          placeholder="Meal name (e.g., Chicken salad)"
                          value={mealName}
                          onChangeText={(t) => {
                            setMealName(t);
                            setShowSuggestions(true);
                          }}
                          style={styles.modalInputWithMargin}
                          returnKeyType="next"
                          placeholderTextColor="#6B7280"
                          autoFocus={true}
                        />

                        {showSuggestions && nameSuggestions.length > 0 && (
                          <ThemedView style={styles.modalSuggestions}>
                            <ScrollView
                              style={styles.suggestionsScrollView}
                              showsVerticalScrollIndicator={true}
                              bounces={false}
                              keyboardShouldPersistTaps="handled"
                            >
                              {nameSuggestions.map((s, index) => (
                                <TouchableOpacity
                                  key={`${s.name}-${s.calories}-${index}`}
                                  style={styles.modalSuggestionItem}
                                  onPress={() => {
                                    setMealName(s.name);
                                    setMealCalories(s.calories.toString());
                                    setShowSuggestions(false);
                                  }}
                                >
                                  <ThemedView
                                    style={styles.suggestionRow}
                                    darkColor="transparent"
                                  >
                                    <ThemedText style={styles.suggestionText}>
                                      {s.name}
                                    </ThemedText>
                                    <ThemedText
                                      style={styles.suggestionCalories}
                                    >
                                      {s.calories} kcal
                                    </ThemedText>
                                  </ThemedView>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </ThemedView>
                        )}

                        <ThemedView style={styles.calorieInputContainer}>
                          <TextInput
                            placeholder="Calories (e.g., 450)"
                            value={mealCalories}
                            onChangeText={setMealCalories}
                            keyboardType="numeric"
                            style={styles.modalInput}
                            returnKeyType="done"
                            placeholderTextColor="#6B7280"
                          />
                          <TouchableOpacity
                            style={styles.calorieInfoBtn}
                            onPress={() => setShowCalorieInfo(!showCalorieInfo)}
                          >
                            <ThemedText style={styles.calorieInfoIcon}>
                              ?
                            </ThemedText>
                          </TouchableOpacity>
                        </ThemedView>

                        {showCalorieInfo && (
                          <ThemedView style={styles.calorieInfoTooltip}>
                            <ThemedText style={styles.calorieInfoText}>
                              💡 Need help counting calories? Ask an AI like
                              ChatGPT or Google Bard: "How many calories are in
                              [your meal]?" They can provide accurate estimates
                              for most foods!
                            </ThemedText>
                          </ThemedView>
                        )}

                        <TextInput
                          placeholder="Ingredients (optional)"
                          value={mealIngredients}
                          onChangeText={setMealIngredients}
                          style={styles.modalInputWithMargin}
                          returnKeyType="done"
                          placeholderTextColor="#6B7280"
                          multiline={true}
                          numberOfLines={2}
                        />

                        <ThemedView style={styles.modalButtons}>
                          <TouchableOpacity
                            style={styles.modalCancelBtn}
                            onPress={() => {
                              setShowAddModal(false);
                              setMealName("");
                              setMealCalories("");
                              setMealIngredients("");
                              setShowSuggestions(false);
                              setShowCalorieInfo(false);
                            }}
                          >
                            <ThemedText style={styles.modalCancelText}>
                              Cancel
                            </ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.modalAddBtn,
                              !canAdd && { opacity: 0.5 },
                            ]}
                            onPress={async () => {
                              await onAddMeal();
                              setShowAddModal(false);
                              setMealName("");
                              setMealCalories("");
                              setShowSuggestions(false);
                            }}
                            disabled={!canAdd}
                          >
                            <ThemedText style={styles.modalAddText}>
                              Add Meal
                            </ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      </ThemedView>
                    </TouchableWithoutFeedback>
                  </ThemedView>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
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
  todayText: {
    marginTop: 4,
    fontWeight: "400",
    fontSize: 12,
    opacity: 0.7,
    color: "#6B8E23",
  },
  swipeIndicator: {
    position: "absolute",
    top: -8,
    left: "50%",
    marginLeft: -60,
    width: 120,
    height: 24,
    backgroundColor: "rgba(107, 142, 35, 0.9)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  swipeIndicatorText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
  },
  swipeProgressBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 120,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 1.5,
    transformOrigin: "left center",
  },

  calorieCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(156, 175, 136, 0.08)",
    alignItems: "center",
  },
  remainingLabel: {
    fontSize: 16,
    fontWeight: "400",
    opacity: 0.8,
    textAlign: "center",
    marginBottom: 2,
  },
  remainingValue: {
    fontSize: 42,
    fontWeight: "200",
    letterSpacing: -2,
    textAlign: "center",
    color: "#6B8E23",
    lineHeight: 48,
  },
  remainingSubtext: {
    fontSize: 16,
    fontWeight: "400",
    opacity: 0.8,
    textAlign: "center",
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "500",
    opacity: 0.9,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "400",
    opacity: 0.7,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(107, 142, 35, 0.15)",
    marginHorizontal: 20,
  },
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
    backgroundColor: "rgba(156, 175, 136, 0.12)",
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
    backgroundColor: "#6B8E23",
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
    color: "#9CAF88",
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
    backgroundColor: "#6B8E23",
    borderColor: "#9CAF88",
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
    backgroundColor: "rgba(156, 175, 136, 0.12)",
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },

  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "rgba(107, 114, 128, 0.05)",
  },
  mealNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 2,
    backgroundColor: "transparent",
  },
  mealName: {
    fontSize: 16,
    fontWeight: "400",
    flex: 1,
    marginRight: 8,
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
    fontSize: 13,
    color: "#D1D5DB",
    fontWeight: "400",
    marginTop: 4,
    fontStyle: "italic",
    lineHeight: 16,
    opacity: 0.8,
  },
  mealCalories: { fontSize: 13, opacity: 0.7 },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: { color: "#EF4444", fontWeight: "700" },

  emptyText: { textAlign: "center" },

  // Floating Action Button
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(107, 142, 35, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "rgba(107, 142, 35, 0.4)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: "200",
    color: "#FFFFFF",
    lineHeight: 28,
    textAlign: "center",
  },

  // Add Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  addModalCard: {
    backgroundColor: "rgba(31, 41, 55, 0.95)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 24,
    minHeight: "50%",
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: "rgba(107, 142, 35, 0.3)",
    borderBottomWidth: 0,
  },
  addModalTitle: {
    fontSize: 22,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    color: "#F9FAFB",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "rgba(107, 142, 35, 0.3)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 0,
    backgroundColor: "rgba(156, 175, 136, 0.12)",
    fontWeight: "400",
    color: "#F9FAFB",
    flex: 1,
  },
  modalInputWithMargin: {
    borderWidth: 1,
    borderColor: "rgba(107, 142, 35, 0.3)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "rgba(156, 175, 136, 0.12)",
    fontWeight: "400",
    color: "#F9FAFB",
  },
  calorieInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "transparent",
  },
  calorieInfoBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(107, 142, 35, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "rgba(107, 142, 35, 0.3)",
  },
  calorieInfoIcon: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6B8E23",
  },
  calorieInfoTooltip: {
    backgroundColor: "rgba(107, 142, 35, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(107, 142, 35, 0.2)",
  },
  calorieInfoText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#D1D5DB",
    textAlign: "left",
  },
  modalSuggestions: {
    borderRadius: 12,
    marginBottom: 16,
    maxHeight: 160,
    backgroundColor: "rgba(156, 175, 136, 0.08)",
    overflow: "hidden",
  },
  suggestionsScrollView: {
    maxHeight: 160,
  },
  modalSuggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  suggestionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: "400",
    flex: 1,
  },
  suggestionCalories: {
    fontSize: 12,
    fontWeight: "300",
    opacity: 0.7,
    color: "#6B8E23",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    backgroundColor: "transparent",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "rgba(156, 175, 136, 0.15)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(107, 142, 35, 0.2)",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "500",
    opacity: 0.8,
  },
  modalAddBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#6B8E23",
    alignItems: "center",
  },
  modalAddText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
});
