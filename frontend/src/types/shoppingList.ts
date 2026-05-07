import { Ingredient } from './ingredient'

export type ShoppingItem = {
    itemID: number
    name: string
    quantity?: number
    checked: boolean
    listID: number
    ingredientID?: number
    unitID?: number
    ingredient?: Ingredient
    unit?: { unitID: number; type: string }
}

export type ShoppingList = {
    listID: number
    name: string
    userID?: string
    groupID?: number
    items: ShoppingItem[]
}

export type CreateShoppingItemDTO = {
    name: string
    quantity?: number
    listID: number
    ingredientID?: number
    unitID?: number
}

export type UpdateShoppingItemDTO = Partial<CreateShoppingItemDTO>