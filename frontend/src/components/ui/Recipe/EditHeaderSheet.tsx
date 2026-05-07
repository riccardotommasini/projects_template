// src/components/ui/Recipe/EditHeaderSheet.tsx
import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import { X, Check } from "lucide-react-native";
import { Colors } from "../../../constants/colors";
import { FontSize, FontWeight } from "../../../constants/typography";

type EditHeaderSheetProps = {
  visible: boolean;
  title: string;
  description: string | null;
  prepTime: number;
  cookTime: number;
  onClose: () => void;
  onSave: (data: { title: string; description: string; prepTime: number; cookTime: number }) => void;
};

export default function EditHeaderSheet({
  visible,
  title,
  description,
  prepTime,
  cookTime,
  onClose,
  onSave,
}: EditHeaderSheetProps) {
  const [localTitle, setLocalTitle] = useState(title);
  const [localDescription, setLocalDescription] = useState(description ?? "");
  const [localPrep, setLocalPrep] = useState(String(prepTime));
  const [localCook, setLocalCook] = useState(String(cookTime));

  useEffect(() => {
    if (visible) {
      setLocalTitle(title);
      setLocalDescription(description ?? "");
      setLocalPrep(String(prepTime));
      setLocalCook(String(cookTime));
    }
  }, [visible]);

  const canSave = localTitle.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title: localTitle.trim(),
      description: localDescription.trim(),
      prepTime: parseInt(localPrep) || 0,
      cookTime: parseInt(localCook) || 0,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header avec X et ✓ */}
          <View style={styles.sheetHeader}>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.sheetTitle}>Modifier la recette</Text>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              hitSlop={8}
              style={[styles.checkButton, !canSave && styles.checkButtonDisabled]}
            >
              <Check size={22} color={canSave ? Colors.primaryLight : Colors.border} strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Titre */}
          <Text style={styles.label}>Titre</Text>
          <TextInput
            style={styles.input}
            value={localTitle}
            onChangeText={setLocalTitle}
            placeholder="Nom de la recette"
            placeholderTextColor={Colors.textSecondary}
            maxLength={60}
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={localDescription}
            onChangeText={setLocalDescription}
            placeholder="Description de la recette"
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
          {localDescription.length > 0 && (
            <Text style={styles.charCount}>{localDescription.length}/300</Text>
          )}

          {/* Temps */}
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.label}>Préparation (min)</Text>
              <TextInput
                style={styles.input}
                value={localPrep}
                onChangeText={setLocalPrep}
                onBlur={() => setLocalPrep(String(Math.min(600, Math.max(0, parseInt(localPrep) || 0))))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                maxLength={3}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>Cuisson (min)</Text>
              <TextInput
                style={styles.input}
                value={localCook}
                onChangeText={setLocalCook}
                onBlur={() => setLocalCook(String(Math.min(600, Math.max(0, parseInt(localCook) || 0))))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                maxLength={3}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  sheetWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },

  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },

  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 20,
  },

  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },

  checkButton: {
    padding: 4,
  },

  checkButtonDisabled: {
    opacity: 0.4,
  },

  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: 6,
  },

  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: 16,
  },

  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  timeRow: {
    flexDirection: "row",
    gap: 12,
  },

  timeField: { flex: 1 },

  charCount: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 2,
    marginBottom: 12,
  },
});
