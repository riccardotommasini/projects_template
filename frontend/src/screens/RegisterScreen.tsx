import { View, Text, TouchableOpacity, KeyboardAvoidingView, ScrollView, TextInput, Platform, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context'
import AvatarPicker from '@/src/components/ui/AvatarPicker'
import { router } from "expo-router";
import { useState } from "react";
import { RegisterDTO } from "../types/user";
import { isPasswordValid, isEmailValid } from "../utils/validation"
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, ComponentSize } from "../constants";
import PasswordInput from '@/src/components/ui/PasswordInput'
import { register } from '@/src/services/auth.service'

export default function RegisterScreen() {
    const [error, setError] = useState<string | null>(null)
    const [form, setForm] = useState<RegisterDTO>({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        pseudo: '',
        avatarUri: undefined,
    })

    const handleRegister = async () => {
        setError(null)
        if (!isEmailValid(form.email)) {
            setError('Email invalide')
            return
        }
        if (!isPasswordValid(form.password)) {
            setError('Le mot de passe doit contenir 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial')
            return
        }
        if (!form.pseudo || form.pseudo.length < 3) {
            setError('Le pseudo doit faire au moins 3 caractères')
            return
        }
        if (!form.firstName || !form.lastName) {
            setError('Prénom et nom requis')
            return
        }
        try {
                await register(form)
                Alert.alert(
                    'Compte créé !',
                    'Choisis maintenant tes préférences pour personnaliser ton feed.',
                    [{ text: 'OK', onPress: () => router.push('/preferences') }]
                )
        } catch (e: any) {
            setError(e.message)
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

                    {/* Titre */}
                    <Text style={styles.title}>Créer un compte</Text>

                    {/* Avatar */}
                    <Text style={styles.avatarLabel}>Choisir un avatar (optionnel)</Text>
                    <View style={styles.avatarContainer}>
                        <AvatarPicker onAvatarChange={(uri) => setForm((prev) => ({ ...prev, avatarUri: uri }))} />
                    </View>

                    {/* Formulaire */}
                    <View style={styles.form}>
                        <TextInput
                            style={styles.input}
                            placeholder="Prénom"
                            placeholderTextColor={Colors.textSecondary}
                            autoCapitalize="none"
                            onChangeText={(text) => setForm({ ...form, firstName: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Nom"
                            placeholderTextColor={Colors.textSecondary}
                            autoCapitalize="none"
                            onChangeText={(text) => setForm({ ...form, lastName: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={Colors.textSecondary}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            onChangeText={(text) => setForm({ ...form, email: text })}
                        />
                        <View>
                            <TextInput
                                style={styles.input}
                                placeholder="Pseudo"
                                placeholderTextColor={Colors.textSecondary}
                                autoCapitalize="none"
                                onChangeText={(text) => setForm({ ...form, pseudo: text })}
                            />
                            <Text style={styles.hint}>Ce pseudo sera visible par les autres utilisateurs</Text>
                        </View>
                        <View>
                            <PasswordInput onChangeText={(text) => setForm({ ...form, password: text })} />
                            <Text style={styles.hint}>Minimum 8 caractères avec une minuscule, une majuscule, un chiffre et un caractère spécial</Text>
                        </View>
                    </View>

                    {error && <Text style={styles.error}>{error}</Text>}

                    <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
                        <Text style={styles.registerButtonText}>Créer mon compte</Text>
                    </TouchableOpacity>

                    {/* Connexion */}
                    <View style={styles.loginContainer}>
                        <Text style={styles.loginText}>Déjà un compte ?</Text>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Text style={styles.loginLink}>Connectez-vous ici</Text>
                        </TouchableOpacity>
                    </View>


                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xl,
    },
    title: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
        marginBottom: Spacing.lg,
        textAlign: 'center',
    },
    avatarLabel: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    form: {
        width: '100%',
        gap: Spacing.md,
    },
    input: {
        width: '100%',
        height: ComponentSize.inputHeight,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },
    hint: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
        textAlign: 'center',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        height: ComponentSize.inputHeight,
    },
    passwordInput: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },
    error: {
        fontSize: FontSize.sm,
        color: Colors.error,
        textAlign: 'center',
        marginTop: Spacing.md,
    },
    registerButton: {
        width: '100%',
        height: ComponentSize.buttonHeight,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.lg,
    },
    registerButtonText: {
        color: Colors.surface,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    loginContainer: {
        alignItems: 'center',
        marginTop: Spacing.lg,
        gap: Spacing.xs,
    },
    loginText: {
        fontSize: FontSize.base,
        color: Colors.textSecondary,
    },
    loginLink: {
        fontSize: FontSize.base,
        color: Colors.primaryLight,
        fontWeight: FontWeight.semibold,
    },
})