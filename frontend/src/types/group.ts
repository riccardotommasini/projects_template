import { RecipeDetail } from '../services/recipes.service'

export type GroupUser = {
    userID: string
    pseudo: string
    firstName: string
    lastName: string
    avatar?: string | null
}

export type GroupMember = {
    groupID: number
    userID: string
    user: GroupUser
}

export type GroupRecipe = {
    groupID: number
    recipeID: number
    recipe: RecipeDetail
}

export type Group = {
    groupID: number
    name: string
    members: GroupMember[]
    recipes: GroupRecipe[]
    shoppingList?: { listID: number } | null
}
