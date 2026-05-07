import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateShoppingItemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  checked?: boolean;

  @IsOptional()
  @IsInt()
  ingredientID?: number;

  @IsOptional()
  @IsInt()
  unitID?: number;
}
