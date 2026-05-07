import { useEffect, useState, useCallback, useRef } from "react";
import { Text, StyleSheet, ScrollView, TouchableOpacity, View, RefreshControl, Alert, StatusBar, ActivityIndicator } from "react-native";
import SearchBar from "../components/ui/SearchBar";
import RecipeCard from "../components/ui/Recipe/RecipeCard";
import { Colors } from "../constants/colors";
import { FontSize, FontWeight } from "../constants/typography";
import { Spacing, BorderRadius } from "../constants/spacing";
import { Settings, Trash2 } from "lucide-react-native";
import type { Recipe } from "../types/recipe";
import Grid from "../components/ui/Recipe/RecipeGrid";
import { SafeAreaView } from "react-native-safe-area-context";
import ProfileDescription from "../components/ui/Profile/ProfileDescription";
import { router, useFocusEffect } from "expo-router";
import { getSignedAvatarUrl } from "../services/storage.service";
import { getMe, getMySavedRecipes, type User, type SavedRecipeItem } from "../services/users.service";
import { getMyRecipes, deleteRecipe } from "../services/recipes.service";
import { getMyRelations } from "../services/friends.service";
import { getTags } from "../services/tags.service";
import TagChips from "../components/ui/TagChips";
import type { Tag } from "../types/recipe";
import { sortByMatch } from "../utils/search";

export default function ProfileScreen() {
    const [search, setSearch] = useState("");
    const [user, setUser] = useState<User | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [savedRecipes, setSavedRecipes] = useState<SavedRecipeItem[]>([]);
    const [friendsCount, setFriendsCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedIDs, setSelectedIDs] = useState<Set<number>>(new Set());
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [filterTagIDs, setFilterTagIDs] = useState<Set<number>>(new Set())
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const isSelecting = selectedIDs.size > 0;
    const PAGE_SIZE = 20;

    const loadProfile = useCallback(async () => {
        try {
            const [me, myRecipes, saved, relations] = await Promise.all([
                getMe(),
                getMyRecipes(1, PAGE_SIZE),
                getMySavedRecipes(),
                getMyRelations().catch(() => ({ friends: [], invitations: [], sentPending: [], myID: '' })),
            ]);

            setUser(me);
            setFriendsCount(relations.friends.length);
            setPendingCount(relations.invitations.length);
            setRecipes(myRecipes);
            setSavedRecipes(saved);
            setPage(1);
            setHasMore(myRecipes.length === PAGE_SIZE);

            if (me.avatar) {
                getSignedAvatarUrl(me.avatar).then(setAvatarUrl).catch(() => {});
            }
        } catch (error) {
            console.error("Erreur chargement profil :", error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const more = await getMyRecipes(nextPage, PAGE_SIZE);
            setRecipes(prev => [...prev, ...more]);
            setPage(nextPage);
            setHasMore(more.length === PAGE_SIZE);
        } catch {}
        finally { setLoadingMore(false); }
    }, [loadingMore, hasMore, page]);

    const initialLoad = useRef(true);
    useFocusEffect(useCallback(() => {
        if (initialLoad.current) { initialLoad.current = false; return; }
        loadProfile();
    }, [loadProfile]));

    useEffect(() => { loadProfile() }, [loadProfile]);
    useEffect(() => { getTags().then(setAllTags).catch(() => {}) }, [])
    const onRefresh = useCallback(() => { setRefreshing(true); loadProfile(); }, [loadProfile]);

    const tagFiltered = filterTagIDs.size === 0
        ? recipes
        : recipes.filter(r => r.tags?.some(t => filterTagIDs.has(t.tag.tagID)))
    const filteredRecipes = sortByMatch(tagFiltered, search, r => r.name);
    const filteredSaved = sortByMatch(savedRecipes, search, s => s.recipe.name);

    const handleLongPress = (recipeID: number) => {
        setSelectedIDs(prev => new Set([...prev, recipeID]));
    };

    const handleCardPress = (recipeID: number) => {
        if (isSelecting) {
            setSelectedIDs(prev => {
                const next = new Set(prev);
                next.has(recipeID) ? next.delete(recipeID) : next.add(recipeID);
                return next;
            });
        } else {
            router.push({ pathname: '/recipe/[recipeID]', params: { recipeID: recipeID.toString() } });
        }
    };

    const handleDeleteSelected = async () => {
        const toDelete = [...selectedIDs];
        const previous = recipes;
        setRecipes(prev => prev.filter(r => !selectedIDs.has(r.recipeID)));
        setSelectedIDs(new Set());
        try {
            await Promise.all(toDelete.map(id => deleteRecipe(id)));
        } catch {
            setRecipes(previous);
            setSelectedIDs(new Set(toDelete));
            Alert.alert('Erreur', 'Impossible de supprimer les recettes sélectionnées.');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <View style={styles.headerBar}>
                <TouchableOpacity
                    onPress={isSelecting ? () => setSelectedIDs(new Set()) : () => router.push("/settings")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    {isSelecting
                        ? <Text style={styles.cancelText}>Annuler</Text>
                        : <Settings size={26} color={Colors.textPrimary} />
                    }
                </TouchableOpacity>
            </View>

            {/*
             * stickyHeaderIndices={[1]} : l'enfant à l'index 1 du ScrollView
             * (la section "Mes recettes") colle en haut quand on défile.
             * L'index 0 (ProfileDescription) défile normalement.
             */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                stickyHeaderIndices={[1]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
                onMomentumScrollEnd={({ nativeEvent }) => {
                    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 300) {
                        loadMore();
                    }
                }}
                scrollEventThrottle={16}
            >
                {/* Index 0 — défile et disparaît */}
                <View>
                    <ProfileDescription
                        avatarUrl={avatarUrl ?? "https://api.dicebear.com/7.x/adventurer/png?seed=default"}
                        username={user?.pseudo ?? "Chargement..."}
                        bio={user ? `${user.firstName} ${user.lastName}` : ""}
                        recipesCount={recipes.length}
                        friendsCount={friendsCount}
                        pendingCount={pendingCount}
                        onPressFriends={() => router.push("/friends")}
                        onPressInvitations={() => router.push("/invitations")}
                    />
                </View>

                {/* Index 1 — sticky : titre + recherche + filtres */}
                <View style={styles.stickySection}>
                    <Text style={styles.sectionTitle}>Mes recettes</Text>
                    <SearchBar
                        placeholder="Rechercher une recette..."
                        value={search}
                        onChangeText={setSearch}
                    />
                    {allTags.length > 0 && (
                        <TagChips
                            tags={allTags}
                            selectedIDs={filterTagIDs}
                            onToggle={(tagID) => setFilterTagIDs(prev => {
                                const next = new Set(prev)
                                next.has(tagID) ? next.delete(tagID) : next.add(tagID)
                                return next
                            })}
                        />
                    )}
                </View>

                {/* Index 2 — grille + recettes sauvegardées */}
                <View>
                    <Grid>
                        {(cardWidth) =>
                            filteredRecipes.map((recipe) => (
                                <RecipeCard
                                    key={recipe.recipeID}
                                    recipe={recipe}
                                    cardWidth={cardWidth}
                                    isSelecting={isSelecting}
                                    selected={selectedIDs.has(recipe.recipeID)}
                                    onPress={() => handleCardPress(recipe.recipeID)}
                                    onLongPress={() => handleLongPress(recipe.recipeID)}
                                />
                            ))
                        }
                    </Grid>

                    {filteredSaved.length > 0 && (
                        <>
                            <View style={styles.divider} />
                            <Text style={styles.savedTitle}>Recettes sauvegardées</Text>
                            <Grid>
                                {(cardWidth) =>
                                    filteredSaved.map((s) => (
                                        <RecipeCard
                                            key={s.recipeID}
                                            recipe={s.recipe}
                                            cardWidth={cardWidth}
                                            creator={s.recipe.creator}
                                        />
                                    ))
                                }
                            </Grid>
                        </>
                    )}

                    {loadingMore && (
                        <ActivityIndicator style={{ marginVertical: 16 }} color={Colors.primaryLight} />
                    )}
                </View>
            </ScrollView>

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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 8,
    },
    cancelText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.primary,
    },

    stickySection: {
        backgroundColor: Colors.background,
        paddingBottom: Spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    sectionTitle: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        paddingHorizontal: 24,
        paddingTop: Spacing.md,
        marginBottom: 14,
    },
    savedTitle: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        paddingHorizontal: 24,
        marginBottom: 14,
    },

    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginHorizontal: 24,
        marginTop: Spacing.lg,
        marginBottom: 20,
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
});
