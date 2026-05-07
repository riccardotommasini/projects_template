import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Search, UserPlus, UserCheck, X } from 'lucide-react-native'
import { router } from 'expo-router'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, ComponentSize } from '@/src/constants'
import { FriendUser, InvitationWithUser } from '@/src/types/friend'
import {
    getMyRelations,
    searchUsers,
    sendFriendRequest,
    removeFriendship,
    type MyRelations,
} from '@/src/services/friends.service'
import UserAvatar from '@/src/components/ui/UserAvatar'
import { normalize } from '@/src/utils/search'

export default function FriendsScreen() {
    const [relations, setRelations] = useState<MyRelations | null>(null)
    const [loading, setLoading] = useState(true)
    const [searchMode, setSearchMode] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<FriendUser[]>([])
    const [searching, setSearching] = useState(false)
    const [sentIDs, setSentIDs] = useState<Set<string>>(new Set())
    const [refreshing, setRefreshing] = useState(false)
    const [friendFilter, setFriendFilter] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const r = await getMyRelations()
            setRelations(r)
            setSentIDs(new Set(r.sentPending.map(f => f.receiverID)))
        } catch {
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    const onRefresh = useCallback(() => { setRefreshing(true); load() }, [load])

    useEffect(() => { load() }, [load])

    const handleSearch = async (text: string) => {
        setQuery(text)
        if (text.trim().length < 2) { setResults([]); return }
        setSearching(true)
        try {
            const found = await searchUsers(text.trim())
            const friendIDs = new Set(relations?.friends.map(f => f.userID) ?? [])
            const myID = relations?.myID ?? ''
            const q = normalize(text.trim())
            const filtered = found.filter(u => u.userID !== myID && !friendIDs.has(u.userID))
            filtered.sort((a, b) => {
                const aStarts = normalize(a.pseudo).startsWith(q) || normalize(a.firstName).startsWith(q)
                const bStarts = normalize(b.pseudo).startsWith(q) || normalize(b.firstName).startsWith(q)
                return aStarts === bStarts ? 0 : aStarts ? -1 : 1
            })
            setResults(filtered)
        } catch {
            setResults([])
        } finally {
            setSearching(false)
        }
    }

    const handleSendRequest = async (user: FriendUser) => {
        try {
            await sendFriendRequest(user.userID)
            setSentIDs(prev => new Set([...prev, user.userID]))
        } catch {
            Alert.alert('Erreur', "Impossible d'envoyer l'invitation.")
        }
    }

    const handleRemoveFriend = (friend: FriendUser) => {
        if (!relations) return
        Alert.alert('Supprimer ami', `Retirer ${friend.pseudo} de tes amis ?`, [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Supprimer', style: 'destructive',
                onPress: async () => {
                    try {
                        const myID = relations.myID
                        // Try both directions
                        await removeFriendship(myID, friend.userID).catch(() =>
                            removeFriendship(friend.userID, myID)
                        )
                        await load()
                    } catch {
                        Alert.alert('Erreur', 'Impossible de supprimer cet ami.')
                    }
                },
            },
        ])
    }

    const closeSearch = () => {
        setSearchMode(false)
        setQuery('')
        setResults([])
    }

    const friends = relations?.friends ?? []
    const filteredFriends = (() => {
        const q = normalize(friendFilter)
        if (!q) return friends
        return friends
            .filter(f => normalize(f.pseudo).includes(q) || normalize(f.firstName).includes(q) || normalize(f.lastName).includes(q))
            .sort((a, b) => {
                const aStarts = normalize(a.pseudo).startsWith(q) || normalize(a.firstName).startsWith(q)
                const bStarts = normalize(b.pseudo).startsWith(q) || normalize(b.firstName).startsWith(q)
                return aStarts === bStarts ? 0 : aStarts ? -1 : 1
            })
    })()

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <ArrowLeft size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {searchMode ? 'Ajouter un ami' : `Mes amis${friends.length > 0 ? ` (${friends.length})` : ''}`}
                </Text>
                {searchMode ? (
                    <TouchableOpacity onPress={closeSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => setSearchMode(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <UserPlus size={22} color={Colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {searchMode ? (
                <View style={{ flex: 1 }}>
                    <View style={styles.searchRow}>
                        <Search size={16} color={Colors.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Rechercher par pseudo ou nom..."
                            placeholderTextColor={Colors.textSecondary}
                            value={query}
                            onChangeText={handleSearch}
                            autoFocus
                            multiline={false}
                        />
                        {searching && <ActivityIndicator size="small" color={Colors.primaryLight} />}
                    </View>

                    <FlatList
                        data={results}
                        keyExtractor={u => u.userID}
                        contentContainerStyle={styles.list}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                            query.length >= 2 && !searching
                                ? <Text style={styles.empty}>Aucun utilisateur trouvé.</Text>
                                : query.length > 0
                                    ? null
                                    : <Text style={styles.empty}>Tape un pseudo ou un nom.</Text>
                        }
                        renderItem={({ item }) => {
                            const already = sentIDs.has(item.userID)
                            return (
                                <View style={styles.userCard}>
                                    <UserAvatar user={item} size={46} />
                                    <View style={styles.userInfo}>
                                        <Text style={styles.userPseudo}>@{item.pseudo}</Text>
                                        <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.inviteBtn, already && styles.inviteBtnSent]}
                                        onPress={() => !already && handleSendRequest(item)}
                                        disabled={already}
                                    >
                                        {already
                                            ? <UserCheck size={16} color={Colors.darkGreen} />
                                            : <UserPlus size={16} color={Colors.surface} />
                                        }
                                        <Text style={[styles.inviteBtnText, already && styles.inviteBtnTextSent]}>
                                            {already ? 'Invité' : 'Inviter'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )
                        }}
                    />
                </View>
            ) : (
                loading ? (
                    <ActivityIndicator style={{ flex: 1 }} color={Colors.primaryLight} />
                ) : (
                    <>
                    {friends.length > 0 && (
                        <View style={styles.searchRow}>
                            <Search size={16} color={Colors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Filtrer mes amis..."
                                placeholderTextColor={Colors.textSecondary}
                                value={friendFilter}
                                onChangeText={setFriendFilter}
                                multiline={false}
                            />
                            {friendFilter.length > 0 && (
                                <TouchableOpacity onPress={() => setFriendFilter('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <X size={16} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                    <FlatList
                        data={filteredFriends}
                        keyExtractor={f => f.userID}
                        contentContainerStyle={styles.list}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
                        ListEmptyComponent={
                            friendFilter.trim().length > 0 ? (
                                <Text style={styles.empty}>Aucun ami trouvé.</Text>
                            ) : (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyTitle}>Aucun ami pour l'instant</Text>
                                    <Text style={styles.emptySubtitle}>Appuie sur + pour en ajouter</Text>
                                </View>
                            )
                        }
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.userCard}
                                activeOpacity={0.75}
                                onPress={() => router.push({
                                    pathname: '/user/[userID]',
                                    params: {
                                        userID: item.userID,
                                        pseudo: item.pseudo,
                                        firstName: item.firstName,
                                        lastName: item.lastName,
                                        avatar: item.avatar ?? '',
                                    },
                                })}
                            >
                                <UserAvatar user={item} size={46} />
                                <View style={styles.userInfo}>
                                    <Text style={styles.userPseudo}>@{item.pseudo}</Text>
                                    <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleRemoveFriend(item)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <X size={18} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        )}
                    />
                    </>
                )
            )}
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
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
        color: Colors.textPrimary,
    },

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

    list: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },

    userCard: {
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

    userInfo: { flex: 1 },
    userPseudo: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
    userName: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

    inviteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    inviteBtnSent: {
        backgroundColor: Colors.ligthGreen,
    },
    inviteBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.surface },
    inviteBtnTextSent: { color: Colors.darkGreen },

    empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.xl },
    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
    emptySubtitle: { fontSize: FontSize.md, color: Colors.textSecondary },
})
