import { apiFetch } from '@/src/config/api'
import { supabase } from '@/src/config/supabase';
import { CreateRecipeDTO, Recipe } from '../types/recipe'
import { uploadRecipePhoto } from './storage.service';

export type RecipeCreator = {
  userID: string
  pseudo: string
  firstName: string
  lastName: string
  avatar?: string | null
}

export type RecipeReview = {
  reviewID: number
  rating: number
  user: { userID: string; pseudo: string; avatar?: string | null }
}

export type RecipeComment = {
  commentID: number
  content: string
  createdAt: string
  user: { userID: string; pseudo: string; avatar?: string | null }
  replies: RecipeComment[]
  _count: { replies: number; reactions: number }
}

export type RecipeDetail = Recipe & {
  creator?: RecipeCreator
  savedBy?: Array<{ userID: string }>
  reviews?: RecipeReview[]
}

export type FeedRecipe = RecipeDetail & {
  creator: RecipeCreator
}

export type FeedResult = { recent: FeedRecipe[]; random: FeedRecipe[] }

export const getMyRecipes = async (page = 1, limit = 20): Promise<RecipeDetail[]> =>
  apiFetch(`/recipes/me?page=${page}&limit=${limit}`, { method: 'GET' })

export const getFeed = async (): Promise<FeedResult> =>
  apiFetch('/recipes/feed', { method: 'GET' })

export const getAllRecipes = async (): Promise<RecipeDetail[]> => {
  return await apiFetch('/recipes', { method: 'GET' });
};

export const getRecommendations = async (): Promise<{ recommendations: RecipeDetail[]; preferencesCount: number }> => {
  return await apiFetch('/recipes/recommendations', { method: 'GET' });
};

export const getRecipeById = async (recipeID: number): Promise<RecipeDetail> => {
  return await apiFetch(`/recipes/${recipeID}`, { method: 'GET' });
};

export const getSeedRecipeById = async (seedIndex: number): Promise<RecipeDetail> => {
  return await apiFetch(`/recipes/seed/${seedIndex}`, { method: 'GET' });
};

export const saveSeedRecipe = async (seedIndex: number): Promise<RecipeDetail> => {
  return await apiFetch(`/recipes/seed/${seedIndex}/save`, { method: 'POST' });
};

export const createRecipe = async (form: CreateRecipeDTO): Promise<Recipe> => {
  const recipe = await apiFetch('/recipes', {
    method: 'POST',
    body: JSON.stringify({
      name: form.name,
      portion: form.portions,
      prepTime: form.prepTime,
      cookTime: form.cookTime,
      description: form.description,
      ingredients: form.recipeIngredients,
      steps: form.steps,
      tagIDs: form.tagIDs || [],
    }),
  });

  if (!form.photoUri) {
    return recipe;
  }

  const { data } = await supabase.auth.getSession();
  const userID = data.session?.user.id;

  if (!userID) {
    throw new Error('Utilisateur non connecté.');
  }

  const photoPath = await uploadRecipePhoto(
    form.photoUri,
    userID,
    recipe.recipeID,
  );

  return await updateRecipePhoto(recipe.recipeID, photoPath);
};

export const updateRecipePhoto = async (
  recipeID: number,
  photo: string,
): Promise<Recipe> => {
  return await apiFetch(`/recipes/${recipeID}/photo`, {
    method: 'PATCH',
    body: JSON.stringify({
      photo,
    }),
  });
};

export const deleteRecipe = async (recipeID: number): Promise<void> => {
  await apiFetch(`/recipes/${recipeID}`, { method: 'DELETE' })
}

export const updateRecipe = async (
  recipeID: number,
  data: Partial<{
    name: string;
    prepTime: number;
    cookTime: number;
    description: string;
    portion: number;
    ingredients: any[];
    steps: any[];
    tagIDs: number[];
  }>
): Promise<Recipe> => {
  return await apiFetch(`/recipes/${recipeID}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const getRecipeComments = async (recipeID: number): Promise<RecipeComment[]> =>
  apiFetch(`/recipes/${recipeID}/comments`, { method: 'GET' })

export const addRecipeComment = async (recipeID: number, content: string, parentCommentID?: number): Promise<RecipeComment> =>
  apiFetch(`/recipes/${recipeID}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, parentCommentID }),
  })

export const deleteRecipeComment = async (commentID: number): Promise<void> =>
  apiFetch(`/recipes/comments/${commentID}`, { method: 'DELETE' })

export const addRecipeReview = async (recipeID: number, rating: number): Promise<RecipeReview> =>
  apiFetch(`/recipes/${recipeID}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  })

export const updateRecipeReview = async (reviewID: number, rating: number): Promise<RecipeReview> =>
  apiFetch(`/recipes/reviews/${reviewID}`, {
    method: 'PATCH',
    body: JSON.stringify({ rating }),
  })

export const deleteRecipeReview = async (reviewID: number): Promise<void> =>
  apiFetch(`/recipes/reviews/${reviewID}`, { method: 'DELETE' })
