import { IsNotEmpty, IsString } from 'class-validator';

export class TranscribeAudioDto {
  @IsString()
  @IsNotEmpty()
  audioBase64: string;
}