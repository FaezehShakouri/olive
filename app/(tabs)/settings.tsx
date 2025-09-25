import { ThemedSafeAreaView } from "@/components/safe-area-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { bulkUpsertMeals, clearAllMeals, ImportResult } from "@/lib/db";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import React, { useState } from "react";
import { Alert, Platform, StyleSheet, TouchableOpacity } from "react-native";

export default function SettingsScreen() {
  const [status, setStatus] = useState<string>("");

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
        encoding: 'utf8',
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
      <ThemedView style={styles.card} darkColor="#333333">
        <ThemedText style={styles.title}>Data Import</ThemedText>
        <ThemedText style={styles.desc}>
          Pick a JSON file with one of these formats:
        </ThemedText>
        <ThemedText style={styles.code}>
          {`[
  { "id": "123", "date": "2025-01-05", "name": "Chicken salad", "calories": 450 },
  { "date": "2025-01-05", "name": "Apple", "calories": 95 }
]`}
        </ThemedText>
        <ThemedText style={[styles.code, { marginTop: 8 }]}>
          {`{
  "2025-01-05": [
    { "name": "Chicken salad", "calories": 450 },
    { "name": "Apple", "calories": 95 }
  ],
  "2025-01-06": [
    { "name": "Oatmeal", "calories": 320 }
  ]
}`}
        </ThemedText>

        <TouchableOpacity style={styles.btn} onPress={onImport}>
          <ThemedText style={styles.btnText}>Import JSON</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.danger]}
          onPress={onClearAll}
        >
          <ThemedText style={styles.btnText}>Delete All Data</ThemedText>
        </TouchableOpacity>

        {!!status && <ThemedText style={styles.status}>{status}</ThemedText>}
      </ThemedView>
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
  title: { fontSize: 18, fontWeight: "800" },
  desc: { fontSize: 14 },
  code: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 12,
    borderRadius: 8,
    padding: 10,
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
