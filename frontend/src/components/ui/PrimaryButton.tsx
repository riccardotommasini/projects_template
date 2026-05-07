// src/components/ui/PrimaryButton.tsx
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Colors } from "../../constants/colors";
import { FontSize, FontWeight } from "../../constants/typography";

type Props = {
  title: string;
  onPress: () => void;
  backgroundColor?: string;
  textColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function PrimaryButton({
  title,
  onPress,
  backgroundColor = Colors.primaryButton,
  textColor = Colors.surface,
  disabled = false,
  style,
}: Props) {
  return (
    <Pressable
      style={[styles.button, { backgroundColor }, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, { color: textColor }]}> {title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 45,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },

  text: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});
