import { Body, Controller, Post } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto';

@Controller('transcription')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post('transcribe')
  async transcribe(@Body() transcribeAudioDto: TranscribeAudioDto) {
    return this.transcriptionService.transcribeAudio(transcribeAudioDto.audioBase64);
  }

  @Post('process-recipe')
  async processRecipe(@Body() transcribeAudioDto: TranscribeAudioDto) {
    return this.transcriptionService.processRecipeTranscription(transcribeAudioDto.audioBase64);
  }
}