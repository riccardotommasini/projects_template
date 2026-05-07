import { IsString } from 'class-validator';

export class UpdateRecipePhotoDto {
  @IsString()
  photo!: string;
}
