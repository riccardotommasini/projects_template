import { useState, useEffect } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Check } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/src/constants'
import { RecipeDetail } from '@/src/services/recipes.service'
import { getSignedRecipePhotoUrl } from '@/src/services/storage.service'

export const CARD_WIDTH = 148

type Props = {
    recipe: RecipeDetail
    isSelecting: boolean
    selected: boolean
    onPress: () => void
    onLongPress: () => void
}

export default function GroupRecipeCard({ recipe, isSelecting, selected, onPress, onLongPress }: Props) {
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)

    useEffect(() => {
        if (!recipe.photo) return
        if (recipe.photo.startsWith('http')) { setPhotoUrl(recipe.photo); return }
        getSignedRecipePhotoUrl(recipe.photo).then(setPhotoUrl).catch(() => {})
    }, [recipe.photo])

    return (
        <TouchableOpacity
            style={[styles.card, selected && styles.cardSelected]}
            activeOpacity={0.75}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={400}
        >
            {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photo} />
            ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                    <Text style={styles.photoInitial}>{recipe.name[0]?.toUpperCase()}</Text>
                </View>
            )}
            <Text style={styles.name} numberOfLines={2}>{recipe.name}</Text>
            <View style={styles.metaRow}>
                <Text style={styles.meta}>{(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)} min</Text>
                {recipe.creator && (
                    <Text style={styles.creator} numberOfLines={1}>@{recipe.creator.pseudo}</Text>
                )}
            </View>

            {isSelecting && (
                <View style={[styles.checkOverlay, selected && styles.checkOverlaySelected]}>
                    {selected && <Check size={14} color={Colors.surface} strokeWidth={3} />}
                </View>
            )}
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    card: {
        width: CARD_WIDTH,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    cardSelected: {
        borderColor: Colors.primaryLight,
        borderWidth: 2,
    },
    photo: {
        width: '100%',
        height: CARD_WIDTH * 0.65,
        resizeMode: 'cover',
    },
    photoFallback: {
        backgroundColor: Colors.cardLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoInitial: {
        fontSize: FontSize.xxxxl,
        fontWeight: FontWeight.bold,
        color: Colors.primaryMuted,
    },
    name: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textPrimary,
        paddingHorizontal: Spacing.sm,
        paddingTop: Spacing.xs,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.sm,
        paddingBottom: Spacing.sm,
        marginTop: 2,
        gap: 4,
    },
    meta: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },
    creator: {
        fontSize: FontSize.xs,
        color: Colors.primaryLight,
        fontWeight: FontWeight.medium,
        flexShrink: 1,
    },
    checkOverlay: {
        position: 'absolute',
        top: Spacing.xs,
        right: Spacing.xs,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: Colors.surface,
        backgroundColor: 'rgba(0,0,0,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkOverlaySelected: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primaryLight,
    },
})
