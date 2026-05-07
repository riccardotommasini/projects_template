import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto';
import { CreateShoppingItemDto } from './dto/create-shopping-item.dto';
import { UpdateShoppingItemDto } from './dto/update-shopping-item.dto';

@Injectable()
export class ShoppingListsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    items: {
      include: {
        ingredient: true,
        unit: true,
      },
    },
    user: true,
    group: true,
  };

  private async assertCanAccessShoppingList(userID: string, listID: number) {
    const shoppingList = await this.prisma.shoppingList.findUnique({
      where: { listID },
      include: {
        ...this.include,
        group: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!shoppingList) {
      throw new NotFoundException('Liste de courses introuvable.');
    }

    const isPersonalListOwner = shoppingList.userID === userID;

    const isGroupMember =
      shoppingList.group?.members.some((member) => member.userID === userID) ??
      false;

    if (!isPersonalListOwner && !isGroupMember) {
      throw new ForbiddenException(
        "Vous n'avez pas accès à cette liste de courses.",
      );
    }

    return shoppingList;
  }

  private async assertCanAccessShoppingItem(userID: string, itemID: number) {
    const item = await this.prisma.shoppingItem.findUnique({
      where: { itemID },
      select: {
        itemID: true,
        listID: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${itemID} not found`);
    }

    await this.assertCanAccessShoppingList(userID, item.listID);

    return item;
  }

  /*
  async create(userID: string, createShoppingListDto: CreateShoppingListDto) {
    return this.prisma.shoppingList.create({
      data: createShoppingListDto,
      include: this.include,
    });
  }
    */

  /*
  async findAll() {
    return this.prisma.shoppingList.findMany({
      include: this.include,
    });
  }
    */

  async findOne(userID: string, listID: number) {
    return this.assertCanAccessShoppingList(userID, listID);
  }

  async update(
    userID: string,
    listID: number,
    updateShoppingListDto: UpdateShoppingListDto,
  ) {
    await this.assertCanAccessShoppingList(userID, listID);

    return this.prisma.shoppingList.update({
      where: { listID },
      data: {
        name: updateShoppingListDto.name,
      },
      include: this.include,
    });
  }

  /*
  async remove(listID: number) {
    await this.findOne(listID);

    return this.prisma.shoppingList.delete({
      where: { listID },
    });
  }
  */

  async addItem(
    userID: string,
    listID: number,
    createShoppingItemDto: CreateShoppingItemDto,
  ) {
    await this.assertCanAccessShoppingList(userID, listID);

    return this.prisma.shoppingItem.create({
      data: {
        name: createShoppingItemDto.name,
        quantity: createShoppingItemDto.quantity,
        checked: createShoppingItemDto.checked ?? false,
        listID,
        ingredientID: createShoppingItemDto.ingredientID,
        unitID: createShoppingItemDto.unitID,
      },
      include: {
        ingredient: true,
        unit: true,
      },
    });
  }

  async updateItem(
    userID: string,
    itemID: number,
    updateShoppingItemDto: UpdateShoppingItemDto,
  ) {
    await this.assertCanAccessShoppingItem(userID, itemID);

    return this.prisma.shoppingItem.update({
      where: { itemID },
      data: {
        name: updateShoppingItemDto.name,
        quantity: updateShoppingItemDto.quantity,
        checked: updateShoppingItemDto.checked,
        ingredientID: updateShoppingItemDto.ingredientID,
        unitID: updateShoppingItemDto.unitID,
      },
      include: {
        ingredient: true,
        unit: true,
      },
    });
  }

  async removeItem(userID: string, itemID: number) {
    await this.assertCanAccessShoppingItem(userID, itemID);

    return this.prisma.shoppingItem.delete({
      where: { itemID },
    });
  }

  async toggleItem(userID: string, itemID: number) {
    await this.assertCanAccessShoppingItem(userID, itemID);

    const item = await this.prisma.shoppingItem.findUnique({
      where: { itemID },
      select: {
        itemID: true,
        checked: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${itemID} not found`);
    }

    return this.prisma.shoppingItem.update({
      where: { itemID },
      data: {
        checked: !item.checked,
      },
      include: {
        ingredient: true,
        unit: true,
      },
    });
  }

  async findMine(userID: string) {
    const shoppingList = await this.prisma.shoppingList.findUnique({
      where: {
        userID,
      },
      include: this.include,
    });

    if (!shoppingList) {
      throw new NotFoundException(
        'Liste de courses personnelle introuvable pour cet utilisateur.',
      );
    }

    return shoppingList;
  }

  async importRecipe(userID: string, listID: number, recipeID: number) {
    // Récupère la liste ciblée avec son groupe pour vérifier les droits d'accès.
    await this.assertCanAccessShoppingList(userID, listID);

    // Récupère la recette avec ses ingrédients pour les convertir en items.
    const recipe = await this.prisma.recipe.findUnique({
      where: {
        recipeID,
      },
      include: {
        ingredients: {
          include: {
            ingredient: true,
            unit: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recette introuvable.');
    }

    if (recipe.ingredients.length === 0) {
      return this.findOne(userID, listID);
    }

    // Ajoute chaque ingrédient de la recette dans la liste de courses.
    await this.prisma.shoppingItem.createMany({
      data: recipe.ingredients.map((recipeIngredient) => ({
        listID,
        name: recipeIngredient.ingredient.name,
        ingredientID: recipeIngredient.ingredientID,
        unitID: recipeIngredient.unitID,
        quantity: recipeIngredient.quantity,
        checked: false,
      })),
    });

    // Retourne la liste mise à jour pour rafraîchir le frontend.
    return this.findOne(userID, listID);
  }
}
