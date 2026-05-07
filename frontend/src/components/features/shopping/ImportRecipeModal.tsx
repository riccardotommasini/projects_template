import { useState, useEffect } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Search, Minus, Plus, Check } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, ComponentSize } from '@/src/constants'
import { ShoppingList, ShoppingItem } from '@/src/types/shoppingList'
import { RecipeDetail, getMyRecipes, getRecipeById } from '@/src/services/recipes.service'
import { getMySavedRecipes } from '@/src/services/users.service'
import { addItem, updateItem, getList } from '@/src/services/shoppingList.service'
import { getSignedRecipePhotoUrl } from '@/src/services/storage.service'
import { sortByMatch } from '@/src/utils/search'

type Props = {
    visible: boolean
    listID: number
    currentItems: ShoppingItem[]
    groupRecipes?: RecipeDetail[]
    onClose: () => void
    onImportDone: (updatedList: ShoppingList) => void
}

export default function ImportRecipeModal({ visible, listID, currentItems, groupRecipes, onClose, onImportDone }: Props) {
    const [recipes, setRecipes] = useState<RecipeDetail[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(false)
    const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({})
    const [portions, setPortions] = useState<Record<number, number>>({})
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [importing, setImporting] = useState(false)

    useEffect(() => {
        if (!visible) return
        setLoading(true)
        setSearch('')
        setSelected(new Set())
        setPhotoUrls({})

        const buildData = groupRecipes
            ? Promise.all(groupRecipes.map(r => getRecipeById(r.recipeID)))
            : Promise.allSettled([getMyRecipes(), getMySavedRecipes()]).then(([myResult, savedResult]) => {
                const mine: RecipeDetail[] = myResult.status === 'fulfilled' ? myResult.value : []
                const savedRaw = savedResult.status === 'fulfilled' ? savedResult.value : []
                const seen = new Set(mine.map(r => r.recipeID))
                const savedOnly = savedRaw
                    .filter(s => !seen.has(s.recipeID))
                    .map(s => s.recipe as RecipeDetail)
                return [...mine, ...savedOnly]
            })

        buildData.then(async data => {
                setRecipes(data)

                const defaultPortions: Record<number, number> = {}
                data.forEach(r => { defaultPortions[r.recipeID] = r.portion })
                setPortions(defaultPortions)

                const urls: Record<number, string> = {}
                await Promise.allSettled(
                    data
                        .filter(r => r.photo && !r.photo.startsWith('http'))
                        .map(async r => {
                            const url = await getSignedRecipePhotoUrl(r.photo!)
                            urls[r.recipeID] = url
                        })
                )
                data.filter(r => r.photo?.startsWith('http')).forEach(r => { urls[r.recipeID] = r.photo! })
                setPhotoUrls(urls)
            })
            .finally(() => setLoading(false))
    }, [visible])

    const filtered = sortByMatch(recipes, search, r => r.name)

    const toggleSelect = (recipeID: number) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(recipeID) ? next.delete(recipeID) : next.add(recipeID)
            return next
        })
    }

    const setRecipePortions = (recipeID: number, delta: number) => {
        setPortions(prev => ({
            ...prev,
            [recipeID]: Math.max(1, (prev[recipeID] ?? 1) + delta),
        }))
    }

    const handleImport = async () => {
        if (importing || selected.size === 0) return
        setImporting(true)
        try {
            const selectedRecipes = recipes.filter(r => selected.has(r.recipeID))
            await Promise.all(
                selectedRecipes.flatMap(recipe => {
                    const currentPortions = portions[recipe.recipeID] ?? recipe.portion
                    const multiplier = currentPortions / recipe.portion
                    return (recipe.ingredients ?? []).map(ing => {
                        const scaledQty = Math.round(ing.quantity * multiplier * 10) / 10
                        const existing = currentItems.find(i =>
                            (ing.ingredientID && i.ingredientID === ing.ingredientID) ||
                            i.name.toLowerCase() === ing.ingredient.name.toLowerCase()
                        )
                        if (existing) {
                            return updateItem(existing.itemID, {
                                quantity: Math.round(((existing.quantity ?? 0) + scaledQty) * 10) / 10,
                            })
                        }
                        return addItem(listID, {
                            name: ing.ingredient.name,
                            quantity: scaledQty,
                            listID,
                            ingredientID: ing.ingredientID,
                            unitID: ing.unitID ?? undefined,
                        })
                    })
                })
            )
            const updatedList = await getList(listID)
            onImportDone(updatedList)
            onClose()
        } catch {
        } finally {
            setImporting(false)
        }
    }

    const renderRecipe = ({ item }: { item: RecipeDetail }) => {
        const isSelected = selected.has(item.recipeID)
        const currentPortions = portions[item.recipeID] ?? item.portion
        const photoUrl = photoUrls[item.recipeID]

        return (
            <TouchableOpacity
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => toggleSelect(item.recipeID)}
                activeOpacity={0.7}
            >
                {/* Photo */}
                {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.photo} />
                ) : (
                    <View style={styles.photoPlaceholder}>
                        <Text style={styles.photoInitial}>{item.name[0]?.toUpperCase()}</Text>
                    </View>
                )}

                {/* Infos */}
                <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardMeta}>
                        {item.ingredients?.length ?? 0} ingrédient{(item.ingredients?.length ?? 0) > 1 ? 's' : ''}
                        {item.creator ? `  ·  @${item.creator.pseudo}` : ''}
                    </Text>
                </View>

                {/* Portions — visibles seulement si sélectionné */}
                {isSelected && (
                    <View style={styles.portionRow}>
                        <TouchableOpacity
                            style={styles.portionBtn}
                            onPress={(e) => { e.stopPropagation?.(); setRecipePortions(item.recipeID, -1) }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Minus size={13} color={Colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.portionVal}>{currentPortions}</Text>
                        <TouchableOpacity
                            style={styles.portionBtn}
                            onPress={(e) => { e.stopPropagation?.(); setRecipePortions(item.recipeID, 1) }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Plus size={13} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Checkbox */}
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Check size={13} color={Colors.surface} />}
                </View>
            </TouchableOpacity>
        )
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Importer des recettes</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                {/* Recherche */}
                <View style={styles.searchRow}>
                    <Search size={16} color={Colors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher..."
                        placeholderTextColor={Colors.textSecondary}
                        value={search}
                        onChangeText={setSearch}
                        multiline={false}
                    />
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={r => String(r.recipeID)}
                        contentContainerStyle={styles.list}
                        keyboardShouldPersistTaps="handled"
                        renderItem={renderRecipe}
                        ListEmptyComponent={
                            <Text style={styles.empty}>Aucune recette trouvée.</Text>
                        }
                    />
                )}

                {/* Bouton global d'import */}
                {selected.size > 0 && (
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.importBtn, importing && styles.importBtnDisabled]}
                            onPress={handleImport}
                            disabled={importing}
                        >
                            {importing ? (
                                <ActivityIndicator color={Colors.surface} />
                            ) : (
                                <Text style={styles.importBtnText}>
                                    Importer {selected.size} recette{selected.size > 1 ? 's' : ''}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </SafeAreaView>
        </Modal>
    )
}

const PHOTO_SIZE = 56

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginHorizontal: Spacing.xl,
        marginVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        height: ComponentSize.inputHeight,
    },
    searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.md },
    list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
    empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.xl },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.sm,
        marginBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    cardSelected: {
        borderColor: Colors.primaryLight,
        backgroundColor: '#FFF5F5',
    },
    photo: {
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        borderRadius: BorderRadius.sm,
    },
    photoPlaceholder: {
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.cardLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoInitial: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.primaryMuted,
    },
    cardInfo: { flex: 1, justifyContent: 'center' },
    cardName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.textPrimary,
    },
    cardMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
    portionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    portionBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.background,
    },
    portionVal: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        minWidth: 18,
        textAlign: 'center',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primaryLight,
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    importBtn: {
        backgroundColor: Colors.primaryButton,
        borderRadius: BorderRadius.md,
        height: ComponentSize.buttonHeight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    importBtnDisabled: { opacity: 0.6 },
    importBtnText: {
        color: Colors.surface,
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
    },
})
