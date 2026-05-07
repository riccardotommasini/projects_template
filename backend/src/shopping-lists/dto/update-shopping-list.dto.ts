import { IsOptional, IsString } from 'class-validator';

export class UpdateShoppingListDto {
  @IsOptional()
  @IsString()
  name?: string;
}
