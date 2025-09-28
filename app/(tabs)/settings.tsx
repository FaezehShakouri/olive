import { ThemedSafeAreaView } from "@/components/safe-area-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { bulkUpsertMeals, ImportResult } from "@/lib/db";
import { getCalorieGoal, setCalorieGoal } from "@/lib/theme";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";

export default function SettingsScreen() {
  const [status, setStatus] = useState<string>("");
  const [calorieGoal, setCalorieGoalState] = useState<string>("2000");

  React.useEffect(() => {
    (async () => {
      const goal = await getCalorieGoal();
      setCalorieGoalState(String(goal));
    })();
  }, []);

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

  return (
    <ThemedSafeAreaView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Goals Section */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionHeader}>
            <IconSymbol name="target" size={20} color="#6B8E23" />
            <ThemedText style={styles.sectionTitle}>Daily Goals</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedView style={styles.inputRow}>
              <ThemedView style={styles.inputLabel}>
                <ThemedText style={styles.inputLabelText}>
                  Calorie Goal
                </ThemedText>
                <ThemedText style={styles.inputLabelSubtext}>
                  Set your daily calorie target
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.inputContainer}>
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
                <ThemedText style={styles.inputUnit}>kcal</ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        </ThemedView>

        {/* Data Section */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionHeader}>
            <IconSymbol name="folder" size={20} color="#6B8E23" />
            <ThemedText style={styles.sectionTitle}>Data Management</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <TouchableOpacity style={styles.importBtn} onPress={onImport}>
              <ThemedView style={styles.btnContent}>
                <IconSymbol
                  name="arrow.down.circle"
                  size={24}
                  color="#FFFFFF"
                />
                <ThemedView style={styles.btnTextContainer}>
                  <ThemedText style={styles.btnText}>
                    Import from JSON
                  </ThemedText>
                  <ThemedText style={styles.btnSubtext}>
                    Import your meal data from a JSON file
                  </ThemedText>
                </ThemedView>
                <IconSymbol name="chevron.right" size={16} color="#FFFFFF" />
              </ThemedView>
            </TouchableOpacity>

            {!!status && (
              <ThemedView style={styles.statusContainer}>
                <IconSymbol name="checkmark.circle" size={16} color="#6B8E23" />
                <ThemedText style={styles.status}>{status}</ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </ThemedSafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "500",
    color: "#F8FAFC",
  },
  card: {
    marginHorizontal: 20,
    marginVertical: 6,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(156, 175, 136, 0.08)",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
  },
  inputLabel: {
    flex: 1,
    marginRight: 16,
    backgroundColor: "transparent",
  },
  inputLabelText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  inputLabelSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(107, 142, 35, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(107, 142, 35, 0.2)",
  },
  goalInput: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F8FAFC",
    minWidth: 80,
    textAlign: "right",
    borderWidth: 0,
  },
  inputUnit: {
    fontSize: 14,
    color: "#9CA3AF",
    marginLeft: 8,
    fontWeight: "500",
  },
  importBtn: {
    backgroundColor: "#6B8E23",
    borderRadius: 16,
    overflow: "hidden",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  btnTextContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  btnSubtext: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    padding: 12,
    backgroundColor: "rgba(107, 142, 35, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(107, 142, 35, 0.2)",
    gap: 8,
  },
  status: {
    fontSize: 14,
    color: "#6B8E23",
    fontWeight: "500",
    flex: 1,
  },
});
