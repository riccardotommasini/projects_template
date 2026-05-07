import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ShoppingListsService } from './shopping-lists.service';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto';
import { CreateShoppingItemDto } from './dto/create-shopping-item.dto';
import { UpdateShoppingItemDto } from './dto/update-shopping-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';

@UseGuards(JwtAuthGuard)
@Controller('shopping-lists')
export class ShoppingListsController {
  constructor(private readonly shoppingListsService: ShoppingListsService) {}

  @Get('me')
  findMine(@Req() req: AuthenticatedRequest) {
    return this.shoppingListsService.findMine(req.user.userID);
  }

  /*
  @Get()
  findAll() {
    return this.shoppingListsService.findAll();
  }
  */

  @Get(':listID')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('listID', ParseIntPipe) listID: number,
  ) {
    return this.shoppingListsService.findOne(req.user.userID, listID);
  }

  @Patch(':listID')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('listID', ParseIntPipe) listID: number,
    @Body() dto: UpdateShoppingListDto,
  ) {
    return this.shoppingListsService.update(req.user.userID, listID, dto);
  }

  /*
  @Delete(':listID')
  remove(@Param('listID', ParseIntPipe) listID: number) {
    return this.shoppingListsService.remove(listID);
  }
    */

  @Post(':listID/items')
  addItem(
    @Req() req: AuthenticatedRequest,
    @Param('listID', ParseIntPipe) listID: number,
    @Body() dto: CreateShoppingItemDto,
  ) {
    return this.shoppingListsService.addItem(req.user.userID, listID, dto);
  }

  @Post(':listID/import-recipe/:recipeID')
  importRecipe(
    @Req() req: AuthenticatedRequest,
    @Param('listID', ParseIntPipe) listID: number,
    @Param('recipeID', ParseIntPipe) recipeID: number,
  ) {
    return this.shoppingListsService.importRecipe(
      req.user.userID,
      listID,
      recipeID,
    );
  }

  @Patch('items/:itemID')
  updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('itemID', ParseIntPipe) itemID: number,
    @Body() dto: UpdateShoppingItemDto,
  ) {
    return this.shoppingListsService.updateItem(req.user.userID, itemID, dto);
  }

  @Delete('items/:itemID')
  removeItem(
    @Req() req: AuthenticatedRequest,
    @Param('itemID', ParseIntPipe) itemID: number,
  ) {
    return this.shoppingListsService.removeItem(req.user.userID, itemID);
  }

  @Patch('items/:itemID/toggle')
  toggleItem(
    @Req() req: AuthenticatedRequest,
    @Param('itemID', ParseIntPipe) itemID: number,
  ) {
    return this.shoppingListsService.toggleItem(req.user.userID, itemID);
  }
}
