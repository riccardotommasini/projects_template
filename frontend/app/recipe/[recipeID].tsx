import { useLocalSearchParams } from "expo-router";
import RecipeScreen from "@/src/screens/RecipeScreen";

export default function RecipeDetailPage() {
  const { recipeID } = useLocalSearchParams<{ recipeID: string }>();

  return <RecipeScreen recipeID={Number(recipeID)} />;
}