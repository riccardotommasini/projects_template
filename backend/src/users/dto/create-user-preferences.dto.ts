import { IsArray, IsString } from 'class-validator';

export class CreateUserPreferencesDto {
  @IsArray()
  @IsString({ each: true })
  tagNames: string[];
}
