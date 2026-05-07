export type Ingredient = {
    ingredientID: number;
    name: string;
    category: string;
    calories: number;
    unitDefault: string;
    price?: number | null;
    nutritionalScore?: string | null;
};