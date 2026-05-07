import { useState, useEffect } from 'react'
import { View, Text, Modal, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, UserPlus } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/src/constants'
import { FriendUser } from '@/src/types/friend'
import { getMyRelations } from '@/src/services/friends.service'
import { addMember } from '@/src/services/groups.service'
import UserAvatar from '@/src/components/ui/UserAvatar'

type Props = {
    visible: boolean
    groupID: number
    existingMemberIDs: Set<string>
    onClose: () => void
    onAdded: () => void
}

export default function AddMemberModal({ visible, groupID, existingMemberIDs, onClose, onAdded }: Props) {
    const [friends, setFriends] = useState<FriendUser[]>([])
    const [loading, setLoading] = useState(false)
    const [adding, setAdding] = useState<string | null>(null)

    useEffect(() => {
        if (!visible) return
        setLoading(true)
        getMyRelations()
            .then(r => setFriends(r.friends))
            .catch(() => setFriends([]))
            .finally(() => setLoading(false))
    }, [visible])

    const handleAdd = async (userID: string) => {
        setAdding(userID)
        try {
            await addMember(groupID, userID)
            onAdded()
        } catch {
            Alert.alert('Erreur', "Impossible d'ajouter ce membre.")
        } finally {
            setAdding(null)
        }
    }

    const available = friends.filter(f => !existingMemberIDs.has(f.userID))

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Inviter un ami</Text>
                    <View style={{ width: 22 }} />
                </View>

                {loading ? (
                    <ActivityIndicator style={{ flex: 1 }} color={Colors.primaryLight} />
                ) : (
                    <FlatList
                        data={available}
                        keyExtractor={f => f.userID}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Text style={styles.emptyText}>Tous tes amis sont déjà dans le groupe</Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.row}
                                onPress={() => handleAdd(item.userID)}
                                disabled={adding === item.userID}
                            >
                                <UserAvatar user={item} size={44} />
                                <View style={styles.rowInfo}>
                                    <Text style={styles.rowName}>@{item.pseudo}</Text>
                                    <Text style={styles.rowMeta}>{item.firstName} {item.lastName}</Text>
                                </View>
                                {adding === item.userID
                                    ? <ActivityIndicator size="small" color={Colors.primaryLight} />
                                    : <UserPlus size={20} color={Colors.primary} />
                                }
                            </TouchableOpacity>
                        )}
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
    list: { padding: Spacing.xl, gap: Spacing.sm },
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
