import { Module } from '@nestjs/common';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';
import { AssemblyAiService } from '../utils/assembly-ai.service';
import { MistralService } from '../utils/mistral.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TranscriptionController],
  providers: [TranscriptionService, AssemblyAiService, MistralService],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}