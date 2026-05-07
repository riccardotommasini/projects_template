import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TranscriptionResult {
  id: string;
  transcript: string;
  confidence: number;
  keywords?: string[];
  duration: number;
  status: 'completed' | 'failed' | 'queued' | 'processing';
  error?: string;
}

@Injectable()
export class AssemblyAiService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.assemblyai.com/v2';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ASSEMBLYAI_API_KEY')!;
    if (!this.apiKey) {
      throw new Error('ASSEMBLYAI_API_KEY environment variable is not set');
    }
  }

  /**
   * Upload un fichier audio à AssemblyAI et retourne l'URL d'upload
   */
  private async uploadAudioFile(audioBase64: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
        },
        body: Buffer.from(audioBase64, 'base64'),
      });

      if (!response.ok) {
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.upload_url;
    } catch (error) {
      throw new Error(`Failed to upload audio file: ${error}`);
    }
  }

  /**
   * Crée un job de transcription auprès d'AssemblyAI
   */
  private async createTranscriptionJob(
    audioUrl: string,
    extractKeywords: boolean = true
  ): Promise<string> {
    try {
      // Vérifier que la clé API n'est pas la clé placeholder
      if (this.apiKey === 'your_assemblyai_api_key_here' || this.apiKey.includes('placeholder')) {
        throw new Error(
          'AssemblyAI API key is not set. Please add ASSEMBLYAI_API_KEY to your .env file with your actual API key from https://www.assemblyai.com/dashboard/account'
        );
      }

      const payload = {
        audio_url: audioUrl,
        language_code: 'fr', // Pour la langue française
        speech_models: ['universal-3-pro'], // Required speech model
      };

      console.log('🎯 Création du job AssemblyAI avec payload:', JSON.stringify(payload).substring(0, 100));

      const response = await fetch(`${this.baseUrl}/transcript`, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('❌ Erreur AssemblyAI:', response.status, errorBody);
        throw new Error(
          `Job creation failed: ${response.status} ${response.statusText}. ${errorBody}`
        );
      }

      const data = await response.json();
      console.log('✅ Job créé:', data.id);
      return data.id;
    } catch (error) {
      console.error('Erreur lors de la création du job:', error);
      throw new Error(`Failed to create transcription job: ${error}`);
    }
  }

  /**
   * Récupère le statut et les résultats de transcription
   */
  private async getTranscriptionResult(jobId: string): Promise<{
    status: string;
    transcript?: string;
    text?: string;
    confidence?: number;
    auto_highlights?: Array<{ text: string; count: number }>;
    duration?: number;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/transcript/${jobId}`, {
        method: 'GET',
        headers: {
          Authorization: this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to get result: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to retrieve transcription result: ${error}`);
    }
  }

  /**
   * Poll le statut de transcription jusqu'à completion (avec timeout)
   */
  private async pollTranscriptionStatus(
    jobId: string,
    maxWaitTime: number = 5 * 60 * 1000
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const pollInterval = 2000; // Check toutes les 2 secondes

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.getTranscriptionResult(jobId);

      if (result.status === 'completed') {
        const transcriptText = result.transcript ?? result.text ?? '';

        if (!transcriptText) {
          console.warn('⚠️ AssemblyAI returned completed status but no transcript text:', JSON.stringify(result, null, 2));
        }

        // Extraire les keywords depuis auto_highlights
        let keywords: string[] = [];
        if (
          result.auto_highlights &&
          Array.isArray(result.auto_highlights) &&
          result.auto_highlights.length > 0
        ) {
          keywords = result.auto_highlights
            .sort((a, b) => b.count - a.count) // Trier par fréquence
            .slice(0, 10) // Top 10 keywords
            .map((h) => h.text);
        }

        return {
          id: jobId,
          transcript: transcriptText,
          confidence: result.confidence || 0,
          keywords,
          duration: result.duration || 0,
          status: 'completed',
        };
      }

      if (result.status === 'failed') {
        return {
          id: jobId,
          transcript: '',
          confidence: 0,
          keywords: [],
          duration: 0,
          status: 'failed',
          error: result.error || 'Transcription échouée',
        };
      }

      // Attendre avant de re-vérifier
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Timeout
    throw new Error(
      'Transcription timeout - la transcription a dépassé le délai d\'attente'
    );
  }

  /**
   * Fonction principale: Transcrit un fichier audio en texte via AssemblyAI
   */
  async transcribeAudio(audioBase64: string): Promise<TranscriptionResult> {
    try {
      console.log('📤 Upload du fichier audio vers AssemblyAI...');
      const audioUrl = await this.uploadAudioFile(audioBase64);
      console.log('✅ Audio uploaded:', audioUrl);

      console.log('🎤 Création du job de transcription...');
      const jobId = await this.createTranscriptionJob(audioUrl, true);
      console.log('✅ Job créé:', jobId);

      console.log('⏳ Attente de la transcription...');
      const result = await this.pollTranscriptionStatus(jobId);

      if (result.status === 'completed') {
        console.log('✅ Transcription complète');
        console.log('📝 Transcript complet AssemblyAI:', result.transcript);
        return result;
      } else {
        console.error('❌ Transcription échouée:', result.error);
        return result;
      }
    } catch (error) {
      console.error('❌ Erreur lors de la transcription:', error);
      throw error;
    }
  }
}