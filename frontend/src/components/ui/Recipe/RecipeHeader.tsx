import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { ArrowLeft, Share2, Clock, Flame, Pencil, X, Bookmark, Camera } from "lucide-react-native";
import { Colors } from "@/src/constants/colors";
import { FontSize, FontWeight } from "@/src/constants/typography";
import UserAvatar from "../UserAvatar";
import { groupColor } from "@/src/utils/groupColor";

type RecipeHeaderProps = {
  title: string;
  description?: string | null;
  photo?: string | null;
  prepTime: string;
  cookTime: string;
  photoUrl?: string | null;
  creator?: { pseudo: string; avatar?: string | null };
  isSaved?: boolean;
  onBack?: () => void;
  onShare?: () => void;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onEdit?: () => void;
  onToggleSave?: () => void;
  onChangePhoto?: () => void;
};

export default function RecipeHeader({
  title,
  description,
  photo,
  prepTime,
  cookTime,
  photoUrl,
  creator,
  isSaved,
  onBack,
  onShare,
  isEditing = false,
  onToggleEdit,
  onEdit,
  onToggleSave,
  onChangePhoto,
}: RecipeHeaderProps) {
  return (
    <View style={[styles.header, isEditing && styles.headerEditing]}>
      {/* Hero photo */}
      <View style={styles.heroContainer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: groupColor(title) }]} />
        )}

        {/* Boutons overlay top */}
        <View style={styles.heroTop}>
          <Pressable onPress={onBack} style={styles.heroIconBtn} hitSlop={8}>
            <ArrowLeft size={22} color="#fff" />
          </Pressable>
          <View style={styles.topRight}>
            {onToggleEdit && (
              <Pressable onPress={onToggleEdit} style={styles.heroIconBtn} hitSlop={8}>
                {isEditing
                  ? <X size={22} color="#fff" />
                  : <Pencil size={20} color="#fff" />
                }
              </Pressable>
            )}
            {onToggleSave !== undefined && (
              <Pressable onPress={onToggleSave} style={styles.heroIconBtn} hitSlop={8}>
                <Bookmark
                  size={22}
                  color="#fff"
                  fill={isSaved ? "#fff" : "transparent"}
                />
              </Pressable>
            )}
            {!isEditing && onShare && (
              <Pressable onPress={onShare} style={styles.heroIconBtn} hitSlop={8}>
                <Share2 size={22} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Bouton changer photo (mode édition) */}
        {isEditing && onChangePhoto && (
          <Pressable style={styles.cameraBtn} onPress={onChangePhoto} hitSlop={8}>
            <Camera size={18} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* Contenu texte */}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>

        {description ? (
          <Text style={styles.description} numberOfLines={2}>{description}</Text>
        ) : null}

        {creator && (
          <View style={styles.creatorRow}>
            <UserAvatar user={creator} size={18} />
            <Text style={styles.creatorText}>@{creator.pseudo}</Text>
          </View>
        )}

        <View style={styles.timesRow}>
          <View style={styles.timeItem}>
            <Clock size={14} color={Colors.textSecondary} />
            <Text style={styles.timeText}>{prepTime}</Text>
          </View>
          <View style={styles.timeItem}>
            <Flame size={14} color={Colors.textSecondary} />
            <Text style={styles.timeText}>{cookTime}</Text>
          </View>
          {isEditing && onEdit && (
            <Pressable onPress={onEdit} hitSlop={8} style={styles.editTimesButton}>
              <Pencil size={15} color={Colors.primaryLight} />
            </Pressable>
          )}
        </View>

        {isEditing && (
          <Text style={styles.editingBanner}>Mode édition activé</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.background,
  },

  photoBanner: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: Colors.cardLight,
  },

  headerEditing: {
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primaryLight,
  },

  heroContainer: {
    position: "relative",
  },

  heroImage: {
    width: "100%",
    height: 200,
  },

  heroTop: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  heroIconBtn: {
    padding: 7,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
  },

  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  cameraBtn: {
    position: "absolute",
    bottom: 12,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    padding: 9,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
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
    fontWeight: FontWeight.regular,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
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

  editTimesButton: {
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
});
