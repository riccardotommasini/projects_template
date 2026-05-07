// src/components/ui/OutlineButton.tsx
import { Pressable, Text, StyleSheet, View } from "react-native";
import { Plus } from "lucide-react-native";
import { Colors } from "../../constants/colors";
import { FontSize, FontWeight } from "../../constants/typography";

type Props = {
  title: string;
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
};

export default function OutlineButton({
  title,
  onPress,
  color = Colors.primaryLight,
  backgroundColor = Colors.cardLight,
}: Props) {
  return (
    <Pressable
      style={[styles.button, { borderColor: color, backgroundColor }]}
      onPress={onPress}
    >
      <View style={styles.content}>
        <Plus size={22} color={color} />
        <Text style={[styles.text, { color }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 45,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  text: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});
