import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { AddGroupRecipeDto } from './dto/add-group-recipe.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) { }

  private readonly include = {
    members: {
      include: {
        user: true,
      },
    },
    recipes: {
      include: {
        recipe: {
          include: {
            creator: true,
            tags: { include: { tag: true } },
          },
        },
      },
    },
    shoppingList: {
      include: {
        items: {
          include: {
            ingredient: true,
            unit: true,
          },
        },
      },
    },
  };

  private async assertGroupMember(userID: string, groupID: number) {
    const group = await this.prisma.groups.findUnique({
      where: { groupID },
      include: this.include,
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupID} not found`);
    }

    const isMember = group.members.some((member) => member.userID === userID);

    if (!isMember) {
      throw new ForbiddenException("Vous n'avez pas accès à ce groupe.");
    }

    return group;
  }

  async create(userID: string, createGroupDto: CreateGroupDto) {
    const { memberIDs = [], ...groupData } = createGroupDto;

    const uniqueMemberIDs = Array.from(new Set([userID, ...memberIDs]));

    return this.prisma.groups.create({
      data: {
        ...groupData,

        members: {
          create: uniqueMemberIDs.map((memberID) => ({
            user: {
              connect: { userID: memberID },
            },
          })),
        },

        shoppingList: {
          create: {
            name: `Liste - ${groupData.name}`,
          },
        },
      },
      include: this.include,
    });
  }

  /*
  async findAll() {
    return this.prisma.groups.findMany({
      include: {
        members: {
          include: {
            user: true,
          },
        },
        recipes: {
          include: {
            recipe: true,
          },
        },
        shoppingList: true,
      },
    });
  }
  */

  async findOne(userID: string, groupID: number) {
    return this.assertGroupMember(userID, groupID);
  }

  async update(userID: string, groupID: number, updateGroupDto: UpdateGroupDto) {
    await this.assertGroupMember(userID, groupID);

    return this.prisma.groups.update({
      where: { groupID },
      data: updateGroupDto,
      include: this.include,
    });
  }

  /*
  async remove(userID: string, groupID: number) {
    await this.assertGroupMember(userID, groupID);

    return this.prisma.groups.delete({
      where: { groupID },
    });
  }
  */

  async addMember(
    userID: string,
    groupID: number,
    addGroupMemberDto: AddGroupMemberDto,
  ) {
    await this.assertGroupMember(userID, groupID);

    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupID_userID: {
          groupID,
          userID: addGroupMemberDto.userID,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this group');
    }

    return this.prisma.groupMember.create({
      data: {
        groupID,
        userID: addGroupMemberDto.userID,
      },
    });
  }

  /*
  async removeMember(connectedUserID: string, groupID: number, userIDToRemove: string) {
    await this.assertGroupMember(connectedUserID, groupID);

    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupID_userID: {
          groupID,
          userID: userIDToRemove,
        },
      },
    });

    if (!existingMember) {
      throw new NotFoundException('User is not a member of this group');
    }

    return this.prisma.groupMember.delete({
      where: {
        groupID_userID: {
          groupID,
          userID: userIDToRemove,
        },
      },
    });
  }
  */

  async addRecipe(
    userID: string,
    groupID: number,
    addGroupRecipeDto: AddGroupRecipeDto,
  ) {
    await this.assertGroupMember(userID, groupID);

    const existingRecipe = await this.prisma.groupRecipe.findUnique({
      where: {
        groupID_recipeID: {
          groupID,
          recipeID: addGroupRecipeDto.recipeID,
        },
      },
    });

    if (existingRecipe) {
      throw new ConflictException('Recipe is already in this group');
    }

    return this.prisma.groupRecipe.create({
      data: {
        groupID,
        recipeID: addGroupRecipeDto.recipeID,
      },
    });
  }

  async removeRecipe(userID: string, groupID: number, recipeID: number) {
    await this.assertGroupMember(userID, groupID);

    const existingRecipe = await this.prisma.groupRecipe.findUnique({
      where: {
        groupID_recipeID: {
          groupID,
          recipeID,
        },
      },
    });

    if (!existingRecipe) {
      throw new NotFoundException('Recipe is not in this group');
    }

    return this.prisma.groupRecipe.delete({
      where: {
        groupID_recipeID: {
          groupID,
          recipeID,
        },
      },
    });
  }

  async findMine(userID: string) {
    return this.prisma.groups.findMany({
      where: {
        members: {
          some: {
            userID,
          },
        },
      },
      include: this.include,
    });
  }

  async leaveGroup(userID: string, groupID: number) {
    await this.assertGroupMember(userID, groupID);

    const memberCount = await this.prisma.groupMember.count({
      where: {
        groupID,
      },
    });

    if (memberCount <= 1) {
      return this.prisma.groups.delete({ where: { groupID } });
    }

    return this.prisma.groupMember.delete({
      where: {
        groupID_userID: {
          groupID,
          userID,
        },
      },
    });
  }
}
