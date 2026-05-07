import { useState } from 'react'
import { View, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { Camera, ImagePlus } from 'lucide-react-native'
import { Colors, BorderRadius } from '@/src/constants'

type Props = {
  onPhotoChange: (uri: string) => void
}

export default function RecipePhotoPicker({ onPhotoChange }: Props) {
  const [photoUri, setPhotoUri] = useState<string | null>(null)

  const pickPhoto = async (fromCamera: boolean) => {
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })
      : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

    if (!result.canceled) {
      const pickedUri = result.assets[0].uri

      const fileName =
        pickedUri.split('/').pop() ?? `recipe-photo-${Date.now()}.jpg`

      const stableUri = `${FileSystem.documentDirectory}${Date.now()}-${fileName}`

      await FileSystem.copyAsync({
        from: pickedUri,
        to: stableUri,
      })

      setPhotoUri(stableUri)
      onPhotoChange(stableUri)
    }
  }

  const handlePress = () => {
    Alert.alert(
      'Ajouter une photo',
      undefined,
      [
        { text: 'Prendre une photo', onPress: () => pickPhoto(true) },
        { text: 'Choisir depuis la galerie', onPress: () => pickPhoto(false) },
        { text: 'Annuler', style: 'cancel' },
      ]
    )
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photo} />
      ) : (
        <View style={styles.placeholder}>
          <ImagePlus size={28} color={Colors.textSecondary} />
        </View>
      )}
      <View style={styles.cameraButton}>
        <Camera size={14} color={Colors.surface} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 90,   // ← un peu plus grand
    height: 90,
  },
  photo: {
    width: 90,
    height: 90,
    borderRadius: BorderRadius.lg,  // ← plus arrondi
  },
  placeholder: {
    width: 90,
    height: 90,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',  // ← pointillés pour indiquer que c'est cliquable
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
})