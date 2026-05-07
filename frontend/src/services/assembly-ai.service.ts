import * as FileSystem from 'expo-file-system/legacy';
import { apiFetch } from '@/src/config/api';
import { CreateRecipeDTO } from '@/src/types/recipe';

// Types
export interface TranscriptionResult {
  id: string;
  transcript: string;
  confidence: number;
  keywords?: string[];
  duration: number;
  status: 'completed' | 'failed' | 'queued' | 'processing';
  error?: string;
}

export interface RecipeProcessingResult {
  transcription: TranscriptionResult;
  recipeInfo: {
    recipe: Partial<CreateRecipeDTO>;
    confidence: number;
    missingFields: string[];
  };
}

/**
 * Fonction principale: Transcrit un fichier audio en texte via le backend
 * @param audioFilePath - Chemin local du fichier audio enregistré
 * @returns Résultats de transcription (texte, confiance, keywords)
 */
export async function transcribeAudio(audioFilePath: string): Promise<TranscriptionResult> {
  try {
    console.log('📤 Lecture du fichier audio...');
    const audioBase64 = await FileSystem.readAsStringAsync(audioFilePath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('📤 Envoi au backend pour transcription...');
    const result = await apiFetch('/transcription/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioBase64 }),
    });

    console.log('✅ Transcription reçue du backend');
    return result as TranscriptionResult;
  } catch (error) {
    console.error('❌ Erreur lors de la transcription:', error);
    throw error;
  }
}

/**
 * Traite complètement une dictée vocale : transcription + extraction des infos recette
 * @param audioFilePath - Chemin local du fichier audio enregistré
 * @returns Résultats complets avec infos recette extraites
 */
export async function processRecipeFromAudio(audioFilePath: string): Promise<RecipeProcessingResult> {
  try {
    console.log('🎤 Traitement complet de la dictée vocale...');
    const audioBase64 = await FileSystem.readAsStringAsync(audioFilePath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('📤 Envoi au backend pour traitement complet...');
    const result = await apiFetch('/transcription/process-recipe', {
      method: 'POST',
      body: JSON.stringify({ audioBase64 }),
    });

    console.log('✅ Traitement complet terminé');
    return result as RecipeProcessingResult;
  } catch (error) {
    console.error('❌ Erreur lors du traitement complet:', error);
    throw error;
  }
}

/**
 * Récupère uniquement les keywords (mots les plus importants)
 * via le endpoint LeMUR d'AssemblyAI (optionnel, plus avancé)
 * @param transcript - Le texte transcrit
 * @returns Liste des keywords extraits
 */
export async function extractKeywordsFromTranscript(
  transcript: string
): Promise<string[]> {
  // Cette fonction est un placeholder pour une future implémentation
  // utilisant le LeMUR (Language Model) d'AssemblyAI pour une extraction
  // plus intelligente des mots-clés
  // Pour l'instant, on retourne juste les mots > 4 caractères

  const words = transcript
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 4 && !/[^a-zàâäçèéêëìîïòôöùûüœæ]/i.test(word));

  // Compter les occurrences
  const wordCount: { [key: string]: number } = {};
  words.forEach((word) => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Retourner les top 10 mots par fréquence
  return Object.entries(wordCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
}