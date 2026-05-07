import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  nutritionalScore?: string;

  @IsString()
  category!: string;

  @IsString()
  unitDefault!: string;

  @IsInt()
  calories!: number;
}
