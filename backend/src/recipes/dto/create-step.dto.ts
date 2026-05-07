import { IsInt, IsString } from 'class-validator';

export class CreateStepDto {
  @IsString()
  text!: string;

  @IsInt()
  order!: number;
}
