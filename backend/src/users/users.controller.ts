import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { UsersService } from './users.service';
//import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateFriendshipDto } from './dto/create-friendship.dto';
import { UpdateFriendshipStatusDto } from './dto/update-friendship-status.dto';
import { SaveRecipeDto } from './dto/save-recipe.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMyProfileDto } from './dto/create-my-profile.dto';
import { UpdateMyAvatarDto } from './dto/update-my-avatar.dto';
import { CreateUserPreferencesDto } from './dto/create-user-preferences.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('me')
  createMyProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateMyProfileDto,
  ) {
    return this.usersService.createMyProfile(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: AuthenticatedRequest) {
    return this.usersService.findOne(req.user.userID);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@Req() req: AuthenticatedRequest, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.userID, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  removeMe(@Req() req: AuthenticatedRequest) {
    return this.usersService.remove(req.user.userID);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/avatar')
  updateMyAvatar(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateMyAvatarDto,
  ) {
    return this.usersService.updateMyAvatar(req.user.userID, dto.avatar);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    if (search) return this.usersService.search(search);
    return this.usersService.findAll();
  }

  @Get(':userID/recipes')
  findUserRecipes(
    @Param('userID') userID: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.usersService.findRecipesByUser(userID, page, limit);
  }

  @Get(':userID')
  findOne(@Param('userID') userID: string) {
    return this.usersService.findOne(userID);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/friendships')
  sendFriendRequest(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFriendshipDto,
  ) {
    return this.usersService.sendFriendRequest(req.user.userID, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('friendships/:requesterID/:receiverID')
  updateFriendship(
    @Req() req: AuthenticatedRequest,
    @Param('requesterID') requesterID: string,
    @Param('receiverID') receiverID: string,
    @Body() dto: UpdateFriendshipStatusDto,
  ) {
    return this.usersService.updateFriendship(
      req.user.userID,
      requesterID,
      receiverID,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('friendships/:requesterID/:receiverID')
  removeFriendship(
    @Req() req: AuthenticatedRequest,
    @Param('requesterID') requesterID: string,
    @Param('receiverID') receiverID: string,
  ) {
    return this.usersService.removeFriendship(
      req.user.userID,
      requesterID,
      receiverID,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/saved-recipes')
  saveRecipe(@Req() req: AuthenticatedRequest, @Body() dto: SaveRecipeDto) {
    return this.usersService.saveRecipe(req.user.userID, dto.recipeID);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/saved-recipes')
  findSavedRecipes(@Req() req: AuthenticatedRequest) {
    return this.usersService.findSavedRecipes(req.user.userID);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/saved-recipes/:recipeID')
  unsaveRecipe(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
  ) {
    return this.usersService.unsaveRecipe(req.user.userID, recipeID);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/friends')
  getMyFriends(@Req() req: AuthenticatedRequest) {
    return this.usersService.findMyFriends(req.user.userID);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/invitations')
  getMyInvitations(@Req() req: AuthenticatedRequest) {
    return this.usersService.findMyInvitations(req.user.userID);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/sent-requests')
  getMySentRequests(@Req() req: AuthenticatedRequest) {
    return this.usersService.findMySentRequests(req.user.userID);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/preferences')
  savePreferences(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateUserPreferencesDto,
  ) {
    return this.usersService.savePreferences(req.user.userID, dto.tagNames);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/preferences')
  getPreferences(@Req() req: AuthenticatedRequest) {
    return this.usersService.getPreferences(req.user.userID);
  }
}
