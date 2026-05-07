import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Camera } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { router } from 'expo-router'
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, ComponentSize } from '@/src/constants'
import { getMe, updateMe, updateMyAvatar, type User } from '@/src/services/users.service'
import { getSignedAvatarUrl } from '@/src/services/storage.service'
import { uploadAvatar } from '@/src/services/storage.service'
import { supabase } from '@/src/config/supabase'
import { signOut } from '@/src/services/auth.service'

export default function SettingsScreen() {
    const [user, setUser] = useState<User | null>(null)
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [pseudo, setPseudo] = useState('')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const initial = useRef({ firstName: '', lastName: '', pseudo: '' })

    const isDirty =
        firstName.trim() !== initial.current.firstName ||
        lastName.trim() !== initial.current.lastName ||
        pseudo.trim() !== initial.current.pseudo

    useEffect(() => {
        getMe().then(async (me) => {
            setUser(me)
            setFirstName(me.firstName)
            setLastName(me.lastName)
            setPseudo(me.pseudo)
            initial.current = { firstName: me.firstName, lastName: me.lastName, pseudo: me.pseudo }
            if (me.avatar) {
                const url = await getSignedAvatarUrl(me.avatar).catch(() => null)
                setAvatarUrl(url)
            }
        }).catch(() => {}).finally(() => setLoading(false))
    }, [])

    const handlePickAvatar = () => {
        Alert.alert('Photo de profil', undefined, [
            {
                text: 'Prendre une photo',
                onPress: () => pickAvatar(true),
            },
            {
                text: 'Choisir depuis la galerie',
                onPress: () => pickAvatar(false),
            },
            { text: 'Annuler', style: 'cancel' },
        ])
    }

    const pickAvatar = async (fromCamera: boolean) => {
        const result = fromCamera
            ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 })

        if (result.canceled) return
        const uri = result.assets[0].uri
        const fileName = uri.split('/').pop() ?? `avatar-${Date.now()}.jpg`
        const stableUri = `${FileSystem.documentDirectory}${fileName}`
        await FileSystem.copyAsync({ from: uri, to: stableUri })

        const { data } = await supabase.auth.getSession()
        const userID = data.session?.user.id
        if (!userID) return

        try {
            const path = await uploadAvatar(stableUri, userID)
            await updateMyAvatar(path)
            const url = await getSignedAvatarUrl(path)
            setAvatarUrl(url)
        } catch {
            Alert.alert('Erreur', "Impossible de mettre à jour la photo.")
        }
    }

    const handleSave = async () => {
        if (!firstName.trim() || !pseudo.trim()) {
            Alert.alert('Erreur', 'Le prénom et le pseudo sont obligatoires.')
            return
        }
        setSaving(true)
        try {
            const trimmed = { firstName: firstName.trim(), lastName: lastName.trim(), pseudo: pseudo.trim() }
            await updateMe(trimmed)
            initial.current = trimmed
            Alert.alert('Succès', 'Profil mis à jour.')
        } catch {
            Alert.alert('Erreur', 'Impossible de mettre à jour le profil.')
        } finally {
            setSaving(false)
        }
    }

    const handleSignOut = async () => {
        Alert.alert('Déconnexion', 'Es-tu sûr de vouloir te déconnecter ?', [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Déconnexion',
                style: 'destructive',
                onPress: async () => {
                    await signOut().catch(() => {})
                    router.replace('/welcome')
                },
            },
        ])
    }

    const handleDeleteAccount = () => {
        Alert.alert(
            'Supprimer le compte',
            'Cette action est irréversible. Toutes tes données seront supprimées.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { deleteMe } = await import('@/src/services/users.service')
                            await deleteMe()
                            await signOut().catch(() => {})
                            router.replace('/welcome')
                        } catch {
                            Alert.alert('Erreur', 'Impossible de supprimer le compte.')
                        }
                    },
                },
            ]
        )
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator style={{ flex: 1 }} color={Colors.primaryLight} />
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <ArrowLeft size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Paramètres</Text>
                <View style={{ width: 22 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Avatar */}
                <TouchableOpacity style={styles.avatarBlock} onPress={handlePickAvatar} activeOpacity={0.8}>
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitial}>
                                {(user?.firstName?.[0] ?? '?').toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <View style={styles.cameraBtn}>
                        <Camera size={14} color={Colors.surface} />
                    </View>
                </TouchableOpacity>
                <Text style={styles.avatarHint}>Appuie pour changer la photo</Text>

                {/* Champs */}
                <Text style={styles.sectionLabel}>Mon profil</Text>

                <View style={styles.fieldGroup}>
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Prénom</Text>
                        <TextInput
                            style={styles.fieldInput}
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="Prénom"
                            placeholderTextColor={Colors.textSecondary}
                            maxLength={30}
                            multiline={false}
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Nom</Text>
                        <TextInput
                            style={styles.fieldInput}
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Nom"
                            placeholderTextColor={Colors.textSecondary}
                            maxLength={30}
                            multiline={false}
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Pseudo</Text>
                        <TextInput
                            style={styles.fieldInput}
                            value={pseudo}
                            onChangeText={setPseudo}
                            placeholder="pseudo"
                            placeholderTextColor={Colors.textSecondary}
                            autoCapitalize="none"
                            maxLength={20}
                            multiline={false}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.saveBtn, (!isDirty || saving) && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!isDirty || saving}
                >
                    {saving
                        ? <ActivityIndicator color={Colors.primary} />
                        : <Text style={styles.saveBtnText}>Enregistrer</Text>
                    }
                </TouchableOpacity>

                {/* Déconnexion */}
                <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                    <Text style={styles.signOutText}>Se déconnecter</Text>
                </TouchableOpacity>

                {/* Supprimer le compte */}
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
                    <Text style={styles.deleteText}>Supprimer mon compte</Text>
                </TouchableOpacity>

            </ScrollView>
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

    scroll: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: 60,
        alignItems: 'center',
    },

    // Avatar
    avatarBlock: {
        marginTop: Spacing.xl,
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.cardLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: FontSize.xxxxl,
        fontWeight: FontWeight.bold,
        color: Colors.primaryLight,
    },
    cameraBtn: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarHint: {
        marginTop: Spacing.sm,
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginBottom: Spacing.xl,
    },

    // Section label
    sectionLabel: {
        alignSelf: 'flex-start',
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Spacing.sm,
    },

    // Fields
    fieldGroup: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        height: ComponentSize.inputHeight,
    },
    fieldLabel: {
        width: 72,
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.textPrimary,
    },
    fieldInput: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginLeft: Spacing.md,
    },

    // Buttons
    saveBtn: {
        width: '100%',
        height: ComponentSize.buttonHeight,
        backgroundColor: Colors.primaryButton,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.md,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },

    signOutBtn: {
        width: '100%',
        height: ComponentSize.buttonHeight,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.xl,
    },
    signOutText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.textPrimary,
    },

    deleteBtn: {
        marginTop: Spacing.xl,
        paddingVertical: Spacing.sm,
    },
    deleteText: {
        fontSize: FontSize.xs,
        color: Colors.error,
    },
})
