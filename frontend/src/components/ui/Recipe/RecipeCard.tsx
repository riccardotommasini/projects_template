import { useState, useEffect } from 'react'
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native'
import { Check } from 'lucide-react-native'
import { router } from 'expo-router'
import { Colors } from '../../../constants/colors'
import { FontSize, FontWeight } from '../../../constants/typography'
import type { Recipe } from '../../../types/recipe'
import { getSignedRecipePhotoUrl } from '../../../services/storage.service'
import UserAvatar from '../UserAvatar'
import { groupColor } from '../../../utils/groupColor'

type RecipeCardProps = {
    recipe: Recipe
    cardWidth: number
    creator?: { pseudo: string; avatar?: string | null }
    isSelecting?: boolean
    selected?: boolean
    onPress?: () => void
    onLongPress?: () => void
}

export default function RecipeCard({ recipe, cardWidth, creator, isSelecting, selected, onPress, onLongPress }: RecipeCardProps) {
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)
    const fallbackColor = groupColor(recipe.name)
    const photoHeight = Math.round(cardWidth * 0.72)
    const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)

    useEffect(() => {
        if (!recipe.photo) return
        if (recipe.photo.startsWith('http')) { setPhotoUrl(recipe.photo); return }
        getSignedRecipePhotoUrl(recipe.photo).then(setPhotoUrl).catch(() => {})
    }, [recipe.photo])

    const handlePress = () => {
        if (onPress) { onPress(); return }
        router.push({ pathname: '/recipe/[recipeID]', params: { recipeID: recipe.recipeID.toString() } })
    }

    return (
        <TouchableOpacity
            style={[styles.card, { width: cardWidth }, selected && styles.cardSelected]}
            activeOpacity={0.8}
            onPress={handlePress}
            onLongPress={onLongPress}
            delayLongPress={400}
        >
            {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={[styles.photo, { height: photoHeight }]} />
            ) : (
                <View style={[styles.photo, styles.photoFallback, { height: photoHeight, backgroundColor: fallbackColor }]}>
                    <Text style={[styles.photoInitial, { fontSize: cardWidth * 0.32 }]}>
                        {recipe.name[0]?.toUpperCase()}
                    </Text>
                </View>
            )}

            {isSelecting && (
                <View style={[styles.checkOverlay, selected && styles.checkOverlaySelected]}>
                    {selected && <Check size={14} color={Colors.surface} strokeWidth={3} />}
                </View>
            )}
            <View style={styles.body}>
                {creator && (
                    <View style={styles.creatorRow}>
                        <UserAvatar user={creator} size={18} />
                        <Text style={styles.creatorPseudo} numberOfLines={1}>@{creator.pseudo}</Text>
                    </View>
                )}
                <Text style={styles.name} numberOfLines={2}>{recipe.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                    {totalTime > 0 ? `${totalTime} min` : ''}
                    {totalTime > 0 && recipe.ingredients.length > 0 ? ' · ' : ''}
                    {recipe.ingredients.length > 0 ? `${recipe.ingredients.length} ingr.` : ''}
                </Text>
            </View>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        marginBottom: 12,
    },
    cardSelected: {
        borderColor: Colors.primaryLight,
        borderWidth: 2,
    },
    checkOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.surface,
        backgroundColor: 'rgba(0,0,0,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    checkOverlaySelected: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primaryLight,
    },
    photo: {
        width: '100%',
        resizeMode: 'cover',
    },
    photoFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoInitial: {
        fontWeight: FontWeight.bold,
        color: Colors.primary,
        opacity: 0.45,
    },
    body: {
        padding: 10,
        gap: 2,
    },
    creatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },
    creatorPseudo: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.primaryLight,
        flex: 1,
    },
    name: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textPrimary,
        lineHeight: 18,
    },
    meta: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 1,
    },
})
