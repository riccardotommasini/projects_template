import { useState, useEffect } from 'react'
import { View, Text, Modal, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Plus } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/src/constants'
import { RecipeDetail, getMyRecipes } from '@/src/services/recipes.service'
import { getMySavedRecipes } from '@/src/services/users.service'
import { addRecipeToGroup } from '@/src/services/groups.service'

type Tab = 'mine' | 'saved'

type Props = {
    visible: boolean
    groupID: number
    existingRecipeIDs: Set<number>
    onClose: () => void
    onAdded: () => void
}

export default function AddRecipeModal({ visible, groupID, existingRecipeIDs, onClose, onAdded }: Props) {
    const [tab, setTab] = useState<Tab>('mine')
    const [myRecipes, setMyRecipes] = useState<RecipeDetail[]>([])
    const [savedRecipes, setSavedRecipes] = useState<RecipeDetail[]>([])
    const [loading, setLoading] = useState(false)
    const [adding, setAdding] = useState<number | null>(null)

    useEffect(() => {
        if (!visible) return
        setLoading(true)
        Promise.all([
            getMyRecipes().catch(() => [] as RecipeDetail[]),
            getMySavedRecipes().then(items => items.map(i => i.recipe as RecipeDetail)).catch(() => [] as RecipeDetail[]),
        ]).then(([mine, saved]) => {
            setMyRecipes(mine)
            setSavedRecipes(saved)
        }).finally(() => setLoading(false))
    }, [visible])

    const handleAdd = async (recipeID: number) => {
        setAdding(recipeID)
        try {
            await addRecipeToGroup(groupID, recipeID)
            onAdded()
        } catch {
            Alert.alert('Erreur', "Impossible d'ajouter cette recette.")
        } finally {
            setAdding(null)
        }
    }

    const available = (tab === 'mine' ? myRecipes : savedRecipes)
        .filter(r => !existingRecipeIDs.has(r.recipeID))

    const renderItem = ({ item }: { item: RecipeDetail }) => (
        <TouchableOpacity
            style={styles.row}
            onPress={() => handleAdd(item.recipeID)}
            disabled={adding === item.recipeID}
        >
            <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                    {(item.ingredients?.length ?? 0)} ingrédient{(item.ingredients?.length ?? 0) > 1 ? 's' : ''} · {(item.prepTime ?? 0) + (item.cookTime ?? 0)} min
                </Text>
            </View>
            {adding === item.recipeID
                ? <ActivityIndicator size="small" color={Colors.primaryLight} />
                : <Plus size={20} color={Colors.primary} />
            }
        </TouchableOpacity>
    )

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Ajouter une recette</Text>
                    <View style={{ width: 22 }} />
                </View>

                <View style={styles.tabs}>
                    {(['mine', 'saved'] as Tab[]).map(t => (
                        <Pressable key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
                            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                                {t === 'mine' ? 'Mes recettes' : 'Enregistrées'}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {loading ? (
                    <ActivityIndicator style={{ flex: 1 }} color={Colors.primaryLight} />
                ) : (
                    <FlatList
                        data={available}
                        keyExtractor={r => String(r.recipeID)}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Text style={styles.emptyText}>
                                    {tab === 'mine'
                                        ? 'Toutes tes recettes sont déjà dans le groupe'
                                        : 'Toutes tes recettes enregistrées sont déjà dans le groupe'}
                                </Text>
                            </View>
                        }
                        renderItem={renderItem}
                    />
                )}
            </SafeAreaView>
        </Modal>
    )
}

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
    title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
    tabs: {
        flexDirection: 'row',
        marginHorizontal: Spacing.xl,
        marginVertical: Spacing.md,
        backgroundColor: Colors.cardLight,
        borderRadius: BorderRadius.md,
        padding: 4,
        gap: 4,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: BorderRadius.sm,
    },
    tabBtnActive: { backgroundColor: Colors.cardDark },
    tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primaryLight },
    tabTextActive: { color: Colors.primary },
    list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.sm },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.md,
    },
    rowInfo: { flex: 1 },
    rowName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
    rowMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, textAlign: 'center' },
})
