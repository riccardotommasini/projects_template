import { IsEnum } from 'class-validator';
import { CommentReactionType } from '@prisma/client';

export class UpsertCommentReactionDto {
  @IsEnum(CommentReactionType)
  type!: CommentReactionType;
}
