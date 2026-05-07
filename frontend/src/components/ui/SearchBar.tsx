import { View, TextInput, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import { Search, SlidersHorizontal } from "lucide-react-native";
import { Colors } from "../../constants/colors";
import { FontSize, FontWeight } from "../../constants/typography";

type SearchBarProps = {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onFilterPress?: () => void;
  showFilter?: boolean;
  filterButtonColor?: string;
};

export default function SearchBar({
  placeholder,
  value,
  onChangeText,
  onFilterPress,
  showFilter = false,
  filterButtonColor = Colors.surface,
}: SearchBarProps) {
  const { width } = useWindowDimensions();

  const isSmall = width < 360;
  const isLarge = width >= 768;

  const buttonSize = isSmall ? 44 : isLarge ? 60 : 52;
  const barHeight = isSmall ? 44 : isLarge ? 60 : 52;
  const iconSize = isSmall ? 16 : isLarge ? 22 : 18;
  const filterIconSize = isSmall ? 18 : isLarge ? 24 : 20;
  const borderRadius = isLarge ? 22 : 18;
  const paddingH = isSmall ? 16 : isLarge ? 32 : 24;
  const gap = isSmall ? 8 : isLarge ? 16 : 12;

  return (
    <View
      style={[
        styles.searchRow,
        { paddingHorizontal: paddingH, gap },
      ]}
    >
      <View
        style={[
          styles.searchBar,
          {
            height: barHeight,
            borderRadius,
          },
        ]}
      >
        <Search size={iconSize} color={Colors.textSecondary} />

        <TextInput
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          style={[
            styles.searchInput,
            {
              fontSize: isSmall ? FontSize.sm : isLarge ? FontSize.lg : FontSize.md,
              fontWeight: FontWeight.regular,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
        />
      </View>

      {showFilter && (
        <Pressable
          style={[
            styles.filterButton,
            {
              backgroundColor: filterButtonColor,
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
            },
          ]}
          onPress={onFilterPress}
        >
          <SlidersHorizontal size={filterIconSize} color={Colors.textPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  searchBar: {
    flex: 1,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: Colors.textPrimary,
  },

  filterButton: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
});