import { Injectable } from '@nestjs/common';
import { AssemblyAiService, TranscriptionResult } from '../utils/assembly-ai.service';
import { MistralService, RecipeExtractionResult } from '../utils/mistral.service';

@Injectable()
export class TranscriptionService {
  constructor(
    private readonly assemblyAiService: AssemblyAiService,
    private readonly mistralService: MistralService,
  ) {}

  async transcribeAudio(audioBase64: string): Promise<TranscriptionResult> {
    return this.assemblyAiService.transcribeAudio(audioBase64);
  }

  /**
   * Traite complètement une transcription : AssemblyAI + Mistral
   */
  async processRecipeTranscription(audioBase64: string): Promise<{
    transcription: TranscriptionResult;
    recipeInfo: RecipeExtractionResult;
  }> {
    // 1. Transcription avec AssemblyAI
    const transcription = await this.assemblyAiService.transcribeAudio(audioBase64);

    if (transcription.status !== 'completed') {
      throw new Error(`Transcription failed: ${transcription.error}`);
    }

    // 2. Extraction des infos recette avec Mistral
    const recipeInfo = await this.mistralService.extractRecipeInfo(
      transcription.transcript,
      transcription.keywords
    );

    return {
      transcription,
      recipeInfo,
    };
  }
}