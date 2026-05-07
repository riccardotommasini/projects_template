import { IsUUID } from 'class-validator';

export class CreateFriendshipDto {
  @IsUUID()
  receiverID!: string;
}
