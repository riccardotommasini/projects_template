import { useState, useEffect, useRef } from "react";
import { StyleSheet, ScrollView, ActivityIndicator, Alert, View, Text, Image, Pressable, Share } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, X, Pencil, Share2, Bookmark, Camera, Clock, Flame } from "lucide-react-native";
import { Colors } from "@/src/constants/colors";
import { FontSize, FontWeight } from "@/src/constants/typography";
import RecipeTabBar, { RecipeTab } from "@/src/components/ui/Recipe/RecipeTabBar";
import CommentSection from "@/src/components/ui/Recipe/CommentSection";
import IngredientsList from "@/src/components/ui/Recipe/IngredientsList";
import PreparationList from "@/src/components/ui/Recipe/PreparationList";
import EditHeaderSheet from "@/src/components/ui/Recipe/EditHeaderSheet";
import PrimaryButton from "@/src/components/ui/PrimaryButton";
import UserAvatar from "@/src/components/ui/UserAvatar";
import { getRecipeById, updateRecipe, updateRecipePhoto, getSeedRecipeById, saveSeedRecipe } from "@/src/services/recipes.service";
import type { RecipeReview } from "@/src/services/recipes.service";
import { getTags } from "@/src/services/tags.service";
import TagChips from "@/src/components/ui/TagChips";
import { Tag } from "@/src/types/recipe";
import { saveRecipe, unsaveRecipe } from "@/src/services/users.service";
import { uploadRecipePhoto, getSignedRecipePhotoUrl } from "@/src/services/storage.service";
import { supabase } from "@/src/config/supabase";
import { groupColor } from "@/src/utils/groupColor";
import type { RecipeDetail } from "@/src/services/recipes.service";
import type { RecipeIngredient } from "@/src/types/recipeIngredient";
import type { IngredientFormData } from "@/src/components/ui/Recipe/IngredientFormSheet";
import { useAuth } from "@/src/hooks/useAuth";
import { useRouter } from "expo-router";

const PHOTO_HEIGHT = 220;

type RecipeScreenProps = {
  recipeID: number;
};

const formatTime = (minutes: number): string =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? `${minutes % 60}min` : ""}`
    : `${minutes}min`;

const toBackendIngredients = (ingredients: RecipeIngredient[]) =>
  ingredients.map((ing) => ({
    ingredientID: ing.ingredientID,
    quantity: ing.quantity,
    unitID: ing.unitID,
  }));

export default function RecipeScreen({ recipeID }: RecipeScreenProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<RecipeTab>("ingredients");
  const [portions, setPortions] = useState<number>(1);
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIDs, setSelectedTagIDs] = useState<number[]>([])
  const [headerSheetVisible, setHeaderSheetVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isSeedRecipe, setIsSeedRecipe] = useState(false);
  const [reviews, setReviews] = useState<RecipeReview[]>([]);

  const hasUnsavedChanges = useRef(false);
  const recipeSnapshot = useRef<RecipeDetail | null>(null);

  const isOwner = !!recipe && !!currentUser && recipe.creator?.userID === currentUser.id;

  useEffect(() => {
    const load = async () => {
      try {
        // If recipeID is negative, it's a seed recipe
        let data;
        if (recipeID < 0) {
          setIsSeedRecipe(true);
          // Calculate seed index from negative recipeID (-1 = index 0, -2 = index 1, etc)
          const seedIndex = Math.abs(recipeID) - 1;
          data = await getSeedRecipeById(seedIndex);
        } else {
          setIsSeedRecipe(false);
          data = await getRecipeById(recipeID);
        }
        setRecipe(data);
        setPortions(data.portion);
        if (currentUser) {
          setIsSaved(data.savedBy?.some(s => s.userID === currentUser.id) ?? false);
        }
        setSelectedTagIDs(data.tags?.map(t => t.tag.tagID) ?? [])
        setReviews(data.reviews ?? [])
        if (data.photo) {
          if (data.photo.startsWith("http")) {
            setPhotoUrl(data.photo);
          } else {
            getSignedRecipePhotoUrl(data.photo).then(setPhotoUrl).catch(() => {});
          }
        }
      } catch (e) {
        console.error("Erreur chargement recette", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [recipeID, currentUser]);

  useEffect(() => { getTags().then(setAllTags).catch(() => {}) }, [])

  const markUnsaved = () => { hasUnsavedChanges.current = true; setIsDirty(true); };

  const handleToggleEdit = () => {
    if (isEditing) {
      if (hasUnsavedChanges.current) {
        Alert.alert(
          "Modifications non enregistrées",
          "Vous avez des modifications non enregistrées. Voulez-vous les annuler ?",
          [
            { text: "Continuer l'édition", style: "cancel" },
            {
              text: "Annuler les modifications",
              style: "destructive",
              onPress: () => {
                if (recipeSnapshot.current) setRecipe(recipeSnapshot.current);
                recipeSnapshot.current = null;
                hasUnsavedChanges.current = false;
                setIsDirty(false);
                setIsEditing(false);
              },
            },
          ]
        );
      } else {
        recipeSnapshot.current = null;
        setIsEditing(false);
      }
    } else {
      recipeSnapshot.current = recipe;
      hasUnsavedChanges.current = false;
      setIsDirty(false);
      setIsEditing(true);
    }
  };

  const handleToggleSave = async () => {
    const prev = isSaved;
    setIsSaved(!prev);
    try {
      if (prev) {
        await unsaveRecipe(recipeID);
      } else {
        await saveRecipe(recipeID);
      }
    } catch {
      setIsSaved(prev);
      Alert.alert("Erreur", prev ? "Impossible de retirer la recette." : "Impossible de sauvegarder la recette.");
    }
  };

  const handleShare = () => {
    if (!recipe) return;
    const lines: string[] = [];

    lines.push(recipe.name.toUpperCase());
    lines.push('');

    const meta: string[] = [];
    if (recipe.prepTime) meta.push(`Préparation : ${formatTime(recipe.prepTime)}`);
    if (recipe.cookTime) meta.push(`Cuisson : ${formatTime(recipe.cookTime)}`);
    if (recipe.portion) meta.push(`Pour ${recipe.portion} personne${recipe.portion > 1 ? 's' : ''}`);
    if (meta.length) { lines.push(meta.join('  |  ')); lines.push(''); }

    if (recipe.description) { lines.push(recipe.description); lines.push(''); }

    if (recipe.ingredients.length > 0) {
      lines.push('INGRÉDIENTS');
      recipe.ingredients.forEach(ing => {
        const qty = ing.quantity ? `${ing.quantity} ${ing.unit?.type ?? ''}`.trim() : '';
        lines.push(`- ${qty ? qty + ' ' : ''}${ing.ingredient.name}`);
      });
      lines.push('');
    }

    if (recipe.steps.length > 0) {
      lines.push('ÉTAPES');
      recipe.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .forEach((s, i) => lines.push(`${i + 1}. ${s.text}`));
    }

    Share.share({ message: lines.join('\n') });
  };

  const handleSaveAll = async () => {
    if (!recipe) return;
    setIsSaving(true);
    try {
      await updateRecipe(recipeID, {
        name: recipe.name,
        description: recipe.description ?? undefined,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        ingredients: toBackendIngredients(recipe.ingredients),
        tagIDs: selectedTagIDs,
        steps: recipe.steps.map((s, i) => ({
          ...(s.stepID ? { stepID: s.stepID } : {}),
          text: s.text,
          order: i + 1,
        })),
      });
      recipeSnapshot.current = null;
      hasUnsavedChanges.current = false;
      setIsDirty(false);
      setIsEditing(false);
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer les modifications.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveHeader = (data: { title: string; description: string; prepTime: number; cookTime: number }) => {
    if (!recipe) return;
    setRecipe({ ...recipe, name: data.title, description: data.description, prepTime: data.prepTime, cookTime: data.cookTime });
    markUnsaved();
  };

  const handleChangePhoto = () => {
    Alert.alert("Photo de la recette", undefined, [
      { text: "Prendre une photo", onPress: () => pickPhoto(true) },
      { text: "Choisir depuis la galerie", onPress: () => pickPhoto(false) },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const pickPhoto = async (fromCamera: boolean) => {
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [16, 9], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    const { data: sessionData } = await supabase.auth.getSession();
    const userID = sessionData.session?.user.id;
    if (!userID) return;
    try {
      const path = await uploadRecipePhoto(uri, userID, recipeID);
      await updateRecipePhoto(recipeID, path);
      setPhotoUrl(uri);
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour la photo.");
    }
  };

  const handleAddIngredient = (data: IngredientFormData) => {
    if (!recipe) return;
    const newIngredient: RecipeIngredient = {
      ingredientID: data.ingredientID,
      unitID: data.unitID,
      quantity: data.quantity,
      ingredient: { ingredientID: data.ingredientID, name: data.name, category: '', calories: 0, unitDefault: data.unit },
      unit: { unitID: data.unitID, type: data.unit },
    };
    setRecipe({ ...recipe, ingredients: [...recipe.ingredients, newIngredient] });
    markUnsaved();
  };

  const handleEditIngredient = (index: number, data: IngredientFormData) => {
    if (!recipe) return;
    const updatedIngredients = recipe.ingredients.map((ing, i) =>
      i === index
        ? {
            ...ing,
            ingredientID: data.ingredientID,
            quantity: data.quantity,
            unitID: data.unitID,
            ingredient: { ...ing.ingredient, ingredientID: data.ingredientID, name: data.name },
            unit: { unitID: data.unitID, type: data.unit },
          }
        : ing
    );
    setRecipe({ ...recipe, ingredients: updatedIngredients });
    markUnsaved();
  };

  const handleDeleteIngredient = (index: number) => {
    if (!recipe) return;
    setRecipe({ ...recipe, ingredients: recipe.ingredients.filter((_, i) => i !== index) });
    markUnsaved();
  };

  const handleSaveSteps = (steps: string[]) => {
    if (!recipe) return;
    const updatedSteps = steps.map((text, i) => ({
      ...(recipe.steps[i] ?? {}),
      text,
      order: i + 1,
      recipeID: recipe.recipeID,
    }));
    setRecipe({ ...recipe, steps: updatedSteps });
    markUnsaved();
  };

  const handleSaveSeedRecipe = async () => {
    if (!recipe || !isSeedRecipe) return;
    setIsSaving(true);
    try {
      const seedIndex = Math.abs(recipeID) - 1;
      await saveSeedRecipe(seedIndex);
      Alert.alert(
        "Succès",
        "La recette a été enregistrée dans votre collection !",
        [
          {
            text: "Voir mes recettes",
            onPress: () => {
              router.push("/(tabs)/profile");
            },
          },
          {
            text: "Fermer",
            style: "cancel",
          },
        ]
      );
    } catch (e) {
      console.error("Erreur sauvegarde recette seed", e);
      Alert.alert("Erreur", "Impossible d'enregistrer la recette.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !recipe) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primaryLight} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Photo — derrière le scroll */}
      <View style={[styles.photo, { backgroundColor: groupColor(recipe.name) }]}>
        {photoUrl && (
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
      </View>

      {/* Boutons de nav — au-dessus du scroll */}
      <View style={[styles.navRow, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <View style={styles.navRight}>
          {isOwner && isEditing && (
            <Pressable onPress={handleChangePhoto} style={styles.navBtn} hitSlop={8}>
              <Camera size={20} color="#fff" />
            </Pressable>
          )}
          {isOwner && (
            <Pressable onPress={handleToggleEdit} style={styles.navBtn} hitSlop={8}>
              {isEditing
                ? <X size={22} color="#fff" />
                : <Pencil size={20} color="#fff" />
              }
            </Pressable>
          )}
          {!isOwner && (
            <Pressable onPress={handleToggleSave} style={styles.navBtn} hitSlop={8}>
              <Bookmark size={22} color="#fff" fill={isSaved ? "#fff" : "transparent"} />
            </Pressable>
          )}
          {!isEditing && (
            <Pressable onPress={handleShare} style={styles.navBtn} hitSlop={8}>
              <Share2 size={22} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Scroll — passe au-dessus de la photo */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: PHOTO_HEIGHT }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* 0 — infos recette (carte qui glisse sur la photo) */}
        <View style={[styles.infoCard, isEditing && styles.infoCardEditing]}>
          <Text style={styles.title}>{recipe.name}</Text>
          {recipe.description ? (
            <Text style={styles.description} numberOfLines={3}>{recipe.description}</Text>
          ) : null}
          {!isOwner && recipe.creator && (
            <View style={styles.creatorRow}>
              <UserAvatar user={recipe.creator} size={18} />
              <Text style={styles.creatorText}>@{recipe.creator.pseudo}</Text>
            </View>
          )}
          <View style={styles.timesRow}>
            <View style={styles.timeItem}>
              <Clock size={14} color={Colors.textSecondary} />
              <Text style={styles.timeText}>{formatTime(recipe.prepTime)}</Text>
            </View>
            <View style={styles.timeItem}>
              <Flame size={14} color={Colors.textSecondary} />
              <Text style={styles.timeText}>{formatTime(recipe.cookTime)}</Text>
            </View>
            {isEditing && (
              <Pressable onPress={() => setHeaderSheetVisible(true)} hitSlop={8} style={styles.editTimesBtn}>
                <Pencil size={15} color={Colors.primaryLight} />
              </Pressable>
            )}
          </View>
          {isEditing && (
            <Text style={styles.editingBanner}>Mode édition activé</Text>
          )}
          {isEditing && allTags.length > 0 && (
            <TagChips
              tags={allTags}
              selectedIDs={new Set(selectedTagIDs)}
              onToggle={(tagID) => {
                setSelectedTagIDs(prev =>
                  prev.includes(tagID) ? prev.filter(id => id !== tagID) : [...prev, tagID]
                )
                markUnsaved()
              }}
              horizontal={false}
            />
          )}
          {!isEditing && (recipe.tags?.length ?? 0) > 0 && (
            <TagChips
              tags={recipe.tags!.map(t => t.tag)}
              selectedIDs={new Set(recipe.tags!.map(t => t.tag.tagID))}
              onToggle={() => {}}
              horizontal={false}
            />
          )}
        </View>

        {/* 1 — tab bar sticky */}
        <View style={styles.tabBarWrapper}>
          <RecipeTabBar activeTab={tab} onTabChange={setTab} showAvis={!isEditing} />
        </View>

        {/* 2 — contenu */}
        <View style={styles.contentWrapper}>
          {tab === "ingredients" ? (
            <IngredientsList
              ingredients={recipe.ingredients}
              basePortions={recipe.portion}
              portions={portions}
              categories={[]}
              onIncrement={() => setPortions((p) => p + 1)}
              onDecrement={() => setPortions((p) => Math.max(1, p - 1))}
              onAddIngredient={isEditing ? handleAddIngredient : undefined}
              onEditIngredient={isEditing ? handleEditIngredient : undefined}
              onDeleteIngredient={isEditing ? handleDeleteIngredient : undefined}
            />
          ) : tab === "preparation" ? (
            <PreparationList
              steps={recipe.steps.map((s) => s.text)}
              onSave={isEditing ? handleSaveSteps : undefined}
            />
          ) : (
            <CommentSection
              recipeID={recipe.recipeID}
              currentUserID={currentUser?.id ?? null}
              isOwner={isOwner}
              reviews={reviews}
              onReviewChange={setReviews}
            />
          )}
        </View>
      </ScrollView>

      {isEditing && (
        <View style={styles.footer}>
          <PrimaryButton
            title={isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
            onPress={handleSaveAll}
            backgroundColor={Colors.primaryButton}
            textColor={Colors.surface}
            disabled={!isDirty || isSaving}
          />
        </View>
      )}

      {/* Save seed recipe button — only visible for seed recipes that haven't been saved */}
      {isSeedRecipe && (
        <View style={styles.footer}>
          <PrimaryButton
            title={isSaving ? "Enregistrement..." : "Enregistrer cette recette"}
            onPress={handleSaveSeedRecipe}
            backgroundColor={Colors.primaryButton}
            textColor={Colors.surface}
          />
        </View>
      )}

      <EditHeaderSheet
        visible={headerSheetVisible}
        title={recipe.name}
        description={recipe.description ?? null}
        prepTime={recipe.prepTime}
        cookTime={recipe.cookTime}
        onClose={() => setHeaderSheetVisible(false)}
        onSave={handleSaveHeader}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  // Photo fixe derrière le scroll
  photo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: PHOTO_HEIGHT,
  },
  // Boutons nav au-dessus de tout
  navRow: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  navBtn: {
    padding: 7,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // Scroll transparent (la photo se voit à travers le paddingTop)
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },

  // Carte infos : fond blanc + coins arrondis en haut (glisse sur la photo)
  infoCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  infoCardEditing: {
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primaryLight,
  },

  title: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 34,
    marginBottom: 4,
  },
  description: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  creatorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.primaryLight,
  },
  timesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  editTimesBtn: {
    marginLeft: "auto",
    padding: 4,
  },
  editingBanner: {
    marginTop: 8,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.primaryLight,
    textAlign: "center",
  },

  // Tab bar sticky avec fond pour couvrir la photo
  tabBarWrapper: {
    backgroundColor: Colors.background,
    paddingVertical: 10,
  },

  // Contenu ingrédients / étapes
  contentWrapper: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.background,
  },
});
