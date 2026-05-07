export type Step = {
    stepID: number
    text: string
    order: number
    recipeID: number
}

export type CreateStepDTO = {
    text: string
    order: number
}