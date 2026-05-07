import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { Star, Trash2, CornerDownRight } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/src/constants'
import UserAvatar from '@/src/components/ui/UserAvatar'
import {
    getRecipeComments, addRecipeComment, deleteRecipeComment,
    addRecipeReview, updateRecipeReview, deleteRecipeReview,
    type RecipeComment, type RecipeReview,
} from '@/src/services/recipes.service'

type Props = {
    recipeID: number
    currentUserID: string | null
    isOwner: boolean
    reviews: RecipeReview[]
    onReviewChange: (reviews: RecipeReview[]) => void
}

function StarRating({ value, onRate }: { value: number; onRate?: (n: number) => void }) {
    return (
        <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity
                    key={n}
                    onPress={() => onRate?.(n)}
                    disabled={!onRate}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                    <Star
                        size={26}
                        color={n <= value ? Colors.primary : Colors.border}
                        fill={n <= value ? Colors.primary : 'transparent'}
                    />
                </TouchableOpacity>
            ))}
        </View>
    )
}

function CommentItem({
    comment,
    currentUserID,
    onDelete,
    onReply,
}: {
    comment: RecipeComment
    currentUserID: string | null
    onDelete: (id: number) => void
    onReply: (id: number, pseudo: string) => void
}) {
    const isOwn = comment.user.userID === currentUserID
    const date = new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

    return (
        <View style={styles.commentBlock}>
            <View style={styles.commentRow}>
                <UserAvatar user={comment.user} size={32} />
                <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>@{comment.user.pseudo}</Text>
                        <Text style={styles.commentDate}>{date}</Text>
                    </View>
                    <Text style={styles.commentText}>{comment.content}</Text>
                    <View style={styles.commentActions}>
                        {currentUserID && (
                            <TouchableOpacity onPress={() => onReply(comment.commentID, comment.user.pseudo)} hitSlop={8}>
                                <Text style={styles.replyBtn}>Répondre</Text>
                            </TouchableOpacity>
                        )}
                        {isOwn && (
                            <TouchableOpacity onPress={() => onDelete(comment.commentID)} hitSlop={8}>
                                <Trash2 size={14} color={Colors.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {(comment.replies?.length ?? 0) > 0 && (
                <View style={styles.replies}>
                    {comment.replies.map(reply => (
                        <View key={reply.commentID} style={styles.replyRow}>
                            <CornerDownRight size={14} color={Colors.textSecondary} style={{ marginTop: 4 }} />
                            <View style={styles.replyBody}>
                                <View style={styles.commentHeader}>
                                    <Text style={styles.commentAuthor}>@{reply.user.pseudo}</Text>
                                    <Text style={styles.commentDate}>
                                        {new Date(reply.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                    </Text>
                                </View>
                                <Text style={styles.commentText}>{reply.content}</Text>
                                {reply.user.userID === currentUserID && (
                                    <TouchableOpacity onPress={() => onDelete(reply.commentID)} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
                                        <Trash2 size={14} color={Colors.error} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    )
}

export default function CommentSection({ recipeID, currentUserID, isOwner, reviews, onReviewChange }: Props) {
    const [comments, setComments] = useState<RecipeComment[]>([])
    const [loading, setLoading] = useState(true)
    const [text, setText] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [replyTo, setReplyTo] = useState<{ id: number; pseudo: string } | null>(null)
    const [ratingSubmitting, setRatingSubmitting] = useState(false)

    const myReview = reviews.find(r => r.user.userID === currentUserID)
    const avgRating = reviews.length > 0
        ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
        : null

    const load = useCallback(async () => {
        try {
            const data = await getRecipeComments(recipeID)
            setComments(data)
        } catch {}
        finally { setLoading(false) }
    }, [recipeID])

    useEffect(() => { load() }, [load])

    const handleRate = async (rating: number) => {
        if (!currentUserID || ratingSubmitting) return
        setRatingSubmitting(true)
        try {
            if (myReview) {
                if (myReview.rating === rating) {
                    await deleteRecipeReview(myReview.reviewID)
                    onReviewChange(reviews.filter(r => r.reviewID !== myReview.reviewID))
                } else {
                    await updateRecipeReview(myReview.reviewID, rating)
                    onReviewChange(reviews.map(r => r.reviewID === myReview.reviewID ? { ...r, rating } : r))
                }
            } else {
                const created = await addRecipeReview(recipeID, rating)
                onReviewChange([...reviews, created])
            }
        } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Impossible de noter la recette.')
        } finally {
            setRatingSubmitting(false)
        }
    }

    const handleSubmit = async () => {
        if (!text.trim() || submitting) return
        setSubmitting(true)
        try {
            const created = await addRecipeComment(recipeID, text.trim(), replyTo?.id)
            if (replyTo) {
                setComments(prev => prev.map(c =>
                    c.commentID === replyTo.id
                        ? { ...c, replies: [...c.replies, created] }
                        : c
                ))
            } else {
                setComments(prev => [created, ...prev])
            }
            setText('')
            setReplyTo(null)
        } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Impossible d\'envoyer le commentaire.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (commentID: number) => {
        try {
            await deleteRecipeComment(commentID)
            setComments(prev => prev
                .filter(c => c.commentID !== commentID)
                .map(c => ({ ...c, replies: c.replies.filter(r => r.commentID !== commentID) }))
            )
        } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Impossible de supprimer.')
        }
    }

    return (
        <View style={styles.container}>
            {/* Notes */}
            <View style={styles.ratingSection}>
                {avgRating !== null && (
                    <View style={styles.avgRow}>
                        <Text style={styles.avgNumber}>{avgRating}</Text>
                        <Star size={18} color={Colors.primary} fill={Colors.primary} />
                        <Text style={styles.avgCount}>({reviews.length} avis)</Text>
                    </View>
                )}
                {!isOwner && currentUserID && (
                    <View>
                        <Text style={styles.rateLabel}>
                            {myReview ? 'Votre note (retaper pour retirer)' : 'Notez cette recette'}
                        </Text>
                        <StarRating value={myReview?.rating ?? 0} onRate={ratingSubmitting ? undefined : handleRate} />
                    </View>
                )}
                {avgRating === null && (isOwner || !currentUserID) && (
                    <Text style={styles.noRating}>Aucune note pour l'instant.</Text>
                )}
            </View>

            {/* Input */}
            {currentUserID && (
                <View style={styles.inputSection}>
                    {replyTo && (
                        <View style={styles.replyBanner}>
                            <Text style={styles.replyBannerText}>↳ Réponse à @{replyTo.pseudo}</Text>
                            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={8}>
                                <Text style={styles.replyBannerCancel}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="Ajouter un commentaire..."
                            placeholderTextColor={Colors.textSecondary}
                            value={text}
                            onChangeText={setText}
                            multiline
                            maxLength={1000}
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, (!text.trim() || submitting) && styles.sendBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={!text.trim() || submitting}
                        >
                            <Text style={styles.sendBtnText}>{submitting ? '…' : 'Envoyer'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Comments */}
            {loading ? (
                <ActivityIndicator style={{ marginTop: Spacing.lg }} color={Colors.primaryLight} />
            ) : comments.length === 0 ? (
                <Text style={styles.empty}>Aucun commentaire. Soyez le premier !</Text>
            ) : (
                <View style={styles.commentsList}>
                    {comments.map(c => (
                        <CommentItem
                            key={c.commentID}
                            comment={c}
                            currentUserID={currentUserID}
                            onDelete={handleDelete}
                            onReply={(id, pseudo) => setReplyTo({ id, pseudo })}
                        />
                    ))}
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },

    ratingSection: {
        paddingVertical: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        gap: Spacing.sm,
    },
    avgRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    avgNumber: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    avgCount: { fontSize: FontSize.sm, color: Colors.textSecondary },
    rateLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
    stars: { flexDirection: 'row', gap: 4 },
    noRating: { fontSize: FontSize.sm, color: Colors.textSecondary },

    inputSection: { paddingVertical: Spacing.md, gap: Spacing.xs },
    replyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.cardLight,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
    },
    replyBannerText: { fontSize: FontSize.sm, color: Colors.primaryLight },
    replyBannerCancel: { fontSize: FontSize.sm, color: Colors.textSecondary },
    inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
    input: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        maxHeight: 100,
    },
    sendBtn: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { color: Colors.surface, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },

    empty: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl },
    commentsList: { gap: Spacing.md, paddingTop: Spacing.md },

    commentBlock: { gap: Spacing.sm },
    commentRow: { flexDirection: 'row', gap: Spacing.sm },
    commentBody: { flex: 1 },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
    commentAuthor: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
    commentDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
    commentText: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 20 },
    commentActions: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
    replyBtn: { fontSize: FontSize.xs, color: Colors.primaryLight, fontWeight: FontWeight.medium },

    replies: { marginLeft: 44, gap: Spacing.sm },
    replyRow: { flexDirection: 'row', gap: Spacing.xs },
    replyBody: { flex: 1 },
})
