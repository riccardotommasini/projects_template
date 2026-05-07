// src/components/ui/Recipe/RecipeTabBar.tsx
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SquarePen } from "lucide-react-native";
import { Colors } from "../../../constants/colors";
import { FontSize, FontWeight } from "../../../constants/typography";

export type RecipeTab = "ingredients" | "preparation" | "avis";

type RecipeTabBarProps = {
  activeTab: RecipeTab;
  onTabChange: (tab: RecipeTab) => void;
  onEdit?: () => void;
  showAvis?: boolean;
};

const TABS: { key: RecipeTab; label: string }[] = [
  { key: "ingredients", label: "Ingrédients" },
  { key: "preparation", label: "Préparation" },
  { key: "avis", label: "Avis" },
];

export default function RecipeTabBar({
  activeTab,
  onTabChange,
  onEdit,
  showAvis = true,
}: RecipeTabBarProps) {
  const visibleTabs = showAvis ? TABS : TABS.filter(t => t.key !== "avis");
  return (
    <View style={styles.wrapper}>
      <View style={styles.tabs}>
        {visibleTabs.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <Pressable
              key={key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onTabChange(key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {onEdit && (
        <Pressable onPress={onEdit} style={styles.editButton} hitSlop={8}>
          <SquarePen size={22} color={Colors.primaryMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    gap: 10,
  },

  tabs: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.cardLight,
    borderRadius: 16,
    padding: 4,
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 13,
  },

  tabActive: {
    backgroundColor: Colors.cardDark,
  },

  tabText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.primaryLight,
  },

  tabTextActive: {
    color: Colors.primary,
  },

  editButton: {
    padding: 4,
  },
});
