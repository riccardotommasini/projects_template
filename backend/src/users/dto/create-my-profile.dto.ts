import { IsOptional, IsString } from 'class-validator';

export class CreateMyProfileDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  pseudo!: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
