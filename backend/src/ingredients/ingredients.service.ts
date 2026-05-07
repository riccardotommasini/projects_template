import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from '../recipes/dto/create-recipe.dto';
import { UpdateRecipeDto } from '../recipes/dto/update-recipe.dto';
import { CreateReviewDto } from '../recipes/dto/create-review.dto';
import { UpdateReviewDto } from '../recipes/dto/update-review.dto';
import { CreateStepDto } from '../recipes/dto/create-step.dto';
import { UpdateStepDto } from '../recipes/dto/update-step.dto';
import { AddRecipeIngredientDto } from '../recipes/dto/add-recipe-ingredient.dto';
import { AddRecipeTagDto } from '../recipes/dto/add-recipe-tag.dto';
import { CreateRecipeCommentDto } from '../recipes/dto/create-recipe-comment.dto';
import { UpdateRecipeCommentDto } from '../recipes/dto/update-recipe-comment.dto';
import { UpsertCommentReactionDto } from '../recipes/dto/upsert-comment-reaction.dto';




@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}


  private readonly recipeInclude = {
    creator: true,
    savedBy: {
      include: {
        user: true,
      },
    },
    steps: {
      orderBy: {
        order: 'asc' as const,
      },
    },
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
    reviews: {
      include: {
        user: true,
      },
    },
    groups: true,
  };


  private readonly publicUserSelect = {
    userID: true,
    pseudo: true,
    avatar: true,
  };


  private async assertRecipeOwner(userID: string, recipeID: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID },
      select: {
        recipeID: true,
        creatorID: true,
      },
    });


    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${recipeID} not found`);
    }


    if (recipe.creatorID !== userID) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres recettes.',
      );
    }


    return recipe;
  }


  private async assertStepOwner(userID: string, stepID: number) {
    const step = await this.prisma.step.findUnique({
      where: { stepID },
      select: {
        stepID: true,
        recipeID: true,
        recipe: {
          select: {
            creatorID: true,
          },
        },
      },
    });


    if (!step) {
      throw new NotFoundException(`Step with ID ${stepID} not found`);
    }


    if (step.recipe.creatorID !== userID) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que les étapes de vos propres recettes.',
      );
    }


    return step;
  }


  async create(userID: string, createRecipeDto: CreateRecipeDto) {
    const { steps, ingredients, tagIDs, ...recipeData } =
      createRecipeDto;


    return this.prisma.recipe.create({
      data: {
        ...recipeData,
        description: recipeData.description ?? '',

        creator: {
          connect: { userID },
        },


        steps: steps
          ? {
              create: steps.map((step) => ({
                text: step.text,
                order: step.order,
              })),
            }
          : undefined,


        ingredients: ingredients
          ? {
              create: ingredients.map((recipeIngredient) => ({
                quantity: recipeIngredient.quantity,
                ingredient: {
                  connect: { ingredientID: recipeIngredient.ingredientID },
                },
                unit: {
                  connect: { unitID: recipeIngredient.unitID },
                },
              })),
            }
          : undefined,


        tags: tagIDs
          ? {
              create: tagIDs.map((tagID) => ({
                tag: {
                  connect: { tagID },
                },
              })),
            }
          : undefined,
      },
      include: this.recipeInclude,
    });
  }


  async findAll() {
    return this.prisma.recipe.findMany({
      include: this.recipeInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }


  async findOne(recipeID: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID },
      include: this.recipeInclude,
    });


    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${recipeID} not found`);
    }


    return recipe;
  }


  async update(
    userID: string,
    recipeID: number,
    updateRecipeDto: UpdateRecipeDto,
  ) {
  await this.assertRecipeOwner(userID, recipeID);


    const { steps, ingredients, tagIDs, ...recipeData } = updateRecipeDto;


    return this.prisma.recipe.update({
      where: { recipeID },
      data: {
        ...recipeData,


        steps: steps
          ? {
              deleteMany: {},
              create: steps.map((step) => ({
                text: step.text,
                order: step.order,
              })),
            }
          : undefined,


        ingredients: ingredients
          ? {
              deleteMany: {},
              create: ingredients.map((recipeIngredient) => ({
                quantity: recipeIngredient.quantity,
                ingredient: {
                  connect: { ingredientID: recipeIngredient.ingredientID },
                },
                unit: {
                  connect: { unitID: recipeIngredient.unitID },
                },
              })),
            }
          : undefined,


        tags: tagIDs
          ? {
              deleteMany: {},
              create: tagIDs.map((tagID) => ({
                tag: {
                  connect: { tagID },
                },
              })),
            }
          : undefined,
      },
      include: this.recipeInclude,
    });
  }


  async remove(userID: string, recipeID: number) {
    await this.assertRecipeOwner(userID, recipeID);


    return this.prisma.recipe.delete({
      where: { recipeID },
    });
  }


  async addStep(userID: string, recipeID: number, createStepDto: CreateStepDto) {
    await this.assertRecipeOwner(userID, recipeID);


    return this.prisma.step.create({
      data: {
        text: createStepDto.text,
        order: createStepDto.order,
        recipeID,
      },
    });
  }


  async updateStep(userID: string, stepID: number, updateStepDto: UpdateStepDto) {
    await this.assertStepOwner(userID, stepID);


    return this.prisma.step.update({
      where: { stepID },
      data: updateStepDto,
    });
  }


  async removeStep(userID: string, stepID: number) {
    await this.assertStepOwner(userID, stepID);


    return this.prisma.step.delete({
      where: { stepID },
    });
  }


  async addIngredient(
    userID: string,
    recipeID: number,
    addRecipeIngredientDto: AddRecipeIngredientDto,
  ) {
    await this.assertRecipeOwner(userID, recipeID);


    const existingIngredient = await this.prisma.recipeIngredient.findUnique({
      where: {
        recipeID_ingredientID: {
          recipeID,
          ingredientID: addRecipeIngredientDto.ingredientID,
        },
      },
    });


    if (existingIngredient) {
      throw new ConflictException('Ingredient is already in this recipe');
    }


    return this.prisma.recipeIngredient.create({
      data: {
        recipeID,
        ingredientID: addRecipeIngredientDto.ingredientID,
        quantity: addRecipeIngredientDto.quantity,
        unitID: addRecipeIngredientDto.unitID,
      },
      include: {
        ingredient: true,
        unit: true,
      },
    });
  }


  async removeIngredient(userID: string, recipeID: number, ingredientID: number) {


    await this.assertRecipeOwner(userID, recipeID);


    const existingIngredient = await this.prisma.recipeIngredient.findUnique({
      where: {
        recipeID_ingredientID: {
          recipeID,
          ingredientID,
        },
      },
    });


    if (!existingIngredient) {
      throw new NotFoundException('Ingredient is not in this recipe');
    }


    return this.prisma.recipeIngredient.delete({
      where: {
        recipeID_ingredientID: {
          recipeID,
          ingredientID,
        },
      },
    });
  }


  async addTag(userID: string, recipeID: number, addRecipeTagDto: AddRecipeTagDto) {
    await this.assertRecipeOwner(userID, recipeID);


    const existingTag = await this.prisma.recipeTag.findUnique({
      where: {
        recipeID_tagID: {
          recipeID,
          tagID: addRecipeTagDto.tagID,
        },
      },
    });


    if (existingTag) {
      throw new ConflictException('Tag is already linked to this recipe');
    }


    return this.prisma.recipeTag.create({
      data: {
        recipeID,
        tagID: addRecipeTagDto.tagID,
      },
      include: {
        tag: true,
      },
    });
  }


  async removeTag(userID: string, recipeID: number, tagID: number) {
    await this.assertRecipeOwner(userID, recipeID);
   
    const existingTag = await this.prisma.recipeTag.findUnique({
      where: {
        recipeID_tagID: {
          recipeID,
          tagID,
        },
      },
    });


    if (!existingTag) {
      throw new NotFoundException('Tag is not linked to this recipe');
    }


    return this.prisma.recipeTag.delete({
      where: {
        recipeID_tagID: {
          recipeID,
          tagID,
        },
      },
    });
  }


  async addReview(
    userID: string,
    recipeID: number,
    createReviewDto: CreateReviewDto,
  ) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID },
      select: { recipeID: true },
    });


    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${recipeID} not found`);
    }


    const existingReview = await this.prisma.review.findUnique({
      where: {
        userID_recipeID: {
          userID,
          recipeID,
        },
      },
    });


    if (existingReview) {
      throw new ConflictException('User has already reviewed this recipe');
    }


    return this.prisma.review.create({
      data: {
        rating: createReviewDto.rating,
        recipeID,
        userID,
      },
      include: {
        user: true,
        recipe: true,
      },
    });
  }


  async updateReview(userID: string, reviewID: number, updateReviewDto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { reviewID },
      select: {
        reviewID: true,
        userID: true,
      },
    });


    if (!review) {
      throw new NotFoundException(`Review with ID ${reviewID} not found`);
    }


    if (review.userID !== userID) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres avis.',
      );
    }


    return this.prisma.review.update({
      where: { reviewID },
      data: updateReviewDto,
    });
  }


  async removeReview(userID: string, reviewID: number) {
    const review = await this.prisma.review.findUnique({
      where: { reviewID },
      select: {
        reviewID: true,
        userID: true,
      },
    });


    if (!review) {
      throw new NotFoundException(`Review with ID ${reviewID} not found`);
    }


    if (review.userID !== userID) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres avis.',
      );
    }


    return this.prisma.review.delete({
      where: { reviewID },
    });
  }


  async updateRecipePhoto(userID: string, recipeID: number, photo: string) {
    await this.assertRecipeOwner(userID, recipeID);


    const expectedPrefix = `${userID}/${recipeID}/`;


    if (!photo.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        "Le chemin de la photo ne correspond pas à la recette ou à l'utilisateur connecté.",
      );
    }


    return this.prisma.recipe.update({
      where: {
        recipeID,
      },
      data: {
        photo,
      },
      include: this.recipeInclude,
    });
  }


  findMine(userID: string) {
    return this.prisma.recipe.findMany({
      where: {
        creatorID: userID,
      },
      include: this.recipeInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }


  async findFeed(userID: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterID: userID }, { receiverID: userID }],
      },
      select: { requesterID: true, receiverID: true },
    });


    const friendIDs = friendships.map(f =>
      f.requesterID === userID ? f.receiverID : f.requesterID,
    );


    if (friendIDs.length === 0) return { recent: [], random: [] };


    const all = await this.prisma.recipe.findMany({
      where: { creatorID: { in: friendIDs } },
      include: this.recipeInclude,
      orderBy: { createdAt: 'desc' },
    });


    const RECENT = 10;
    const recent = all.slice(0, RECENT);
    const random = all.slice(RECENT).sort(() => Math.random() - 0.5);


    return { recent, random };
  }


  async findComments(recipeID: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID },
      select: { recipeID: true },
    });


    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${recipeID} not found`);
    }


    return this.prisma.recipeComment.findMany({
      where: {
        recipeID,
        parentCommentID: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: this.publicUserSelect,
        },
        replies: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            user: {
              select: this.publicUserSelect,
            },
            _count: {
              select: {
                reactions: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
            reactions: true,
          },
        },
      },
    });
  }


  async addComment(
    userID: string,
    recipeID: number,
    dto: CreateRecipeCommentDto,
  ) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID },
      select: { recipeID: true },
    });


    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${recipeID} not found`);
    }


    if (dto.parentCommentID) {
      const parentComment = await this.prisma.recipeComment.findUnique({
        where: { commentID: dto.parentCommentID },
        select: {
          commentID: true,
          recipeID: true,
          parentCommentID: true,
        },
      });


      if (!parentComment) {
        throw new NotFoundException(
          `Comment with ID ${dto.parentCommentID} not found`,
        );
      }


      if (parentComment.recipeID !== recipeID) {
        throw new BadRequestException(
          'Vous ne pouvez pas répondre à un commentaire d’une autre recette.',
        );
      }


      if (parentComment.parentCommentID !== null) {
        throw new BadRequestException(
          'Vous ne pouvez répondre qu’à un commentaire principal.',
        );
      }
    }


    return this.prisma.recipeComment.create({
      data: {
        content: dto.content,
        recipeID,
        userID,
        parentCommentID: dto.parentCommentID,
      },
      include: {
        user: {
          select: this.publicUserSelect,
        },
        _count: {
          select: {
            replies: true,
            reactions: true,
          },
        },
      },
    });
  }


  async updateComment(
    userID: string,
    commentID: number,
    dto: UpdateRecipeCommentDto,
  ) {
    const comment = await this.prisma.recipeComment.findUnique({
      where: { commentID },
      select: {
        commentID: true,
        userID: true,
      },
    });


    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentID} not found`);
    }


    if (comment.userID !== userID) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres commentaires.',
      );
    }


    return this.prisma.recipeComment.update({
      where: { commentID },
      data: {
        content: dto.content,
      },
      include: {
        user: {
          select: this.publicUserSelect,
        },
      },
    });
  }


  async removeComment(userID: string, commentID: number) {
    const comment = await this.prisma.recipeComment.findUnique({
      where: { commentID },
      select: {
        commentID: true,
        userID: true,
        recipe: {
          select: {
            creatorID: true,
          },
        },
      },
    });


    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentID} not found`);
    }


    const isCommentAuthor = comment.userID === userID;
    const isRecipeCreator = comment.recipe.creatorID === userID;


    if (!isCommentAuthor && !isRecipeCreator) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos commentaires ou les commentaires sur vos recettes.',
      );
    }


    return this.prisma.recipeComment.delete({
      where: { commentID },
    });
  }


  async upsertCommentReaction(
    userID: string,
    commentID: number,
    dto: UpsertCommentReactionDto,
  ) {
    const comment = await this.prisma.recipeComment.findUnique({
      where: { commentID },
      select: { commentID: true },
    });


    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentID} not found`);
    }


    return this.prisma.commentReaction.upsert({
      where: {
        commentID_userID: {
          commentID,
          userID,
        },
      },
      update: {
        type: dto.type,
      },
      create: {
        commentID,
        userID,
        type: dto.type,
      },
    });
  }


  async removeCommentReaction(userID: string, commentID: number) {
    const reaction = await this.prisma.commentReaction.findUnique({
      where: {
        commentID_userID: {
          commentID,
          userID,
        },
      },
    });


    if (!reaction) {
      throw new NotFoundException('Reaction not found');
    }


    return this.prisma.commentReaction.delete({
      where: {
        commentID_userID: {
          commentID,
          userID,
        },
      },
    });
  }
}





