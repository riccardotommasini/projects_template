import { useState } from 'react'
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'
import { Colors, FontSize, Spacing, BorderRadius, ComponentSize } from '@/src/constants'

type Props = {
    placeholder?: string
    onChangeText: (text: string) => void
}

export default function PasswordInput({ placeholder = 'Mot de passe', onChangeText }: Props) {
    const [showPassword, setShowPassword] = useState(false)

    return (
        <View style={styles.container}>
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry={!showPassword}
                onChangeText={onChangeText}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword
                    ? <EyeOff size={20} color={Colors.textSecondary} />
                    : <Eye size={20} color={Colors.textSecondary} />
                }
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        height: ComponentSize.inputHeight,
    },
    input: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
    },
})