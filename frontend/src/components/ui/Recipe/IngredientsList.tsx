// src/components/ui/Recipe/IngredientsList.tsx
import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Minus, Plus, Tag, Pencil, Trash2 } from "lucide-react-native";
import { Colors } from "@/src/constants/colors";
import { FontSize, FontWeight } from "@/src/constants/typography";
import { RecipeIngredient } from "@/src/types/recipeIngredient";
import IngredientFormSheet, { IngredientFormData } from "./IngredientFormSheet";
import OutlineButton from "@/src/components/ui/OutlineButton";

type IngredientsListProps = {
  ingredients: RecipeIngredient[];
  basePortions: number;
  portions: number;
  categories: string[];
  onIncrement: () => void;
  onDecrement: () => void;
  onAddIngredient?: (data: IngredientFormData) => void;
  onEditIngredient?: (index: number, data: IngredientFormData) => void;
  onDeleteIngredient?: (index: number) => void;
};

export default function IngredientsList({
  ingredients,
  basePortions,
  portions,
  categories,
  onIncrement,
  onDecrement,
  onAddIngredient,
  onEditIngredient,
  onDeleteIngredient,
}: IngredientsListProps) {
  const ratio = portions / basePortions;
  const scaled = ingredients.map((ing) => ({
    ...ing,
    quantity: Math.round(ing.quantity * ratio * 10) / 10,
  }));

  const isEditable = !!(onAddIngredient || onEditIngredient || onDeleteIngredient);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const openAdd = () => { setEditingIndex(null); setSheetVisible(true); };
  const openEdit = (index: number) => { setEditingIndex(index); setSheetVisible(true); };
  const handleSheetSave = (data: IngredientFormData) => {
    if (editingIndex !== null) onEditIngredient?.(editingIndex, data);
    else onAddIngredient?.(data);
  };

  return (
    <View>
      {/* Portions selector */}
      <View style={styles.portionsRow}>
        <View style={styles.portionsSelector}>
          <Pressable onPress={onDecrement} style={styles.portionButton} hitSlop={8}>
            <Minus size={16} color={Colors.textPrimary} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.portionsText}>{portions} personnes</Text>
          <Pressable onPress={onIncrement} style={styles.portionButton} hitSlop={8}>
            <Plus size={16} color={Colors.textPrimary} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      {/* Section title */}
      <Text style={styles.sectionTitle}>Ingrédients</Text>

      {/* List */}
      <View style={styles.list}>
        {scaled.map((ing, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.quantity}>
              {ing.quantity > 0 ? ing.quantity : ""}
            </Text>
            <Text style={styles.ingredientText} numberOfLines={1}>
              {ing.unit?.type ? `${ing.unit.type} ` : ""}
              {ing.ingredient.name}
            </Text>
            {isEditable ? (
              <View style={styles.actions}>
                <Pressable onPress={() => openEdit(index)} hitSlop={8} style={styles.actionButton}>
                  <Pencil size={16} color={Colors.primaryMuted} />
                </Pressable>
                <Pressable onPress={() => onDeleteIngredient?.(index)} hitSlop={8} style={styles.actionButton}>
                  <Trash2 size={16} color={Colors.error} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.bullet} />
            )}
          </View>
        ))}
      </View>

      {/* Add button — below list */}
      {isEditable && (
        <OutlineButton
          title="Ajouter un ingrédient"
          onPress={openAdd}
          color={Colors.primaryLight}
          backgroundColor={Colors.cardLight}
        />
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <View style={styles.categoriesSection}>
          <Text style={styles.categoriesLabel}>Catégorie :</Text>
          <View style={styles.categoriesRow}>
            {categories.map((cat) => (
              <View key={cat} style={styles.categoryTag}>
                <Tag size={13} color={Colors.surface} />
                <Text style={styles.categoryText}>{cat}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <IngredientFormSheet
        visible={sheetVisible}
        ingredient={editingIndex !== null ? ingredients[editingIndex] : undefined}
        onClose={() => setSheetVisible(false)}
        onSave={handleSheetSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  portionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center", // 👈 centré
    marginBottom: 16,
  },
  portionsSelector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.primaryMuted,
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 14,
    backgroundColor: Colors.surface, // 👈 fond blanc
  },
  portionButton: { padding: 2 },
  portionsText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  list: {
    gap: 6,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    gap: 8,
  },
  quantity: {
    minWidth: 20,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: "right",
  },
  ingredientText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  actionButton: { padding: 2 },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textPrimary,
  },
  categoriesSection: {
    gap: 10,
    marginTop: 20,
  },
  categoriesLabel: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  categoriesRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  categoryTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: FontSize.sm,
    color: Colors.surface,
    fontWeight: FontWeight.medium,
  },
});
