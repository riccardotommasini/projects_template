import { useState, useEffect } from 'react'
import { View, Text, Modal, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Check } from 'lucide-react-native'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, ComponentSize } from '@/src/constants'
import { Group } from '@/src/types/group'
import { FriendUser } from '@/src/types/friend'
import { getMyRelations } from '@/src/services/friends.service'
import { createGroup } from '@/src/services/groups.service'
import UserAvatar from '@/src/components/ui/UserAvatar'

type Props = {
    visible: boolean
    onClose: () => void
    onCreated: (group: Group) => void
}

export default function CreateGroupModal({ visible, onClose, onCreated }: Props) {
    const [name, setName] = useState('')
    const [friends, setFriends] = useState<FriendUser[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loadingFriends, setLoadingFriends] = useState(false)
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        if (!visible) return
        setName('')
        setSelected(new Set())
        setLoadingFriends(true)
        getMyRelations()
            .then(r => setFriends(r.friends))
            .catch(() => setFriends([]))
            .finally(() => setLoadingFriends(false))
    }, [visible])

    const toggle = (userID: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(userID) ? next.delete(userID) : next.add(userID)
            return next
        })
    }

    const handleCreate = async () => {
        if (!name.trim()) { Alert.alert('Erreur', 'Le nom du groupe est obligatoire.'); return }
        setCreating(true)
        try {
            const group = await createGroup(name.trim(), [...selected])
            onCreated(group)
        } catch {
            Alert.alert('Erreur', 'Impossible de créer le groupe.')
        } finally {
            setCreating(false)
        }
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Nouveau groupe</Text>
                    <View style={{ width: 22 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <Text style={styles.fieldLabel}>Nom du groupe</Text>
                    <TextInput
                        style={styles.nameInput}
                        placeholder="Ex: Famille, Coloc, Amis..."
                        placeholderTextColor={Colors.textSecondary}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        maxLength={40}
                        multiline={false}
                    />

                    <Text style={styles.fieldLabel}>
                        Ajouter des amis
                        {selected.size > 0 && (
                            <Text style={styles.selectedCount}> · {selected.size} sélectionné{selected.size > 1 ? 's' : ''}</Text>
                        )}
                    </Text>

                    {loadingFriends ? (
                        <ActivityIndicator color={Colors.primaryLight} style={{ marginTop: Spacing.md }} />
                    ) : friends.length === 0 ? (
                        <View style={styles.noFriends}>
                            <Text style={styles.noFriendsText}>Tu n'as pas encore d'amis ajoutés.</Text>
                            <Text style={styles.noFriendsText}>Ajoute des amis depuis ton profil.</Text>
                        </View>
                    ) : (
                        friends.map(friend => {
                            const isSelected = selected.has(friend.userID)
                            return (
                                <TouchableOpacity
                                    key={friend.userID}
                                    style={[styles.friendRow, isSelected && styles.friendRowSelected]}
                                    onPress={() => toggle(friend.userID)}
                                    activeOpacity={0.7}
                                >
                                    <UserAvatar user={friend} size={44} />
                                    <View style={styles.friendInfo}>
                                        <Text style={styles.friendPseudo}>@{friend.pseudo}</Text>
                                        <Text style={styles.friendName}>{friend.firstName} {friend.lastName}</Text>
                                    </View>
                                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                        {isSelected && <Check size={14} color={Colors.surface} />}
                                    </View>
                                </TouchableOpacity>
                            )
                        })
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.createBtn, creating && styles.createBtnDisabled]}
                        onPress={handleCreate}
                        disabled={creating}
                    >
                        {creating
                            ? <ActivityIndicator color={Colors.surface} />
                            : <Text style={styles.createBtnText}>Créer le groupe</Text>
                        }
                    </TouchableOpacity>
                </View>
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
    scroll: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
        paddingBottom: 120,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    fieldLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Spacing.sm,
        marginTop: Spacing.lg,
    },
    selectedCount: {
        color: Colors.primaryLight,
        textTransform: 'none',
        letterSpacing: 0,
    },
    nameInput: {
        height: ComponentSize.inputHeight,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },
    noFriends: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.lg,
        alignItems: 'center',
        gap: 4,
    },
    noFriendsText: { fontSize: FontSize.sm, color: Colors.textSecondary },
    friendRow: {
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
    friendRowSelected: {
        borderColor: Colors.primaryLight,
        backgroundColor: '#FFF5F5',
    },
    friendInfo: { flex: 1 },
    friendPseudo: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
    friendName: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
    checkbox: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primaryLight,
    },
    createBtn: {
        height: ComponentSize.buttonHeight,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    createBtnDisabled: { opacity: 0.6 },
    createBtnText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.surface,
    },
})
