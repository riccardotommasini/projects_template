import { IsInt } from 'class-validator';

export class AddGroupRecipeDto {
  @IsInt()
  recipeID!: number;
}
