import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Eye, EyeOff } from 'lucide-react-native';
import { router } from "expo-router";
import { useState } from 'react'
import { Image, Alert } from 'react-native'
import { Colors, FontSize, Spacing, BorderRadius, FontWeight, ComponentSize } from '@/src/constants'
import logo from '@/src/assets/images/logo.png'
import { SafeAreaView } from "react-native-safe-area-context";
import PasswordInput from '@/src/components/ui/PasswordInput'
import { LoginDTO } from "../types/user";
import { signIn } from '@/src/services/auth.service';
import { apiFetch } from '@/src/services/api.service';



export default function WelcomeScreen() {
    const [form, setForm] = useState<LoginDTO>({
        emailOrPseudo: '',
        password: '',
    })

    const handleSignIn = async () => {
        try {
            if (!form.emailOrPseudo.trim() || !form.password.trim()) {
                Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
                return;
            }

            await signIn(form.emailOrPseudo.trim(), form.password);

            const me = await apiFetch('/users/me');
            console.log('Utilisateur connecté :', me);

            router.replace('/(tabs)/profile');
        } catch (error) {
            console.error('Erreur connexion :', error);

            Alert.alert(
                'Erreur de connexion',
                error instanceof Error
                    ? error.message
                    : 'Impossible de se connecter.',
            );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

                    {/* Logo */}
                    <View style={styles.logoContainer}>
                        <Image source={logo} style={{ width: 200, height: 200, resizeMode: 'contain' }} />
                    </View>

                    {/* Titre */}
                    <Text style={styles.welcome}>Bienvenue !</Text>
                    <Text style={styles.subtitle}>Connecte-toi pour continuer</Text>

                    {/* Formulaire */}
                    <View style={styles.form}>
                        <TextInput
                            style={styles.input}
                            placeholder="Email ou pseudo"
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            onChangeText={(text) => setForm({ ...form, emailOrPseudo: text })}
                        />
                        <PasswordInput onChangeText={(text) => setForm({ ...form, password: text })} />
                        <TouchableOpacity onPress={() => Alert.alert('Pas encore implementé, merci de contacter un administrateur.')}>
                            <Text style={styles.forgotPassword}>Mot de passe oublié ?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.loginButton}
                            onPress={handleSignIn}
                        >
                            <Text style={styles.loginButtonText}>Se connecter</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Inscription */}
                    <View style={styles.registerContainer}>
                        <Text style={styles.registerText}>Pas encore de compte ?</Text>
                        <TouchableOpacity onPress={() => router.push('/register')}>
                            <Text style={styles.registerLink}>Créer un compte</Text>
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
        backgroundColor: Colors.background
    },
    scroll: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xxxxl
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    appName: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        letterSpacing: 4,
        marginTop: Spacing.sm,
    },
    welcome: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginBottom: Spacing.xxl,
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
    forgotPassword: {
        fontSize: FontSize.sm,
        color: Colors.primaryMuted,
        textAlign: 'right',
    },
    loginButton: {
        width: '100%',
        height: ComponentSize.buttonHeight,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    loginButtonText: {
        color: Colors.surface,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    registerContainer: {
        alignItems: 'center',
        marginTop: Spacing.xxxl,
        gap: 6,
    },
    registerText: {
        fontSize: FontSize.base,
        color: Colors.textSecondary,
    },
    registerLink: {
        fontSize: FontSize.base,
        color: Colors.primaryLight,
        fontWeight: FontWeight.semibold,
    },
});