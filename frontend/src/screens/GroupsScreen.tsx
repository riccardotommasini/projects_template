import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plus, Users } from 'lucide-react-native'
import { router, useFocusEffect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/src/constants'
import { Group } from '@/src/types/group'
import { getMyGroups } from '@/src/services/groups.service'
import GroupCard from '@/src/components/ui/Group/GroupCard'
import CreateGroupModal from '@/src/components/features/group/CreateGroupModal'

const HISTORY_KEY = 'group_open_history'

async function getHistory(): Promise<Record<string, number>> {
    try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch { return {} }
}

async function recordOpen(groupID: number): Promise<void> {
    try {
        const h = await getHistory()
        h[groupID] = Date.now()
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(h))
    } catch {}
}

function sortByHistory(groups: Group[], history: Record<string, number>): Group[] {
    return [...groups].sort((a, b) => {
        const ta = history[a.groupID] ?? 0
        const tb = history[b.groupID] ?? 0
        return tb - ta
    })
}

export default function GroupsScreen() {
    const [groups, setGroups] = useState<Group[]>([])
    const [history, setHistory] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [showCreate, setShowCreate] = useState(false)

    const load = useCallback(async () => {
        try {
            const [g, h] = await Promise.all([getMyGroups(), getHistory()])
            setHistory(h)
            setGroups(g)
        } catch {
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    const onRefresh = useCallback(() => { setRefreshing(true); load() }, [load])
    useEffect(() => { load() }, [load])

    const initialFocus = useRef(true)
    useFocusEffect(useCallback(() => {
        if (initialFocus.current) { initialFocus.current = false; return }
        getHistory().then(setHistory)
    }, []))

    const handleOpen = (groupID: number) => {
        recordOpen(groupID)
        setHistory(prev => ({ ...prev, [groupID]: Date.now() }))
        router.push({ pathname: '/group/[groupID]', params: { groupID: groupID.toString() } })
    }

    const handleCreated = (group: Group) => {
        const now = Date.now()
        setGroups(prev => [group, ...prev])
        setHistory(prev => ({ ...prev, [group.groupID]: now }))
        recordOpen(group.groupID)
        setShowCreate(false)
    }

    const sorted = sortByHistory(groups, history)

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mes groupes</Text>
                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => setShowCreate(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Plus size={22} color={Colors.surface} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator style={{ flex: 1 }} color={Colors.primaryLight} />
            ) : groups.length === 0 ? (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                        <Users size={40} color={Colors.primaryMuted} />
                    </View>
                    <Text style={styles.emptyTitle}>Aucun groupe</Text>
                    <Text style={styles.emptySub}>Crée un groupe pour partager des recettes avec tes amis</Text>
                    <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
                        <Plus size={16} color={Colors.surface} />
                        <Text style={styles.emptyBtnText}>Créer un groupe</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
                >
                    {sorted.map(group => (
                        <GroupCard
                            key={group.groupID}
                            name={group.name}
                            membersCount={group.members.length}
                            recipesCount={group.recipes.length}
                            onPress={() => handleOpen(group.groupID)}
                        />
                    ))}
                </ScrollView>
            )}

            <CreateGroupModal
                visible={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={handleCreated}
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
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    headerBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },

    list: {
        padding: Spacing.xl,
        gap: Spacing.sm,
    },

    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        gap: Spacing.sm,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.cardLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.sm,
    },
    emptyTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    emptySub: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.full,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm,
        marginTop: Spacing.md,
    },
    emptyBtnText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.surface,
    },
})
