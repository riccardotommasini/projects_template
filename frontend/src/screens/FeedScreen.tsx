import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, useWindowDimensions, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Users } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing } from '@/src/constants'
import { FeedRecipe, getFeed, getRecommendations } from '@/src/services/recipes.service'
import { getTags } from '@/src/services/tags.service'
import RecipeCard from '@/src/components/ui/Recipe/RecipeCard'
import SearchBar from '@/src/components/ui/SearchBar'
import TagChips from '@/src/components/ui/TagChips'
import { sortByMatch } from '@/src/utils/search'
import type { Tag } from '@/src/types/recipe'

const H_PAD = Spacing.md
const COL_GAP = Spacing.sm

type FeedItem =
    | { type: 'header'; title: string }
    | { type: 'pair'; items: FeedRecipe[] }
    | { type: 'recipe'; recipe: FeedRecipe }
    | { type: 'empty'; message: string }

const toPairs = (recipes: FeedRecipe[]): FeedItem[] =>
    Array.from({ length: Math.ceil(recipes.length / 2) }, (_, i) => ({
        type: 'pair' as const,
        items: recipes.slice(i * 2, i * 2 + 2),
    }))

const buildItems = (recent: FeedRecipe[], random: FeedRecipe[], recs: FeedRecipe[], search: string): FeedItem[] => {
    if (recent.length === 0 && random.length === 0 && recs.length === 0) {
        return [{ type: 'empty', message: 'Ajoute des amis pour voir leurs recettes ici.' }]
    }

    if (search.trim()) {
        const all = [...recent, ...recs, ...random]
        const deduped = all.filter((r, i) => all.findIndex(x => x.recipeID === r.recipeID) === i)
        const filtered = sortByMatch(deduped, search, r => r.name)
        if (filtered.length === 0) return [{ type: 'empty', message: 'Aucune recette ne correspond.' }]
        return toPairs(filtered)
    }

    const built: FeedItem[] = []
    if (recent.length > 0) {
        built.push({ type: 'header', title: 'Nouvelles recettes' })
        built.push(...toPairs(recent))
    }
    if (recs.length > 0) {
        built.push({ type: 'header', title: 'Pour vous' })
        built.push(...toPairs(recs))
    } else if (random.length > 0) {
        built.push({ type: 'header', title: 'Découvrir' })
        built.push(...toPairs(random))
    }
    return built
}

export default function FeedScreen() {
    const { width } = useWindowDimensions()
    const cardWidth = (width - H_PAD * 2 - COL_GAP) / 2

    const [recent, setRecent] = useState<FeedRecipe[]>([])
    const [random, setRandom] = useState<FeedRecipe[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [hasData, setHasData] = useState(false)
    const [recs, setRecs] = useState<FeedRecipe[]>([])
    // titleSearchHeight: just the animated header (title + search bar)
    const [titleSearchHeight, setTitleSearchHeight] = useState(0)
    // tagsBarHeight: the always-visible tags strip
    const [tagsBarHeight, setTagsBarHeight] = useState(0)
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [filterTagIDs, setFilterTagIDs] = useState<Set<number>>(new Set())

    const translateY = useRef(new Animated.Value(0)).current
    const lastScrollY = useRef(0)
    const headerVisible = useRef(true)

    const showHeader = useCallback(() => {
        if (headerVisible.current) return
        headerVisible.current = true
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }).start()
    }, [translateY])

    const hideHeader = useCallback(() => {
        if (!headerVisible.current) return
        headerVisible.current = false
        // Only slide up the title+search portion; tags bar follows to top
        Animated.timing(translateY, { toValue: -titleSearchHeight, duration: 200, useNativeDriver: true }).start()
    }, [translateY, titleSearchHeight])

    const handleScroll = useCallback((e: any) => {
        const y = e.nativeEvent.contentOffset.y
        const dy = y - lastScrollY.current
        lastScrollY.current = y
        if (dy > 5 && y > titleSearchHeight + tagsBarHeight) hideHeader()
        else if (dy < -5) showHeader()
    }, [titleSearchHeight, tagsBarHeight, hideHeader, showHeader])

    const load = useCallback(async () => {
        try {
            const data = await getFeed()
            const recRes = await getRecommendations().catch(() => ({ recommendations: [] }))
            setRecent(data.recent)
            setRandom(data.random)
            setRecs(recRes.recommendations || [])
            setHasData(true)
        } catch {
            setHasData(false)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => { load() }, [load])
    useEffect(() => { getTags().then(setAllTags).catch(() => {}) }, [])
    const onRefresh = useCallback(() => {
        showHeader()
        setRefreshing(true)
        load()
    }, [load, showHeader])

    const applyTagFilter = (list: FeedRecipe[]) =>
        filterTagIDs.size === 0 ? list : list.filter(r => r.tags?.some(t => filterTagIDs.has(t.tag.tagID)))

    const items: FeedItem[] = hasData
        ? buildItems(applyTagFilter(recent), applyTagFilter(random), applyTagFilter(recs), search)
        : [{ type: 'empty', message: 'Impossible de charger le fil.' }]

    const totalHeaderHeight = titleSearchHeight + tagsBarHeight

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.inner}>
                {/* Title + search: slides up/down on scroll */}
                <Animated.View
                    style={[styles.titleSearch, { transform: [{ translateY }] }]}
                    onLayout={e => setTitleSearchHeight(e.nativeEvent.layout.height)}
                >
                    <Text style={styles.title}>Fil</Text>
                    <SearchBar
                        placeholder="Rechercher une recette..."
                        value={search}
                        onChangeText={t => { showHeader(); setSearch(t) }}
                    />
                </Animated.View>

                {/* Tags bar: sits below title+search, slides up with it, always on screen */}
                {allTags.length > 0 && (
                    <Animated.View
                        style={[styles.tagsBar, { top: titleSearchHeight, transform: [{ translateY }] }]}
                        onLayout={e => setTagsBarHeight(e.nativeEvent.layout.height)}
                    >
                        <TagChips
                            tags={allTags}
                            selectedIDs={filterTagIDs}
                            onToggle={(tagID) => {
                                showHeader()
                                setFilterTagIDs(prev => {
                                    const next = new Set(prev)
                                    next.has(tagID) ? next.delete(tagID) : next.add(tagID)
                                    return next
                                })
                            }}
                        />
                    </Animated.View>
                )}

            {loading ? (
                <ActivityIndicator style={{ flex: 1 }} color={Colors.primaryLight} />
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item, i) =>
                        item.type === 'pair' ? `pair-${item.items[0].recipeID}` : item.type === 'recipe' ? `recipe-${item.recipe.recipeID}` : `${item.type}-${i}`
                    }
                    contentContainerStyle={[styles.list, { paddingTop: totalHeaderHeight + Spacing.md }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    scrollEventThrottle={16}
                    onScroll={handleScroll}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />
                    }
                    renderItem={({ item }) => {
                        if (item.type === 'header') {
                            return <Text style={styles.sectionHeader}>{item.title}</Text>
                        }
                        if (item.type === 'empty') {
                            return (
                                <View style={styles.emptyState}>
                                    <View style={styles.emptyIcon}>
                                        <Users size={36} color={Colors.primaryMuted} />
                                    </View>
                                    <Text style={styles.emptyTitle}>Rien à voir pour l&apos;instant</Text>
                                    <Text style={styles.emptyText}>{item.message}</Text>
                                </View>
                            )
                        }
                        if (item.type === 'recipe') {
                            return (
                                <RecipeCard
                                    recipe={item.recipe}
                                    cardWidth={cardWidth}
                                    creator={item.recipe.creator}
                                />
                            )
                        }
                        return (
                            <View style={styles.pair}>
                                {item.items.map(r => (
                                    <RecipeCard
                                        key={r.recipeID}
                                        recipe={r}
                                        cardWidth={cardWidth}
                                        creator={r.creator}
                                    />
                                ))}
                                {item.items.length < 2 && <View style={{ width: cardWidth }} />}
                            </View>
                        )
                    }}
                />
            )}
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    inner: { flex: 1 },

    titleSearch: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.sm,
        backgroundColor: Colors.background,
        gap: Spacing.sm,
    },
    title: {
        fontSize: 32,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },

    tagsBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 9,
        backgroundColor: Colors.background,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },

    list: {
        paddingHorizontal: H_PAD,
        paddingBottom: 32,
    },

    sectionHeader: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: Spacing.md,
        marginBottom: Spacing.xs,
    },

    pair: {
        flexDirection: 'row',
        gap: COL_GAP,
    },

    emptyState: {
        alignItems: 'center',
        paddingTop: 80,
        gap: Spacing.sm,
    },
    emptyIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
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
    emptyText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        maxWidth: 260,
        lineHeight: 22,
    },
})
