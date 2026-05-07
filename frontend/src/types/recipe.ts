import { CreateRecipeIngredientDTO, RecipeIngredient } from "./recipeIngredient";
import { CreateStepDTO, Step } from './step'

export type Tag = {
    tagID: number
    name: string
}

export type Recipe = {
    recipeID: number;
    name: string;
    createdAt: string;
    prepTime: number;
    cookTime: number;
    photo?: string | null;
    portion: number;
    description?: string | null;
    ingredients: RecipeIngredient[];
    steps: Step[];
    tags?: { tag: Tag }[];
};

export type CreateRecipeDTO = {
    name: string
    portions: number
    prepTime: number
    cookTime: number
    steps: CreateStepDTO[]
    recipeIngredients: CreateRecipeIngredientDTO[]
    tagIDs: number[]
    description?: string
    photoUri?: string
}