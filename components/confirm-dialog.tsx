import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import React from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";

export function ConfirmDialog({
  visible,
  title = "Confirm",
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle" style={{ marginBottom: 8 }}>
            {title}
          </ThemedText>
          <ThemedText style={{ marginBottom: 16 }}>{message}</ThemedText>
          <View style={styles.row}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.btn, styles.btnGhost]}
            >
              <ThemedText style={styles.btnGhostText}>{cancelText}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[styles.btn, styles.btnDanger]}
            >
              <ThemedText style={styles.btnDangerText}>
                {confirmText}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: { width: "100%", borderRadius: 16, padding: 16 },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: { borderWidth: 1, borderColor: "#E5E7EB" },
  btnGhostText: { fontWeight: "700" },
  btnDanger: { backgroundColor: "#EF4444" },
  btnDangerText: { color: "white", fontWeight: "700" },
});
