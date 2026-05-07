import { Ingredient } from "./ingredient";

export type RecipeIngredient = {
    ingredientID: number
    unitID: number | null
    ingredient: Ingredient
    unit: { unitID: number; type: string } | null
    quantity: number
};

export type CreateRecipeIngredientDTO = {
    ingredientID: number
    quantity: number
    unitID: number
}