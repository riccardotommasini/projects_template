import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
//import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateFriendshipDto } from './dto/create-friendship.dto';
import { UpdateFriendshipStatusDto } from './dto/update-friendship-status.dto';
import { CreateMyProfileDto } from './dto/create-my-profile.dto';

type AuthUser = {
  userID: string;
  email?: string;
  role?: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createMyProfile(authUser: AuthUser, dto: CreateMyProfileDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        userID: authUser.userID,
      },
    });

    if (existingUser) {
      return existingUser;
    }

    if (!authUser.email) {
      throw new BadRequestException(
        "Impossible de créer le profil : l'email est absent du token.",
      );
    }

    try {
      return await this.prisma.user.create({
        data: {
          userID: authUser.userID,
          email: authUser.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          pseudo: dto.pseudo,
          avatar: dto.avatar,
          shoppingList: {
            create: {
              name: `Liste de ${dto.pseudo}`,
            },
          },
        },
        include: {
          shoppingList: true,
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('Ce pseudo est déjà utilisé');
      }
      throw e;
    }
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { pseudo: 'asc' },
    });
  }

  async findOne(userID: string) {
    const user = await this.prisma.user.findUnique({
      where: { userID },
      include: {
        recipes: {
          select: {
            recipeID: true,
            name: true,
            photo: true,
            prepTime: true,
            cookTime: true,
            createdAt: true,
          },
        },
        savedRecipes: {
          include: {
            recipe: {
              select: {
                recipeID: true,
                name: true,
                photo: true,
                prepTime: true,
                cookTime: true,
                createdAt: true,
              },
            },
          },
        },
        reviews: {
          select: {
            reviewID: true,
            rating: true,
          },
        },
        shoppingList: {
          select: {
            listID: true,
            name: true,
          },
        },
        sentFriendships: {
          select: {
            friendshipID: true,
            status: true,
            receiver: {
              select: {
                userID: true,
                pseudo: true,
                avatar: true,
              },
            },
          },
        },
        receivedFriendships: {
          select: {
            friendshipID: true,
            status: true,
            requester: {
              select: {
                userID: true,
                pseudo: true,
                avatar: true,
              },
            },
          },
        },
        groupMemberships: {
          select: {
            group: {
              select: {
                groupID: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userID} not found`);
    }

    return user;
  }

  async search(search: string) {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { pseudo: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      },
      orderBy: { pseudo: 'asc' },
    });
  }

  async update(userID: string, dto: UpdateUserDto) {
    await this.findOne(userID);

    return this.prisma.user.update({
      where: { userID },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        pseudo: dto.pseudo,
      },
    });
  }

  async remove(userID: string) {
    // Suppression DB — silencieuse si le user n'existe plus (tentative précédente partielle)
    await this.prisma.user.deleteMany({ where: { userID } });

    // Suppression Supabase Auth via REST direct (évite le client JS qui init WebSocket)
    const res = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/admin/users/${userID}`,
      {
        method: 'DELETE',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      },
    );
    if (!res.ok && res.status !== 404) {
      throw new Error(`Supabase auth delete failed: ${res.status}`);
    }
  }

  async sendFriendRequest(requesterID: string, dto: CreateFriendshipDto) {
    if (requesterID === dto.receiverID) {
      throw new ConflictException('Cannot add yourself');
    }

    const receiver = await this.prisma.user.findUnique({
      where: {
        userID: dto.receiverID,
      },
    });

    if (!receiver) {
      throw new NotFoundException(`User with ID ${dto.receiverID} not found`);
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          {
            requesterID,
            receiverID: dto.receiverID,
          },
          {
            requesterID: dto.receiverID,
            receiverID: requesterID,
          },
        ],
      },
    });

    if (existing) {
      if (existing.status !== 'REJECTED') {
        throw new ConflictException('Friendship already exists');
      }
      await this.prisma.friendship.delete({ where: { friendshipID: existing.friendshipID } });
    }

    return this.prisma.friendship.create({
      data: {
        requesterID,
        receiverID: dto.receiverID,
      },
    });
  }

  async updateFriendship(
    userID: string,
    requesterID: string,
    receiverID: string,
    dto: UpdateFriendshipStatusDto,
  ) {
    const friendship = await this.prisma.friendship.findUnique({
      where: {
        requesterID_receiverID: {
          requesterID,
          receiverID,
        },
      },
    });

    if (!friendship) {
      throw new NotFoundException("Relation d'amitié introuvable.");
    }

    const isConcerned =
      friendship.requesterID === userID || friendship.receiverID === userID;

    if (!isConcerned) {
      throw new ForbiddenException(
        "Vous ne pouvez pas modifier une relation d'amitié qui ne vous concerne pas.",
      );
    }

    return this.prisma.friendship.update({
      where: {
        requesterID_receiverID: {
          requesterID,
          receiverID,
        },
      },
      data: {
        status: dto.status,
      },
    });
  }

  async removeFriendship(
    userID: string,
    requesterID: string,
    receiverID: string,
  ) {
    const friendship = await this.prisma.friendship.findUnique({
      where: {
        requesterID_receiverID: {
          requesterID,
          receiverID,
        },
      },
    });

    if (!friendship) {
      throw new NotFoundException("Relation d'amitié introuvable.");
    }

    const isConcerned =
      friendship.requesterID === userID || friendship.receiverID === userID;

    if (!isConcerned) {
      throw new ForbiddenException(
        "Vous ne pouvez pas supprimer une relation d'amitié qui ne vous concerne pas.",
      );
    }

    return this.prisma.friendship.delete({
      where: {
        requesterID_receiverID: {
          requesterID,
          receiverID,
        },
      },
    });
  }

  async saveRecipe(userID: string, recipeID: number) {
    await this.findOne(userID);

    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${recipeID} not found`);
    }

    const existing = await this.prisma.savedRecipe.findUnique({
      where: {
        userID_recipeID: {
          userID,
          recipeID,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Recipe already saved by this user');
    }

    return this.prisma.savedRecipe.create({
      data: {
        userID,
        recipeID,
      },
      include: {
        recipe: true,
      },
    });
  }

  async unsaveRecipe(userID: string, recipeID: number) {
    const existing = await this.prisma.savedRecipe.findUnique({
      where: {
        userID_recipeID: {
          userID,
          recipeID,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Saved recipe not found');
    }

    return this.prisma.savedRecipe.delete({
      where: {
        userID_recipeID: {
          userID,
          recipeID,
        },
      },
    });
  }

  async findSavedRecipes(userID: string) {
    await this.findOne(userID);

    return this.prisma.savedRecipe.findMany({
      where: { userID },
      include: {
        recipe: {
          include: {
            creator: true,
            steps: true,
            ingredients: {
              include: {
                ingredient: true,
                unit: true,
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
            reviews: true,
          },
        },
      },
      orderBy: {
        savedAt: 'desc',
      },
    });
  }

  async findMyFriends(userID: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterID: userID }, { receiverID: userID }],
      },
      include: { requester: true, receiver: true },
    });
    return friendships.map((f) =>
      f.requesterID === userID ? f.receiver : f.requester,
    );
  }

  async findMyInvitations(userID: string) {
    return this.prisma.friendship.findMany({
      where: { receiverID: userID, status: 'PENDING' },
      include: { requester: true },
    });
  }

  async findMySentRequests(userID: string) {
    return this.prisma.friendship.findMany({
      where: { requesterID: userID, status: 'PENDING' },
    });
  }

  async findRecipesByUser(userID: string, page = 1, limit = 20) {
    return this.prisma.recipe.findMany({
      where: { creatorID: userID },
      include: {
        creator: true,
        steps: { orderBy: { order: 'asc' as const } },
        ingredients: { include: { ingredient: true, unit: true } },
        tags: { include: { tag: true } },
        reviews: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async updateMyAvatar(userID: string, avatar: string) {
    if (!avatar.startsWith(`${userID}/`)) {
      throw new BadRequestException(
        "Le chemin de l'avatar ne correspond pas à l'utilisateur connecté.",
      );
    }

    return this.prisma.user.update({
      where: {
        userID,
      },
      data: {
        avatar,
      },
    });
  }

  async savePreferences(userID: string, tagNames: string[]) {
    // Verify user exists
    await this.findOne(userID);

    // Find or create tags by name
    const tags = await Promise.all(
      tagNames.map(async (tagName) => {
        return this.prisma.tag.findFirst({
          where: { name: tagName },
        });
      }),
    );

    // Filter out null tags (tags that don't exist in DB)
    const existingTags = tags.filter((tag) => tag !== null);

    if (existingTags.length === 0) {
      throw new NotFoundException('No existing tags found');
    }

    // Delete existing preferences
    await this.prisma.userPreference.deleteMany({
      where: { userID },
    });

    // Create new preferences
    const preferences = await this.prisma.userPreference.createMany({
      data: existingTags.map((tag) => ({
        userID,
        tagID: tag.tagID,
      })),
    });

    return {
      userID,
      preferencesCount: preferences.count,
      tags: existingTags,
    };
  }

  async getPreferences(userID: string) {
    // Verify user exists
    await this.findOne(userID);

    return this.prisma.userPreference.findMany({
      where: { userID },
      include: {
        tag: true,
      },
    });
  }
}
