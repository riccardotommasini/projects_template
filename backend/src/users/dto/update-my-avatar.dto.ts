import { IsString } from 'class-validator';

export class UpdateMyAvatarDto {
  @IsString()
  avatar!: string;
}
