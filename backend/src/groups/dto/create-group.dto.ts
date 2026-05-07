import { IsArray, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  memberIDs?: string[];
}
