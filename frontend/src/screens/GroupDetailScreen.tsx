import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Plus, UserPlus, ChefHat, Users, Trash2, ShoppingCart } from 'lucide-react-native'
import { router } from 'expo-router'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/src/constants'
import { Group } from '@/src/types/group'
import { getGroup, removeRecipeFromGroup, leaveGroup } from '@/src/services/groups.service'
import { getMyRelations, sendFriendRequest } from '@/src/services/friends.service'
import { getTags } from '@/src/services/tags.service'
import TagChips from '@/src/components/ui/TagChips'
import type { Tag } from '@/src/types/recipe'
import { groupColor } from '@/src/utils/groupColor'
import { setPendingListID } from '@/src/utils/pendingListID'
import { useAuth } from '@/src/hooks/useAuth'
import UserAvatar from '@/src/components/ui/UserAvatar'
import GroupRecipeCard from '@/src/components/features/group/GroupRecipeCard'
import AddRecipeModal from '@/src/components/features/group/AddRecipeModal'
import AddMemberModal from '@/src/components/features/group/AddMemberModal'

type Tab = 'recipes' | 'members'

export default function GroupDetailScreen({ groupID }: { groupID: number }) {
    const { user: currentUser } = useAuth()
    const [group, setGroup] = useState<Group | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [tab, setTab] = useState<Tab>('recipes')
    const [showAddRecipe, setShowAddRecipe] = useState(false)
    const [showAddMember, setShowAddMember] = useState(false)
    const [selectedIDs, setSelectedIDs] = useState<Set<number>>(new Set())
    const [friendIDs, setFriendIDs] = useState<Set<string>>(new Set())
    const [sentIDs, setSentIDs] = useState<Set<string>>(new Set())
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [filterTagIDs, setFilterTagIDs] = useState<Set<number>>(new Set())

    const isSelecting = selectedIDs.size > 0
    const navigatingToList = useRef(false)

    const load = useCallback(async () => {
        try {
            const g = await getGroup(groupID)
            setGroup(g)
        } catch {
            Alert.alert('Erreur', 'Impossible de charger le groupe.')
            router.back()
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [groupID])

    const onRefresh = useCallback(() => { setRefreshing(true); load() }, [load])
    useEffect(() => { load() }, [load])
    useEffect(() => { getTags().then(setAllTags).catch(() => {}) }, [])
    useEffect(() => {
        getMyRelations().then(r => {
            setFriendIDs(new Set(r.friends.map(f => f.userID)))
            setSentIDs(new Set(r.sentPending.map(s => s.receiverID)))
        }).catch(() => {})
    }, [])

    const handleAddFriend = async (userID: string) => {
        setSentIDs(prev => new Set([...prev, userID]))
        try {
            await sendFriendRequest(userID)
        } catch {
            setSentIDs(prev => { const next = new Set(prev); next.delete(userID); return next })
        }
    }

    const handleLongPress = (recipeID: number) => {
        setSelectedIDs(prev => new Set([...prev, recipeID]))
    }

    const handleCardPress = (recipeID: number) => {
        if (isSelecting) {
            setSelectedIDs(prev => {
                const next = new Set(prev)
                next.has(recipeID) ? next.delete(recipeID) : next.add(recipeID)
                return next
            })
        } else {
            router.push({ pathname: '/recipe/[recipeID]', params: { recipeID: recipeID.toString() } })
        }
    }

    const handleDeleteSelected = async () => {
        if (!group || selectedIDs.size === 0) return
        const toDelete = [...selectedIDs]
        const previous = group
        setGroup({ ...group, recipes: group.recipes.filter(r => !selectedIDs.has(r.recipeID)) })
        setSelectedIDs(new Set())
        try {
            await Promise.all(toDelete.map(id => removeRecipeFromGroup(groupID, id)))
        } catch {
            setGroup(previous)
            setSelectedIDs(new Set(toDelete))
            Alert.alert('Erreur', 'Impossible de supprimer les recettes sélectionnées.')
        }
    }

    const handleRecipeAdded = () => { load(); setShowAddRecipe(false) }
    const handleMemberAdded = () => { load(); setShowAddMember(false) }

    const handleLeave = () => {
        Alert.alert(
            'Quitter le groupe',
            `Es-tu sûr de vouloir quitter "${group?.name}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Quitter', style: 'destructive',
                    onPress: async () => {
                        try {
                            await leaveGroup(groupID)
                            router.back()
                        } catch (e: any) {
                            Alert.alert('Erreur', e.message ?? 'Impossible de quitter le groupe.')
                        }
                    },
                },
            ]
        )
    }

    const allRecipes = group?.recipes ?? []
    const filteredGroupRecipes = filterTagIDs.size === 0
        ? allRecipes
        : allRecipes
            .map(gr => ({
                gr,
                matchCount: gr.recipe.tags?.filter(t => filterTagIDs.has(t.tag.tagID)).length ?? 0,
            }))
            .filter(x => x.matchCount > 0)
            .sort((a, b) => b.matchCount - a.matchCount)
            .map(x => x.gr)

    // AND group: toutes les recettes ayant TOUS les tags sélectionnés
    const andRecipes = filterTagIDs.size > 1
        ? filteredGroupRecipes.filter(gr =>
            (gr.recipe.tags?.filter(t => filterTagIDs.has(t.tag.tagID)).length ?? 0) === filterTagIDs.size)
        : filteredGroupRecipes
    // OR group: recettes ayant seulement une partie des tags (uniquement si plusieurs tags)
    const orRecipes = filterTagIDs.size > 1
        ? filteredGroupRecipes.filter(gr =>
            (gr.recipe.tags?.filter(t => filterTagIDs.has(t.tag.tagID)).length ?? 0) < filterTagIDs.size)
        : []

    if (loading || !group) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator style={{ flex: 1 }} color={Colors.primaryLight} />
            </SafeAreaView>
        )
    }

    const groupBg = groupColor(group.name)
    const groupInitial = group.name.trim()[0]?.toUpperCase() ?? '?'

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={isSelecting ? () => setSelectedIDs(new Set()) : () => router.back()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <ArrowLeft size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <View style={[styles.headerAvatar, { backgroundColor: groupBg }]}>
                        <Text style={styles.headerAvatarText}>{groupInitial}</Text>
                    </View>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {isSelecting ? `${selectedIDs.size} sélectionné${selectedIDs.size > 1 ? 's' : ''}` : group.name}
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        onPress={() => {
                            if (navigatingToList.current) return
                            navigatingToList.current = true
                            if (group.shoppingList) setPendingListID(group.shoppingList.listID)
                            router.navigate('/(tabs)/shopping-list')
                            setTimeout(() => { navigatingToList.current = false }, 800)
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <ShoppingCart size={22} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    {tab === 'recipes' ? (
                        <TouchableOpacity
                            onPress={() => setShowAddRecipe(true)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Plus size={22} color={Colors.primary} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => setShowAddMember(true)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <UserPlus size={22} color={Colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    style={[styles.tab, tab === 'recipes' && styles.tabActive]}
                    onPress={() => { setTab('recipes'); setSelectedIDs(new Set()) }}
                >
                    <ChefHat size={16} color={tab === 'recipes' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabText, tab === 'recipes' && styles.tabTextActive]}>
                        Recettes {group.recipes.length > 0 ? `(${group.recipes.length})` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, tab === 'members' && styles.tabActive]}
                    onPress={() => { setTab('members'); setSelectedIDs(new Set()) }}
                >
                    <Users size={16} color={tab === 'members' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabText, tab === 'members' && styles.tabTextActive]}>
                        Membres ({group.members.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Filtres tag (recettes uniquement, toujours visibles) */}
            {tab === 'recipes' && allTags.length > 0 && group.recipes.length > 0 && (
                <View style={styles.tagsBar}>
                    <TagChips
                        tags={allTags}
                        selectedIDs={filterTagIDs}
                        onToggle={(tagID) => setFilterTagIDs(prev => {
                            const next = new Set(prev)
                            next.has(tagID) ? next.delete(tagID) : next.add(tagID)
                            return next
                        })}
                    />
                </View>
            )}

            {/* Contenu */}
            {tab === 'recipes' ? (
                <ScrollView
                    style={styles.tabScroll}
                    contentContainerStyle={styles.tabContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
                >
                    {group.recipes.length === 0 ? (
                        <View style={styles.tabEmpty}>
                            <ChefHat size={36} color={Colors.primaryMuted} />
                            <Text style={styles.tabEmptyTitle}>Aucune recette partagée</Text>
                            <Text style={styles.tabEmptyText}>Appuie sur + pour partager une recette</Text>
                        </View>
                    ) : filteredGroupRecipes.length === 0 ? (
                        <View style={styles.tabEmpty}>
                            <Text style={styles.tabEmptyText}>Aucune recette ne correspond aux filtres.</Text>
                        </View>
                    ) : (
                        <>
                            {/* Recettes correspondant à TOUS les tags */}
                            {andRecipes.length > 0 && (
                                <View style={styles.recipesGrid}>
                                    {andRecipes.map(gr => (
                                        <GroupRecipeCard
                                            key={gr.recipeID}
                                            recipe={gr.recipe}
                                            isSelecting={isSelecting}
                                            selected={selectedIDs.has(gr.recipeID)}
                                            onPress={() => handleCardPress(gr.recipeID)}
                                            onLongPress={() => handleLongPress(gr.recipeID)}
                                        />
                                    ))}
                                </View>
                            )}
                            {/* Recettes correspondant à certains tags seulement */}
                            {orRecipes.length > 0 && (
                                <>
                                    {andRecipes.length > 0 && (
                                        <View style={styles.filterSeparator}>
                                            <View style={styles.filterSeparatorLine} />
                                            <Text style={styles.filterSeparatorText}>Tags partiels</Text>
                                            <View style={styles.filterSeparatorLine} />
                                        </View>
                                    )}
                                    <View style={styles.recipesGrid}>
                                        {orRecipes.map(gr => (
                                            <GroupRecipeCard
                                                key={gr.recipeID}
                                                recipe={gr.recipe}
                                                isSelecting={isSelecting}
                                                selected={selectedIDs.has(gr.recipeID)}
                                                onPress={() => handleCardPress(gr.recipeID)}
                                                onLongPress={() => handleLongPress(gr.recipeID)}
                                            />
                                        ))}
                                    </View>
                                </>
                            )}
                        </>
                    )}
                </ScrollView>
            ) : (
                <ScrollView
                    style={styles.tabScroll}
                    contentContainerStyle={styles.tabContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
                >
                    {group.members.map(m => {
                        const isSelf = m.userID === currentUser?.id
                        const isFriend = friendIDs.has(m.userID)
                        const isSent = sentIDs.has(m.userID)

                        const inner = (
                            <>
                                <UserAvatar user={m.user} size={46} />
                                <View style={styles.memberInfo}>
                                    <Text style={styles.memberPseudo}>@{m.user.pseudo}</Text>
                                    <Text style={styles.memberName}>{m.user.firstName} {m.user.lastName}</Text>
                                </View>
                                {isSelf && <Text style={styles.badgeSelf}>Moi</Text>}
                                {!isSelf && isSent && <Text style={styles.badgePending}>En attente</Text>}
                                {!isSelf && !isFriend && !isSent && (
                                    <TouchableOpacity
                                        onPress={() => handleAddFriend(m.userID)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <UserPlus size={20} color={Colors.primary} />
                                    </TouchableOpacity>
                                )}
                            </>
                        )

                        if (isFriend) {
                            return (
                                <TouchableOpacity
                                    key={m.userID}
                                    style={styles.memberRow}
                                    activeOpacity={0.7}
                                    onPress={() => router.push({
                                        pathname: '/user/[userID]',
                                        params: { userID: m.userID, pseudo: m.user.pseudo, firstName: m.user.firstName, lastName: m.user.lastName, avatar: m.user.avatar ?? '' },
                                    })}
                                >
                                    {inner}
                                </TouchableOpacity>
                            )
                        }
                        return <View key={m.userID} style={styles.memberRow}>{inner}</View>
                    })}
                    <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
                        <Text style={styles.leaveBtnText}>Quitter le groupe</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* Barre de suppression (mode sélection) */}
            {isSelecting && (
                <View style={styles.deleteBar}>
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteSelected}>
                        <Trash2 size={18} color={Colors.surface} />
                        <Text style={styles.deleteBtnText}>
                            Supprimer ({selectedIDs.size})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedIDs(new Set())}>
                        <Text style={styles.cancelBtnText}>Annuler</Text>
                    </TouchableOpacity>
                </View>
            )}

            <AddRecipeModal
                visible={showAddRecipe}
                groupID={groupID}
                existingRecipeIDs={new Set(group.recipes.map(r => r.recipeID))}
                onClose={() => setShowAddRecipe(false)}
                onAdded={handleRecipeAdded}
            />
            <AddMemberModal
                visible={showAddMember}
                groupID={groupID}
                existingMemberIDs={new Set(group.members.map(m => m.userID))}
                onClose={() => setShowAddMember(false)}
                onAdded={handleMemberAdded}
            />
        </SafeAreaView>
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
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginHorizontal: Spacing.md,
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAvatarText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        flex: 1,
    },

    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: Colors.primary },
    tabText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    tabTextActive: {
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },

    tagsBar: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tabScroll: {
        flex: 1,
    },
    tabContent: {
        padding: Spacing.xl,
        paddingBottom: 40,
    },

    recipesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },

    filterSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginVertical: Spacing.md,
    },
    filterSeparatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    filterSeparatorText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },

    tabEmpty: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: Spacing.sm,
    },
    tabEmptyTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    tabEmptyText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
    },

    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    memberInfo: { flex: 1, minWidth: 0 },
    memberPseudo: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.textPrimary,
    },
    memberName: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },

    badgeSelf: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.full,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
    },
    badgePending: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },

    leaveBtn: {
        alignItems: 'center',
        paddingVertical: Spacing.lg,
        marginTop: Spacing.xl,
    },
    leaveBtnText: {
        fontSize: FontSize.sm,
        color: Colors.error,
    },

    deleteBar: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        backgroundColor: Colors.background,
    },
    deleteBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.error,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
    },
    deleteBtnText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.surface,
    },
    cancelBtn: {
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
})
