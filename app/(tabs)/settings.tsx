import { ThemedSafeAreaView } from "@/components/safe-area-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { bulkUpsertMeals, clearAllMeals, ImportResult } from "@/lib/db";
import {
  getCalorieGoal,
  getThemeOverride,
  setCalorieGoal,
  setThemeOverride,
} from "@/lib/theme";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
} from "react-native";

export default function SettingsScreen() {
  const [status, setStatus] = useState<string>("");
  const [themeSwitch, setThemeSwitch] = useState<"light" | "dark" | null>(null);
  const [calorieGoal, setCalorieGoalState] = useState<string>("2000");
  const systemScheme = useColorScheme();

  React.useEffect(() => {
    (async () => {
      const v = await getThemeOverride();
      // If no override saved, default to system theme
      if (v === null)
        setThemeSwitch(systemScheme === "dark" ? "dark" : "light");
      else setThemeSwitch(v);

      const goal = await getCalorieGoal();
      setCalorieGoalState(String(goal));
    })();
  }, [systemScheme]);

  const onImport = async () => {
    setStatus("");
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: "utf8",
      });
      let data: unknown;
      try {
        data = JSON.parse(content);
      } catch {
        Alert.alert("Invalid JSON", "The selected file is not valid JSON.");
        return;
      }
      setStatus("Importing...");
      const result: ImportResult = await bulkUpsertMeals(data);
      setStatus(
        `Imported. Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}`
      );
      Alert.alert(
        "Import complete",
        `Added: ${result.added}\nUpdated: ${result.updated}\nSkipped: ${result.skipped}`
      );
    } catch (e: any) {
      console.warn(e);
      Alert.alert("Import failed", e?.message ?? "Unknown error");
      setStatus("Import failed.");
    }
  };

  const onClearAll = async () => {
    Alert.alert("Delete all data", "This will remove all meals. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await clearAllMeals();
          Alert.alert("Cleared", "All meals deleted.");
        },
      },
    ]);
  };

  return (
    <ThemedSafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <ThemedView style={styles.card}>
          <ThemedText style={styles.title}>Appearance</ThemedText>
          <ThemedView style={styles.row}>
            <ThemedText style={{ flex: 1 }}>Dark mode</ThemedText>
            <Switch
              value={themeSwitch === "dark"}
              onValueChange={async (v) => {
                const next = v ? "dark" : "light"; // force explicit mode
                setThemeSwitch(next);
                await setThemeOverride(next);
              }}
              trackColor={{ false: "#8B7355", true: "#6B8E23" }}
              thumbColor={themeSwitch === "dark" ? "#9CAF88" : "#D4AF37"}
            />
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText style={styles.title}>Goals</ThemedText>
          <ThemedView style={styles.row}>
            <ThemedText style={{ flex: 1 }}>Daily calorie goal</ThemedText>
            <TextInput
              value={calorieGoal}
              onChangeText={setCalorieGoalState}
              onBlur={async () => {
                const goal = parseInt(calorieGoal, 10);
                if (goal > 0 && goal <= 10000) {
                  await setCalorieGoal(goal);
                } else {
                  const current = await getCalorieGoal();
                  setCalorieGoalState(String(current));
                }
              }}
              keyboardType="numeric"
              style={styles.goalInput}
              placeholder="2000"
              placeholderTextColor="#6B7280"
            />
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText style={styles.title}>Data</ThemedText>
          <ThemedView style={{ gap: 8 }}>
            <TouchableOpacity style={styles.btn} onPress={onImport}>
              <ThemedText style={styles.btnText}>Import from JSON</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.danger]}
              onPress={onClearAll}
            >
              <ThemedText style={styles.btnText}>Delete All Meals</ThemedText>
            </TouchableOpacity>
            {!!status && (
              <ThemedText style={styles.status}>{status}</ThemedText>
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </ThemedSafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    gap: 16,
    backgroundColor: "transparent",
  },
  section: { marginBottom: 0, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "300", letterSpacing: -0.5 },
  headerSubtitle: { marginTop: 4, fontSize: 13, opacity: 0.7 },
  title: { fontSize: 16, fontWeight: "500", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  goalInput: {
    backgroundColor: "rgba(107, 114, 128, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    borderWidth: 0,
    color: "#F8FAFC",
    minWidth: 80,
    textAlign: "right",
  },
  btn: {
    backgroundColor: "#6B8E23",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
  },
  danger: {
    backgroundColor: "#8B7355",
  },
  btnText: { color: "#FFFFFF", fontWeight: "400", fontSize: 15 },
  status: { marginTop: 8, fontSize: 12, opacity: 0.8 },
});
