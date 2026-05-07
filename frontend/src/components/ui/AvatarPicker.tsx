import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { View, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Camera, CircleUserRound } from 'lucide-react-native'
import { Colors } from '@/src/constants'
import * as FileSystem from 'expo-file-system/legacy';


type Props = {
    onAvatarChange: (uri: string) => void
}

export default function AvatarPicker({ onAvatarChange }: Props) {
    const [avatarUri, setAvatarUri] = useState<string | null>(null)

    const pickImage = async (fromCamera: boolean) => {
        const result = fromCamera
            ? await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            })

        if (!result.canceled) {
            const pickedUri = result.assets[0].uri;

            const fileName = pickedUri.split('/').pop() ?? `avatar-${Date.now()}.jpg`;
            const newUri = `${FileSystem.documentDirectory}${fileName}`;

            await FileSystem.copyAsync({
                from: pickedUri,
                to: newUri,
            });

            setAvatarUri(newUri);
            onAvatarChange(newUri);
        }
    }

    const handlePress = () => {
        Alert.alert(
            'Choisir une photo',
            undefined,
            [
                { text: 'Prendre une photo', onPress: () => pickImage(true) },
                { text: 'Choisir depuis la galerie', onPress: () => pickImage(false) },
                { text: 'Annuler', style: 'cancel' },
            ]
        )
    }

    return (
        <View style={styles.container}>
            {avatarUri
                ? <Image source={{ uri: avatarUri }} style={styles.avatar} />
                : <CircleUserRound size={80} color={Colors.primaryMuted} />
            }
            <TouchableOpacity style={styles.cameraButton} onPress={handlePress}>
                <Camera size={16} color={Colors.surface} />
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        width: 90,
        height: 90,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
    },
    cameraButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
})