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
        <ThemedView style={styles.card} darkColor="#333333">
          <ThemedText style={styles.title}>Appearance</ThemedText>
          <ThemedView style={styles.row} darkColor="#333333">
            <ThemedText style={{ flex: 1 }}>Dark mode</ThemedText>
            <Switch
              value={themeSwitch === "dark"}
              onValueChange={async (v) => {
                const next = v ? "dark" : "light"; // force explicit mode
                setThemeSwitch(next);
                await setThemeOverride(next);
              }}
            />
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.card} darkColor="#333333">
          <ThemedText style={styles.title}>Goals</ThemedText>
          <ThemedView style={styles.row} darkColor="#333333">
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

        <ThemedView style={styles.card} darkColor="#333333">
          <ThemedText style={styles.title}>Data</ThemedText>
          <ThemedView style={{ gap: 8 }} darkColor="#333333">
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
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  section: { marginBottom: 0, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  headerSubtitle: { marginTop: 2, fontSize: 12 },
  title: { fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  goalInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    color: "#111827",
    minWidth: 80,
    textAlign: "right",
  },
  btn: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 12,
  },
  danger: {
    backgroundColor: "#EF4444",
  },
  btnText: { color: "#FFFFFF", fontWeight: "700" },
  status: { marginTop: 6, fontSize: 12 },
});
