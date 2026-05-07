import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface SeedRecipe {
  name: string;
  description: string;
  portion: number;
  price: number;
  prepTime: number;
  cookTime: number;
  nutritionalScore: number;
  photo: string;
  tags: string[];
  steps: Array<{ order: number; text: string }>;
  ingredients: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
  }>;
}

interface SeedData {
  recipes: SeedRecipe[];
  tags: Array<{ name: string }>;
}

@Injectable()
export class SeedRecipesService {
  private readonly logger = new Logger(SeedRecipesService.name);
  private seedData: SeedData | null = null;

  constructor() {
    this.loadSeedData();
  }

  private loadSeedData() {
    try {
      const filePath = path.join(__dirname, '../../data/seed-recipes.json');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.seedData = JSON.parse(fileContent);
      if (this.seedData) {
        this.logger.log(
          `Seed data loaded successfully (${this.seedData.recipes.length} recipes)`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to load seed recipes:', error);
      this.seedData = { recipes: [], tags: [] };
    }
  }

  /**
   * Get all seed recipes
   */
  getAllRecipes(): SeedRecipe[] {
    return this.seedData?.recipes || [];
  }

  /**
   * Filter recipes by tags (user preferences)
   * Returns recipes that have at least one tag matching the user's preferences
   */
  getRecommendations(userTagNames: string[]): SeedRecipe[] {
    if (!userTagNames || userTagNames.length === 0) {
      // If no preferences, return all recipes
      return this.getAllRecipes();
    }

    const tagSet = new Set(userTagNames.map((tag) => tag.toLowerCase()));

    return this.getAllRecipes().filter((recipe) => {
      // Check if recipe has any tags matching user preferences
      return recipe.tags.some((tag) => tagSet.has(tag.toLowerCase()));
    });
  }

  /**
   * Get all available tags from seed data
   */
  getAllTags() {
    return this.seedData?.tags || [];
  }
}
