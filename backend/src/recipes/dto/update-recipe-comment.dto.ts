// src/recipes/dto/update-recipe-comment.dto.ts
import { IsString, MaxLength } from 'class-validator';

export class UpdateRecipeCommentDto {
  @IsString()
  @MaxLength(1000)
  content!: string;
}
