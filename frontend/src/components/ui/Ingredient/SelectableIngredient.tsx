// src/components/ui/Recipe/SelectableQuantityItem.tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Check, Minus, Plus } from "lucide-react-native";
import { Colors } from "../../../constants/colors";
import { FontSize, FontWeight } from "../../../constants/typography";

type SelectableIngredientProps = {
  title: string;
  checked: boolean;
  quantity: number;
  onToggle: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  color?: string;
  buttonBackgroundColor?: string;
};

export default function SelectableQuantityItem({
  title,
  checked,
  quantity,
  onToggle,
  onIncrement,
  onDecrement,
  color = Colors.primary,
  buttonBackgroundColor = Colors.surface,
}: SelectableIngredientProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.checkbox,
          {
            borderColor: color,
            backgroundColor: checked ? color : "transparent",
          },
        ]}
        onPress={onToggle}
      >
        {checked && <Check size={18} color={Colors.surface} strokeWidth={3} />}
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <Pressable
        style={[styles.quantityButton, { borderColor: color, backgroundColor: buttonBackgroundColor}]}
        onPress={onDecrement}
      >
        <Minus size={18} color={color} strokeWidth={3} />
      </Pressable>

      <Text style={styles.quantity}>{quantity}</Text>

      <Pressable
        style={[styles.quantityButton, { borderColor: color, backgroundColor: buttonBackgroundColor  }]}
        onPress={onIncrement}
      >
        <Plus size={18} color={color} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 76,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 22,
  },

  title: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },

  quantityButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  quantity: {
    width: 42,
    textAlign: "center",
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
});
