import { apiFetch } from "@/src/config/api";
import type { Ingredient } from "@/src/types/ingredient";

export const searchIngredients = async (search: string): Promise<Ingredient[]> => {
    return await apiFetch(`/ingredients?search=${encodeURIComponent(search)}`)
}

