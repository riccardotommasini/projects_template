import { IsInt } from 'class-validator';

export class SaveRecipeDto {
  @IsInt()
  recipeID!: number;
}
