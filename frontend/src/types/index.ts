// EXEMPLE TEMPORAIRE, A CHANGER EN FONCTION DES BESOINS

export interface User {
    id: string
    email: string
    username: string
}

export interface Recipe {
    id: string
    title: string
    description: string
    authorId: string
    teamId?: string
}

export interface ShoppingList {
    id: string
    name: string
    teamId: string
    items: ShoppingItem[]
}

export interface ShoppingItem {
    id: string
    name: string
    checked: boolean
}