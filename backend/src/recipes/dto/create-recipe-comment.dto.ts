import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRecipeCommentDto {
  @IsString()
  @MaxLength(1000)
  content!: string;

  @IsOptional()
  @IsInt()
  parentCommentID?: number;
}
