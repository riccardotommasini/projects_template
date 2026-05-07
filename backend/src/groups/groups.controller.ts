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
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { AddGroupRecipeDto } from './dto/add-group-recipe.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createGroupDto: CreateGroupDto,
  ) {
    return this.groupsService.create(req.user.userID, createGroupDto);
  }

  @Get('me')
  findMine(@Req() req: AuthenticatedRequest) {
    return this.groupsService.findMine(req.user.userID);
  }

  /*
  @Get()
  findAll() {
    return this.groupsService.findAll();
  }
  */

  @Get(':groupID')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('groupID', ParseIntPipe) groupID: number,
  ) {
    return this.groupsService.findOne(req.user.userID, groupID);
  }

  @Patch(':groupID')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('groupID', ParseIntPipe) groupID: number,
    @Body() updateGroupDto: UpdateGroupDto,
  ) {
    return this.groupsService.update(req.user.userID, groupID, updateGroupDto);
  }

  /*
  @Delete(':groupID')
  remove(@Req() req: AuthenticatedRequest, @Param('groupID', ParseIntPipe) groupID: number) {
    return this.groupsService.remove(req.user.userID, groupID);
  }
    */

  @Post(':groupID/members')
  addMember(
    @Req() req: AuthenticatedRequest,
    @Param('groupID', ParseIntPipe) groupID: number,
    @Body() addGroupMemberDto: AddGroupMemberDto,
  ) {
    return this.groupsService.addMember(
      req.user.userID,
      groupID,
      addGroupMemberDto,
    );
  }

  /*
  @Delete(':groupID/members/:userID')
  removeMember(
    @Req() req: AuthenticatedRequest,
    @Param('groupID', ParseIntPipe) groupID: number,
    @Param('userID') userID: string,
  ) {
    return this.groupsService.removeMember(req.user.userID, groupID, userID);
  }
  */

  @Post(':groupID/recipes')
  addRecipe(
    @Req() req: AuthenticatedRequest,
    @Param('groupID', ParseIntPipe) groupID: number,
    @Body() addGroupRecipeDto: AddGroupRecipeDto,
  ) {
    return this.groupsService.addRecipe(
      req.user.userID,
      groupID,
      addGroupRecipeDto,
    );
  }

  @Delete(':groupID/recipes/:recipeID')
  removeRecipe(
    @Req() req: AuthenticatedRequest,
    @Param('groupID', ParseIntPipe) groupID: number,
    @Param('recipeID', ParseIntPipe) recipeID: number,
  ) {
    return this.groupsService.removeRecipe(req.user.userID, groupID, recipeID);
  }

  @Delete(':groupID/members/me')
  leaveGroup(
    @Req() req: AuthenticatedRequest,
    @Param('groupID', ParseIntPipe) groupID: number,
  ) {
    return this.groupsService.leaveGroup(req.user.userID, groupID);
  }
}
