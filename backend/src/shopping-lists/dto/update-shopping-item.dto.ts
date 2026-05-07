import { PartialType } from '@nestjs/mapped-types';
import { CreateShoppingItemDto } from './create-shopping-item.dto';

export class UpdateShoppingItemDto extends PartialType(CreateShoppingItemDto) {}
