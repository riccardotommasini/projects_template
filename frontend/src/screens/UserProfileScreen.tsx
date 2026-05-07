import { useState, useCallback, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, useWindowDimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TouchableOpacity } from 'react-native'
import { ArrowLeft } from 'lucide-react-native'
import { router } from 'expo-router'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/src/constants'
import type { Recipe, Tag } from '@/src/types/recipe'
import { getUserRecipes } from '@/src/services/users.service'
import { getTags } from '@/src/services/tags.service'
import TagChips from '@/src/components/ui/TagChips'
import UserAvatar from '@/src/components/ui/UserAvatar'
import RecipeCard from '@/src/components/ui/Recipe/RecipeCard'

type Props = {
    userID: string
    pseudo: string
    firstName: string
    lastName: string
    avatar: string | null
}

const H_PAD = Spacing.md
const COL_GAP = Spacing.sm

export default function UserProfileScreen({ userID, pseudo, firstName, lastName, avatar }: Props) {
    const { width } = useWindowDimensions()
    const cardWidth = (width - H_PAD * 2 - COL_GAP) / 2

    const PAGE_SIZE = 20
    const [recipes, setRecipes] = useState<Recipe[]>([])
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [filterTagIDs, setFilterTagIDs] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)

    const load = useCallback(async () => {
        try {
            const r = await getUserRecipes(userID, 1, PAGE_SIZE)
            setRecipes(r)
            setPage(1)
            setHasMore(r.length === PAGE_SIZE)
        } catch {
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [userID])

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return
        setLoadingMore(true)
        try {
            const nextPage = page + 1
            const more = await getUserRecipes(userID, nextPage, PAGE_SIZE)
            setRecipes(prev => [...prev, ...more])
            setPage(nextPage)
            setHasMore(more.length === PAGE_SIZE)
        } catch {}
        finally { setLoadingMore(false) }
    }, [loadingMore, hasMore, page, userID])

    useEffect(() => { load() }, [load])
    useEffect(() => { getTags().then(setAllTags).catch(() => {}) }, [])
    const onRefresh = useCallback(() => { setRefreshing(true); load() }, [load])

    const filtered = filterTagIDs.size === 0
        ? recipes
        : recipes.filter(r => r.tags?.some(t => filterTagIDs.has(t.tag.tagID)))

    const pairs = filtered.reduce<Recipe[][]>((acc, r, i) => {
        if (i % 2 === 0) acc.push([r])
        else acc[acc.length - 1].push(r)
        return acc
    }, [])

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <ArrowLeft size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>@{pseudo}</Text>
                <View style={{ width: 22 }} />
            </View>

            {allTags.length > 0 && (
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

            <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
                onMomentumScrollEnd={({ nativeEvent }) => {
                    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
                    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 300) {
                        loadMore()
                    }
                }}
                scrollEventThrottle={16}
            >
                {/* Profil */}
                <View style={styles.profile}>
                    <UserAvatar user={{ pseudo, avatar }} size={72} />
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{firstName} {lastName}</Text>
                        <Text style={styles.profilePseudo}>@{pseudo}</Text>
                        {!loading && (
                            <Text style={styles.profileMeta}>
                                {recipes.length} recette{recipes.length !== 1 ? 's' : ''}
                            </Text>
                        )}
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primaryLight} />
                ) : recipes.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>Aucune recette publiée</Text>
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {pairs.map((pair, i) => (
                            <View key={i} style={styles.row}>
                                {pair.map(r => (
                                    <RecipeCard key={r.recipeID} recipe={r} cardWidth={cardWidth} />
                                ))}
                                {pair.length < 2 && <View style={{ width: cardWidth }} />}
                            </View>
                        ))}
                    </View>
                )}
                {loadingMore && (
                    <ActivityIndicator style={{ marginVertical: 16 }} color={Colors.primaryLight} />
                )}
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    tagsBar: {
        flexShrink: 0,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    scroll: { flex: 1 },

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

    profile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    profileInfo: { flex: 1 },
    profileName: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    profilePseudo: {
        fontSize: FontSize.md,
        color: Colors.primaryLight,
        marginTop: 2,
    },
    profileMeta: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 4,
    },

    grid: {
        paddingHorizontal: H_PAD,
        paddingTop: Spacing.md,
        paddingBottom: 40,
    },
    row: {
        flexDirection: 'row',
        gap: COL_GAP,
    },

    empty: {
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
})
