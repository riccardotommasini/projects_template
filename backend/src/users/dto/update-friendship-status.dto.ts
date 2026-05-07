import { FriendshipStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateFriendshipStatusDto {
  @IsEnum(FriendshipStatus)
  status!: FriendshipStatus;
}
