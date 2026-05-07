// src/components/ui/Recipe/PreparationList.tsx
import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { Trash2, Check } from "lucide-react-native";
import { Colors } from "../../../constants/colors";
import { FontSize, FontWeight } from "../../../constants/typography";
import OutlineButton from "@/src/components/ui/OutlineButton";

type PreparationListProps = {
  steps: string[];
  onSave?: (steps: string[]) => void;
};

export default function PreparationList({ steps, onSave }: PreparationListProps) {
  const isEditable = !!onSave;
  const [localSteps, setLocalSteps] = useState<string[]>(steps);
  const [pendingStep, setPendingStep] = useState<string | null>(null); // étape en cours de saisie

  useEffect(() => {
    setLocalSteps(steps);
  }, [steps]);

  useEffect(() => {
    if (!isEditable) setPendingStep(null);
  }, [isEditable]);

  const handleEdit = (index: number, text: string) => {
    const updated = localSteps.map((s, i) => (i === index ? text : s));
    setLocalSteps(updated);
    onSave?.(updated.filter((s) => s.trim().length > 0));
  };

  const handleDelete = (index: number) => {
    const updated = localSteps.filter((_, i) => i !== index);
    setLocalSteps(updated);
    onSave?.(updated.filter((s) => s.trim().length > 0));
  };

  // Confirme l'ajout de la nouvelle étape
  const handleConfirmAdd = () => {
    if (!pendingStep || pendingStep.trim().length === 0) {
      setPendingStep(null);
      return;
    }
    const updated = [...localSteps, pendingStep.trim()];
    setLocalSteps(updated);
    onSave?.(updated);
    setPendingStep(null);
  };

  return (
    <View>
      <View style={styles.list}>
        {/* Étapes existantes */}
        {localSteps.map((step, index) => (
          <View key={index} style={styles.row}>
            <View style={[styles.stepNumber, isEditable && styles.stepNumberEditing]}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>

            {isEditable ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.stepInput}
                  value={step}
                  onChangeText={(text) => handleEdit(index, text)}
                  onBlur={() => { if (!step.trim()) handleDelete(index) }}
                  multiline
                  placeholder="Décrivez cette étape..."
                  placeholderTextColor={Colors.textSecondary}
                />
                <Pressable onPress={() => handleDelete(index)} hitSlop={8} style={styles.actionButton}>
                  <Trash2 size={16} color={Colors.error} />
                </Pressable>
              </View>
            ) : (
              <Text style={styles.stepText}>{step}</Text>
            )}
          </View>
        ))}

        {/* Nouvelle étape en cours de saisie */}
        {pendingStep !== null && (
          <View style={styles.row}>
            <View style={[styles.stepNumber, styles.stepNumberEditing]}>
              <Text style={styles.stepNumberText}>{localSteps.length + 1}</Text>
            </View>
            <View style={styles.editRow}>
              <TextInput
                style={styles.stepInput}
                value={pendingStep}
                onChangeText={setPendingStep}
                onBlur={handleConfirmAdd}
                multiline
                placeholder="Décrivez cette étape..."
                placeholderTextColor={Colors.textSecondary}
                autoFocus
              />
              <Pressable
                onPress={handleConfirmAdd}
                hitSlop={8}
                style={styles.actionButton}
              >
                <Check
                  size={18}
                  color={pendingStep.trim().length > 0 ? Colors.primaryLight : Colors.border}
                  strokeWidth={2.5}
                />
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Bouton ajouter — masqué si une saisie est déjà en cours */}
      {isEditable && pendingStep === null && (
        <OutlineButton
          title="Ajouter une étape"
          onPress={() => setPendingStep("")}
          color={Colors.primaryLight}
          backgroundColor={Colors.cardLight}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 16,
    marginBottom: 16,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },

  stepNumberEditing: {
    backgroundColor: Colors.primaryMuted,
  },

  stepNumberText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.surface,
  },

  stepText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },

  editRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  stepInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },

  actionButton: {
    padding: 4,
    marginTop: 10,
  },
});
