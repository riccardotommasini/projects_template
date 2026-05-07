import { IsInt } from 'class-validator';

export class AddRecipeTagDto {
  @IsInt()
  tagID!: number;
}
