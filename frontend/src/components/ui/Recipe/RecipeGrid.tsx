import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { useState } from "react";

type GridProps = {
  children: (cardWidth: number) => React.ReactNode; // ← children devient une fonction
  style?: StyleProp<ViewStyle>;
};

export default function Grid({ children, style }: GridProps) {
  const [cardWidth, setCardWidth] = useState(0);
  const gap = 14;

  return (
    <View
      style={[styles.grid, style]}
      onLayout={(e) => {
        const totalWidth = e.nativeEvent.layout.width;
        const paddingHorizontal = 24 * 2; // ← ajoute ça
        setCardWidth((totalWidth - paddingHorizontal - gap) / 2);
      }}
    >
      {cardWidth > 0 ? children(cardWidth) : null}{/* on attend d'avoir la vraie largeur */}
    </View>
  );  
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,    
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
});