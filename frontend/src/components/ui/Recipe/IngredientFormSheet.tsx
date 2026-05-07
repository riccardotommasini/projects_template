// src/components/ui/Recipe/IngredientFormSheet.tsx
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
  ScrollView,
} from "react-native";
import { X, Search, Check } from "lucide-react-native";
import { Colors } from "../../../constants/colors";
import { FontSize, FontWeight } from "../../../constants/typography";
import { RecipeIngredient } from "../../../types/recipeIngredient";
import { Ingredient } from "../../../types/ingredient";
import { searchIngredients } from "../../../services/ingredients.service";
import { normalize } from "../../../utils/search";
import { UNITS } from "../../../constants/units";
import UnitDropdown from "../UnitDropdown";

export type IngredientFormData = {
  ingredientID: number;
  name: string;
  quantity: number;
  unitID: number;
  unit: string;
};

type IngredientFormSheetProps = {
  visible: boolean;
  ingredient?: RecipeIngredient;
  onClose: () => void;
  onSave: (data: IngredientFormData) => void;
};

export default function IngredientFormSheet({
  visible,
  ingredient,
  onClose,
  onSave,
}: IngredientFormSheetProps) {
  const isEdit = !!ingredient;

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Ingredient[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [unitID, setUnitID] = useState<number>(1);

  useEffect(() => {
    if (visible) {
      setSearch(ingredient?.ingredient?.name ?? "");
      setSelectedIngredient(ingredient?.ingredient ?? null);
      setQuantity(ingredient?.quantity ? String(ingredient.quantity) : "");
      setUnit(ingredient?.unit?.type ?? "");
      setUnitID(ingredient?.unitID ?? 1);
      setSuggestions([]);
    }
  }, [visible, ingredient]);

  const handleSearch = async (text: string) => {
    setSearch(text);
    setSelectedIngredient(null);
    if (text.length < 1) { setSuggestions([]); return; }
    try {
      const results = await searchIngredients(text);
      const q = normalize(text);
      results.sort((a, b) => {
        const aStarts = normalize(a.name).startsWith(q);
        const bStarts = normalize(b.name).startsWith(q);
        return aStarts === bStarts ? 0 : aStarts ? -1 : 1;
      });
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (ing: Ingredient) => {
    setSelectedIngredient(ing);
    setSearch(ing.name);
    setSuggestions([]);
    const defaultUnit = UNITS.find((u) => u.type === ing.unitDefault);
    if (defaultUnit) { setUnit(defaultUnit.type); setUnitID(defaultUnit.unitID); }
  };

  const handleSave = () => {
    if (!selectedIngredient) return;
    onSave({
      ingredientID: selectedIngredient.ingredientID,
      name: selectedIngredient.name,
      quantity: parseFloat(quantity) || 0,
      unitID,
      unit,
    });
    onClose();
  };

  const canSave = !!selectedIngredient;

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

          <View style={styles.sheetHeader}>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.sheetTitle}>
              {isEdit ? "Modifier l'ingrédient" : "Ajouter un ingrédient"}
            </Text>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              hitSlop={8}
              style={[styles.checkButton, !canSave && styles.checkButtonDisabled]}
            >
              <Check size={22} color={canSave ? Colors.primaryLight : Colors.border} strokeWidth={2.5} />
            </Pressable>
          </View>

          <Text style={styles.label}>Ingrédient</Text>
          <View style={styles.searchBar}>
            <Search size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={handleSearch}
              placeholder="Rechercher un ingrédient"
              placeholderTextColor={Colors.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <Pressable hitSlop={8} onPress={() => { setSearch(""); setSelectedIngredient(null); setSuggestions([]); }}>
                <X size={16} color={Colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {suggestions.length > 0 && (
            <ScrollView
              style={styles.dropdown}
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
            >
              {suggestions.slice(0, 7).map((ing) => (
                <Pressable key={ing.ingredientID} style={styles.suggestion} onPress={() => handleSelectSuggestion(ing)}>
                  <Text style={styles.suggestionText}>{ing.name}</Text>
                  <Text style={styles.suggestionUnit}>{ing.unitDefault}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={styles.row}>
            <View style={styles.quantityField}>
              <Text style={styles.label}>Quantité</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                onBlur={() => {
                  const v = parseFloat(quantity) || 0
                  setQuantity(String(Math.min(9999, Math.max(0, v))))
                }}
                placeholder="Ex. : 100"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
                maxLength={7}
              />
            </View>
            <View style={styles.unitField}>
              <Text style={styles.label}>Unité</Text>
              <UnitDropdown
                value={unit || "Choisir"}
                selectedUnitID={unitID}
                onSelect={(u) => { setUnit(u.type); setUnitID(u.unitID); }}
                buttonStyle={[styles.unitSelector, !!unit && styles.unitSelectorFilled]}
                buttonActiveStyle={styles.unitSelectorActive}
                textStyle={unit ? styles.unitText : styles.unitPlaceholder}
                iconSize={16}
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
    marginBottom: 20,
  },

  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },

  checkButton: { padding: 4 },
  checkButtonDisabled: { opacity: 0.4 },

  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: 6,
  },

  searchBar: {
    height: 52,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },

  dropdown: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: "hidden",
    maxHeight: 220,
  },

  suggestion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  suggestionText: { fontSize: FontSize.md, color: Colors.textPrimary },
  suggestionUnit: { fontSize: FontSize.sm, color: Colors.textSecondary },

  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },

  quantityField: { flex: 1 },
  unitField: { flex: 1 },

  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },

  unitSelector: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  unitSelectorFilled: { borderColor: Colors.border },
  unitSelectorActive: { borderColor: Colors.primaryLight },

  unitText: { fontSize: FontSize.md, color: Colors.textPrimary },
  unitPlaceholder: { fontSize: FontSize.md, color: Colors.textSecondary },
});
