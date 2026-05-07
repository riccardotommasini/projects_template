import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateStepDto {
  @IsString()
  text!: string;

  @IsInt()
  order!: number;
}

class CreateRecipeIngredientDto {
  @IsInt()
  ingredientID!: number;

  @IsNumber()
  quantity!: number;

  @IsInt()
  unitID!: number;
}

export class CreateRecipeDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  nutritionalScore?: number;

  @IsOptional()
  @IsInt()
  prepTime?: number;

  @IsOptional()
  @IsInt()
  cookTime?: number;

  @IsInt()
  portion!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStepDto)
  steps?: CreateStepDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeIngredientDto)
  ingredients?: CreateRecipeIngredientDto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tagIDs?: number[];
}
