import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio, AVPlaybackStatus } from "expo-av";
import * as FileSystem from 'expo-file-system/legacy';
import { ArrowLeft, Mic, RotateCcw } from "lucide-react-native";
import { router } from "expo-router";
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from "@/src/constants";
import PrimaryButton from "@/src/components/ui/PrimaryButton";
import { processRecipeFromAudio } from "@/src/services/assembly-ai.service";

export default function VoiceChatScreen() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Prêt à enregistrer");

  useEffect(() => {
    const prepareAudio = async () => {
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        setHasPermission(granted);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
      } catch (error) {
        console.error("Audio permission error", error);
        setHasPermission(false);
      }
    };

    prepareAudio();

    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
      if (sound) {
        sound.unloadAsync().catch(() => undefined);
      }
    };
  }, [recording, sound]);

  const startRecording = async () => {
    if (!hasPermission) {
      Alert.alert("Autorisation microphone", "Autorise l'accès au micro pour enregistrer.");
      return;
    }

    try {
      setStatusText("Préparation de l'enregistrement...");
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      setStatusText("Enregistrement en cours");
    } catch (error) {
      console.error("startRecording", error);
      setStatusText("Impossible de démarrer l'enregistrement");
      Alert.alert("Erreur", "Impossible de démarrer l'enregistrement.");
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri);
      setStatusText(uri ? "Enregistrement terminé" : "Enregistrement enregistré");
    } catch (error) {
      console.error("stopRecording", error);
      setStatusText("Erreur lors de l'arrêt");
      Alert.alert("Erreur", "Impossible d'arrêter l'enregistrement.");
    } finally {
      setIsRecording(false);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
      return;
    }
    if (audioUri) {
      if (isPlaying) {
        await stopPlayback();
        return;
      }

      try {
        if (sound) {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            if (status.isPlaying) {
              await sound.pauseAsync();
              setIsPlaying(false);
              return;
            }

            await sound.playAsync();
            setIsPlaying(true);
            return;
          }
        }

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: false },
          (playbackStatus: AVPlaybackStatus) => {
            if (!playbackStatus.isLoaded) {
              return;
            }
            if (playbackStatus.didJustFinish) {
              setIsPlaying(false);
            }
          }
        );

        // Réinitialiser la position à 0 et jouer depuis le début
        await newSound.setPositionAsync(0);
        await newSound.playAsync();
        setSound(newSound);
        setIsPlaying(true);
      } catch (error) {
        console.error('Erreur lecture audio:', error);
        Alert.alert('Erreur', 'Impossible de lire l\'enregistrement.');
      }

      return;
    }
    await startRecording();
  };

  const stopPlayback = async () => {
    if (!sound) {
      return;
    }

    try {
      await sound.pauseAsync();
    } catch (error) {
      console.error('Erreur lors de l\'arrêt de la lecture:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  const handleReset = async () => {
    // Supprimer le fichier audio existant
    if (audioUri) {
      try {
        await FileSystem.deleteAsync(audioUri);
        console.log('🗑️ Fichier audio supprimé');
      } catch (error) {
        console.error('Erreur lors de la suppression du fichier audio:', error);
      }
    }

    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // ignore
      }
    }

    if (sound) {
      try {
        await sound.unloadAsync();
      } catch {
        // ignore
      }
    }

    setRecording(null);
    setSound(null);
    setIsPlaying(false);
    setAudioUri(null);
    setStatusText("Prêt à enregistrer");
  };

  const handleGoBack = async () => {
    // Supprimer le fichier audio si on quitte
    if (audioUri) {
      try {
        await FileSystem.deleteAsync(audioUri);
        console.log('🗑️ Fichier audio supprimé lors du retour');
      } catch (error) {
        console.error('Erreur lors de la suppression du fichier audio:', error);
      }
    }

    if (sound) {
      try {
        await sound.unloadAsync();
      } catch {
        // ignore
      }
    }

    router.back();
  };

  const handleValidate = async () => {
    if (!audioUri) {
      Alert.alert("Erreur", "Aucun enregistrement trouvé. Veuillez d'abord enregistrer votre recette.");
      return;
    }

    setIsProcessing(true);
    setStatusText("Traitement en cours...");

    try {
      if (sound) {
        await sound.stopAsync().catch(() => undefined);
        await sound.unloadAsync().catch(() => undefined);
      }
      console.log('🎤 Début du traitement de la recette...');
      const result = await processRecipeFromAudio(audioUri);

      if (result.transcription.status !== 'completed') {
        throw new Error(`Transcription échouée: ${result.transcription.error}`);
      }

      console.log('✅ Recette extraite:', result.recipeInfo.recipe.name);

      // Supprimer le fichier audio après traitement réussi
      try {
        await FileSystem.deleteAsync(audioUri);
        console.log('🗑️ Fichier audio supprimé après traitement');
      } catch (error) {
        console.error('Erreur lors de la suppression du fichier audio:', error);
      }

      // Naviguer vers CreateRecipeScreen avec les données préremplies
      // On utilise les search params pour passer les données
      const recipeData = encodeURIComponent(JSON.stringify(result.recipeInfo.recipe));
      router.replace(`/create-recipe?prefill=${recipeData}`);

    } catch (error) {
      console.error('Erreur lors du traitement:', error);
      Alert.alert(
        "Erreur de traitement",
        error instanceof Error ? error.message : "Une erreur est survenue lors du traitement de votre enregistrement."
      );
      setStatusText("Erreur lors du traitement");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dictée vocale</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Créer une recette par la voix</Text>
        <Text style={styles.instruction}>Parle avec le plus de détails possibles pour un meilleur résultat.</Text>
        <Text style={styles.subtitle}>{statusText}</Text>

        <Pressable 
          style={[styles.recordButton, isRecording && styles.recordingRing]} 
          onPress={handleToggleRecording}
          disabled={isProcessing}
        >
          <View style={styles.recordIconWrapper}>
            <Mic size={44} color={Colors.primaryButton} />
          </View>
          <Text style={styles.recordButtonText}>
            {isProcessing
              ? "Traitement..."
              : isRecording
              ? "Arrêter"
              : audioUri
              ? isPlaying
                ? "Pause"
                : "Écouter"
              : "Commencer"}
          </Text>
        </Pressable>

        <View style={styles.actionsRow}>
          <Pressable 
            style={[styles.actionButton, styles.resetButton, isProcessing && styles.disabledButton]} 
            onPress={handleReset}
            disabled={isProcessing}
          >
            <View style={styles.actionContent}>
              <RotateCcw size={18} color={isProcessing ? Colors.textSecondary : Colors.primaryButton} />
              <Text style={[styles.resetText, isProcessing && styles.disabledText]}>Recommencer</Text>
            </View>
          </Pressable>

          <PrimaryButton 
            title={isProcessing ? "Traitement..." : "Valider"} 
            onPress={handleValidate}
            style={[styles.actionButton, isProcessing && styles.disabledButton]}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  instruction: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  recordButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.primaryButton,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primaryButton,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: Spacing.xxxl,
  },
  recordingRing: {
    borderWidth: 6,
    borderColor: Colors.primaryDarkButton,
  },
  recordIconWrapper: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  recordButtonText: {
    marginTop: Spacing.sm,
    color: Colors.surface,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  actionsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 50,
  },
  resetButton: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryButton,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
  },
  actionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  resetText: {
    color: Colors.primaryButton,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: Colors.textSecondary,
  },
});
