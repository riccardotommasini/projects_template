import { IsInt, IsNumber } from 'class-validator';

export class AddRecipeIngredientDto {
  @IsInt()
  ingredientID!: number;

  @IsNumber()
  quantity!: number;

  @IsInt()
  unitID!: number;
}
