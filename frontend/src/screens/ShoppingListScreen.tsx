import { useState, useEffect, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Trash2, Check, ChevronDown, ChevronUp, BookOpen } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/src/constants'
import { ShoppingList, ShoppingItem } from '@/src/types/shoppingList'
import { toggleItem, removeItem, addItem, updateItem, getMyList, getMyGroups, getList } from '@/src/services/shoppingList.service'
import { supabase } from '@/src/config/supabase'
import AddShoppingItem from '@/src/components/features/shopping/AddShoppingItem'
import ImportRecipeModal from '@/src/components/features/shopping/ImportRecipeModal'
import { consumePendingListID } from '@/src/utils/pendingListID'

let channelSeq = 0

export default function ShoppingListScreen() {
    const [lists, setLists] = useState<ShoppingList[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [selectedListID, setSelectedListID] = useState<number>(0)
    const [showImportModal, setShowImportModal] = useState(false)
    const [showListPicker, setShowListPicker] = useState(false)
    const [checkedExpanded, setCheckedExpanded] = useState(false)
    const [groupRecipesMap, setGroupRecipesMap] = useState<Record<number, any[]>>({})

    const fetchLists = useCallback(async () => {
        try {
            const [myListResult, myGroupsResult] = await Promise.allSettled([
                getMyList(),
                getMyGroups(),
            ])
            const allLists: ShoppingList[] = []
            if (myListResult.status === 'fulfilled') allLists.push(myListResult.value)
            if (myGroupsResult.status === 'fulfilled') {
                const recipesMap: Record<number, any[]> = {}
                const groupLists = myGroupsResult.value
                    .filter((g: any) => g.shoppingList)
                    .map((g: any) => {
                        if (g.groupID && g.recipes) {
                            recipesMap[g.groupID] = g.recipes.map((gr: any) => gr.recipe)
                        }
                        return { ...g.shoppingList, name: g.name }
                    })
                setGroupRecipesMap(recipesMap)
                allLists.push(...groupLists)
            }
            setLists(allLists)
            setSelectedListID(prev => prev !== 0 ? prev : (allLists[0]?.listID ?? 0))
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => { fetchLists() }, [fetchLists])

    useFocusEffect(useCallback(() => {
        const id = consumePendingListID()
        if (id) setSelectedListID(id)
    }, []))

    const onRefresh = useCallback(() => {
        setRefreshing(true)
        fetchLists()
    }, [fetchLists])

    // Supabase Realtime : synchronisation en temps réel des items de la liste active
    useEffect(() => {
        if (!selectedListID) return

        const seq = ++channelSeq
        const channel = supabase
            .channel(`shopping-items-${selectedListID}-${seq}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'ShoppingItem',
                filter: `listID=eq.${selectedListID}`,
            }, payload => {
                if (payload.eventType === 'UPDATE') {
                    const updated = payload.new as any
                    setLists(prev => prev.map(l =>
                        l.listID === selectedListID
                            ? { ...l, items: l.items.map(i => i.itemID === updated.itemID ? { ...i, checked: updated.checked } : i) }
                            : l
                    ))
                } else if (payload.eventType === 'DELETE') {
                    const deleted = payload.old as any
                    setLists(prev => prev.map(l =>
                        l.listID === selectedListID
                            ? { ...l, items: l.items.filter(i => i.itemID !== deleted.itemID) }
                            : l
                    ))
                } else if (payload.eventType === 'INSERT') {
                    const inserted = payload.new as any
                    // Re-fetch pour avoir les données complètes (ingredient, unit)
                    // Si l'item existe déjà (ajout local optimiste), le re-fetch est un no-op
                    getList(selectedListID)
                        .then(refreshed => setLists(prev => prev.map(l =>
                            l.listID === selectedListID ? { ...l, items: refreshed.items } : l
                        )))
                        .catch(() => {})
                    void inserted
                }
            })
            .subscribe()

        return () => { channel.unsubscribe(); supabase.removeChannel(channel) }
    }, [selectedListID])

    if (loading) return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: Colors.textSecondary }}>Chargement...</Text>
            </View>
        </SafeAreaView>
    )

    if (lists.length === 0) return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Courses</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: Colors.textSecondary }}>Aucune liste de courses disponible.</Text>
            </View>
        </SafeAreaView>
    )

    const currentList = lists.find(l => l.listID === selectedListID)
    if (!currentList) return null

    const handleToggle = async (item: ShoppingItem) => {
        setLists(prev => prev.map(list =>
            list.listID === selectedListID
                ? { ...list, items: list.items.map(i => i.itemID === item.itemID ? { ...i, checked: !i.checked } : i) }
                : list
        ))
        try {
            await toggleItem(item.itemID)
        } catch {
            setLists(prev => prev.map(list =>
                list.listID === selectedListID
                    ? { ...list, items: list.items.map(i => i.itemID === item.itemID ? { ...i, checked: item.checked } : i) }
                    : list
            ))
        }
    }

    const handleRemove = async (itemID: number) => {
        const previous = lists
        setLists(prev => prev.map(list =>
            list.listID === selectedListID
                ? { ...list, items: list.items.filter(i => i.itemID !== itemID) }
                : list
        ))
        try {
            await removeItem(itemID)
        } catch {
            setLists(previous)
        }
    }

    const handleAdd = async (newItem: Omit<ShoppingItem, 'itemID'>) => {
        const existing = currentList.items.find(i =>
            (newItem.ingredientID && i.ingredientID === newItem.ingredientID) ||
            i.name.toLowerCase() === newItem.name.toLowerCase()
        )

        if (existing) {
            const mergedQty = (existing.quantity ?? 0) + (newItem.quantity ?? 0) || undefined
            setLists(prev => prev.map(list =>
                list.listID === selectedListID
                    ? { ...list, items: list.items.map(i => i.itemID === existing.itemID ? { ...i, quantity: mergedQty } : i) }
                    : list
            ))
            try {
                await updateItem(existing.itemID, { quantity: mergedQty })
            } catch {
                setLists(prev => prev.map(list =>
                    list.listID === selectedListID
                        ? { ...list, items: list.items.map(i => i.itemID === existing.itemID ? existing : i) }
                        : list
                ))
            }
            return
        }

        const tempID = Date.now()
        const previous = lists
        setLists(prev => prev.map(list =>
            list.listID === selectedListID
                ? { ...list, items: [...list.items, { ...newItem, itemID: tempID }] }
                : list
        ))
        try {
            const created = await addItem(selectedListID, {
                name: newItem.name,
                quantity: newItem.quantity,
                listID: selectedListID,
                ingredientID: newItem.ingredientID,
                unitID: newItem.unitID,
            })
            setLists(prev => prev.map(list =>
                list.listID === selectedListID
                    ? { ...list, items: list.items.map(i => i.itemID === tempID ? created : i) }
                    : list
            ))
        } catch {
            setLists(previous)
        }
    }

    const handleClearChecked = async () => {
        const checkedItems = currentList.items.filter(i => i.checked)
        const previous = lists
        setLists(prev => prev.map(list =>
            list.listID === selectedListID
                ? { ...list, items: list.items.filter(i => !i.checked) }
                : list
        ))
        try {
            await Promise.all(checkedItems.map(i => removeItem(i.itemID)))
        } catch {
            setLists(previous)
        }
    }

    const handleImportDone = (updatedList: ShoppingList) => {
        setLists(prev => prev.map(l => l.listID === updatedList.listID ? updatedList : l))
    }

    const unchecked = currentList.items.filter(i => !i.checked)
    const checked = currentList.items.filter(i => i.checked)

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Courses</Text>
                {unchecked.length > 0 && (
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>
                            {unchecked.length} restant{unchecked.length > 1 ? 's' : ''}
                        </Text>
                    </View>
                )}
            </View>

            {/* Sélecteur de liste compact — seulement si plusieurs listes */}
            {lists.length > 1 && (
                <>
                    <TouchableOpacity
                        style={styles.listSelector}
                        onPress={() => setShowListPicker(true)}
                    >
                        <Text style={styles.listSelectorText}>{currentList.name}</Text>
                        <ChevronDown size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    <Modal
                        visible={showListPicker}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setShowListPicker(false)}
                    >
                        <TouchableOpacity
                            style={styles.listPickerOverlay}
                            activeOpacity={1}
                            onPress={() => setShowListPicker(false)}
                        >
                            <View style={styles.listPickerCard}>
                                <Text style={styles.listPickerTitle}>Choisir une liste</Text>
                                {lists.map(list => (
                                    <TouchableOpacity
                                        key={list.listID}
                                        style={[styles.listPickerItem, list.listID === selectedListID && styles.listPickerItemActive]}
                                        onPress={() => { setSelectedListID(list.listID); setShowListPicker(false) }}
                                    >
                                        <Text style={[styles.listPickerText, list.listID === selectedListID && styles.listPickerTextActive]}>
                                            {list.name}
                                        </Text>
                                        {list.listID === selectedListID && (
                                            <Check size={16} color={Colors.primaryLight} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableOpacity>
                    </Modal>
                </>
            )}

            {/* Importer une recette */}
            <TouchableOpacity style={styles.importBanner} onPress={() => setShowImportModal(true)}>
                <BookOpen size={18} color={Colors.primaryDarkButton} />
                <Text style={styles.importBannerText}>Importer une recette</Text>
                <View style={{ flex: 1 }} />
                <ChevronDown size={16} color={Colors.primaryDarkButton} style={{ transform: [{ rotate: '-90deg' }] }} />
            </TouchableOpacity>

            {/* Contenu + barre d'ajout — keyboard-aware */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
                >

                    {unchecked.length === 0 && checked.length === 0 && (
                        <Text style={styles.emptyList}>La liste est vide.</Text>
                    )}

                    {(() => {
                        const groups: Record<string, ShoppingItem[]> = {}
                        for (const item of unchecked) {
                            const cat = item.ingredient?.category || 'Autre'
                            if (!groups[cat]) groups[cat] = []
                            groups[cat].push(item)
                        }
                        const sorted = Object.keys(groups).sort((a, b) =>
                            a === 'Autre' ? 1 : b === 'Autre' ? -1 : a.localeCompare(b, 'fr')
                        )
                        return sorted.map(cat => (
                            <View key={cat}>
                                <Text style={styles.categoryLabel}>{cat.toUpperCase()}</Text>
                                {groups[cat].map(item => (
                                    <View key={item.itemID} style={styles.item}>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => handleToggle(item)} />
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        {item.quantity != null && (
                                            <View style={styles.qtyBadge}>
                                                <Text style={styles.qtyText}>
                                                    {item.quantity}{item.unit ? ` ${item.unit.type}` : ''}
                                                </Text>
                                            </View>
                                        )}
                                        <TouchableOpacity
                                            onPress={() => handleRemove(item.itemID)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Trash2 size={16} color={Colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        ))
                    })()}

                    {checked.length > 0 && (
                        <View style={styles.checkedSection}>
                            <View style={styles.checkedHeader}>
                                <TouchableOpacity
                                    style={styles.checkedHeaderLeft}
                                    onPress={() => setCheckedExpanded(v => !v)}
                                >
                                    <Text style={styles.checkedLabel}>Dans le panier ({checked.length})</Text>
                                    {checkedExpanded
                                        ? <ChevronUp size={16} color={Colors.textSecondary} />
                                        : <ChevronDown size={16} color={Colors.textSecondary} />
                                    }
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleClearChecked}>
                                    <Text style={styles.clearBtn}>Vider</Text>
                                </TouchableOpacity>
                            </View>

                            {checkedExpanded && checked.map(item => (
                                <View key={item.itemID} style={[styles.item, styles.itemChecked]}>
                                    <TouchableOpacity
                                        style={[styles.checkbox, styles.checkboxChecked]}
                                        onPress={() => handleToggle(item)}
                                    >
                                        <Check size={12} color={Colors.surface} />
                                    </TouchableOpacity>
                                    <Text style={[styles.itemName, styles.itemNameChecked]}>{item.name}</Text>
                                    {item.quantity != null && (
                                        <View style={[styles.qtyBadge, styles.qtyBadgeChecked]}>
                                            <Text style={styles.qtyText}>
                                                {item.quantity}{item.unit ? ` ${item.unit.type}` : ''}
                                            </Text>
                                        </View>
                                    )}
                                    <TouchableOpacity
                                        onPress={() => handleRemove(item.itemID)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Trash2 size={16} color={Colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>

                {/* Barre d'ajout */}
                <View style={styles.addBar}>
                    <AddShoppingItem listID={selectedListID} onAdd={handleAdd} />
                </View>
            </KeyboardAvoidingView>

            <ImportRecipeModal
                visible={showImportModal}
                listID={selectedListID}
                currentItems={currentList.items}
                groupRecipes={currentList.groupID ? groupRecipesMap[currentList.groupID] : undefined}
                onClose={() => setShowImportModal(false)}
                onImportDone={handleImportDone}
            />
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    title: {
        fontSize: 32,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    countBadge: {
        backgroundColor: Colors.cardLight,
        borderRadius: BorderRadius.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
    },
    countText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.primaryLight,
    },
    // Sélecteur de liste compact
    listSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: Spacing.xs,
        marginHorizontal: Spacing.xl,
        marginBottom: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    listSelectorText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textPrimary,
    },
    listPickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    listPickerCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    listPickerTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    listPickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    listPickerItemActive: {
        backgroundColor: '#FFF5F5',
    },
    listPickerText: {
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },
    listPickerTextActive: {
        color: Colors.primaryLight,
        fontWeight: FontWeight.semibold,
    },
    // Import banner
    importBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginHorizontal: Spacing.xl,
        marginBottom: Spacing.md,
        backgroundColor: '#FFF5E0',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.primaryButton,
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
    },
    importBannerText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.primaryDarkButton,
    },
    // Liste
    list: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.md,
    },
    emptyList: {
        textAlign: 'center',
        color: Colors.textSecondary,
        marginTop: Spacing.xl,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        marginBottom: Spacing.sm,
    },
    itemChecked: { opacity: 0.55 },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.border,
    },
    checkboxChecked: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemName: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.textPrimary,
    },
    itemNameChecked: {
        textDecorationLine: 'line-through',
        color: Colors.textSecondary,
        fontWeight: FontWeight.regular,
    },
    qtyBadge: {
        backgroundColor: Colors.cardLight,
        borderRadius: BorderRadius.full,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    qtyBadgeChecked: { backgroundColor: Colors.border },
    qtyText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.primaryMuted,
    },
    categoryLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        letterSpacing: 0.8,
        marginTop: Spacing.md,
        marginBottom: Spacing.xs,
    },
    checkedSection: { marginTop: Spacing.sm },
    checkedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    checkedHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    checkedLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    clearBtn: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.error,
    },
    addBar: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        backgroundColor: Colors.background,
    },
})
