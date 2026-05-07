import { apiFetch } from './api.service';
import type { Recipe } from '../types/recipe';
import type { RecipeCreator } from './recipes.service';

export type User = {
  userID: string;
  email: string;
  firstName: string;
  lastName: string;
  pseudo: string;
  avatar?: string | null;
};

export async function getUsers(): Promise<User[]> {
  return apiFetch('/users', {
    method: 'GET',
  });
}

export async function getMe(): Promise<User> {
  return apiFetch('/users/me', {
    method: 'GET',
  });
}

export async function updateMyAvatar(avatar: string): Promise<User> {
  return apiFetch('/users/me/avatar', {
    method: 'PATCH',
    body: JSON.stringify({ avatar }),
  });
}

export async function updateMe(data: {
  firstName?: string
  lastName?: string
  pseudo?: string
}): Promise<User> {
  return apiFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteMe(): Promise<void> {
  await apiFetch('/users/me', { method: 'DELETE' });
}

export async function getTags(): Promise<{ tagID: number; name: string }[]> {
  return apiFetch('/tags', { method: 'GET' });
}

export async function getUserRecipes(userID: string, page = 1, limit = 20): Promise<Recipe[]> {
  return apiFetch(`/users/${userID}/recipes?page=${page}&limit=${limit}`, { method: 'GET' });
}

export type SavedRecipeItem = {
  userID: string
  recipeID: number
  savedAt: string
  recipe: Recipe & { creator: RecipeCreator }
}

export async function getMySavedRecipes(): Promise<SavedRecipeItem[]> {
  return apiFetch('/users/me/saved-recipes', { method: 'GET' });
}

export async function saveRecipe(recipeID: number): Promise<void> {
  await apiFetch('/users/me/saved-recipes', {
    method: 'POST',
    body: JSON.stringify({ recipeID }),
  });
}

export async function unsaveRecipe(recipeID: number): Promise<void> {
  await apiFetch(`/users/me/saved-recipes/${recipeID}`, { method: 'DELETE' });
}

export async function saveUserPreferences(tagNames: string[]): Promise<any> {
  return apiFetch('/users/me/preferences', {
    method: 'POST',
    body: JSON.stringify({ tagNames }),
  });
}

export async function getMyPreferences(): Promise<any> {
  return apiFetch('/users/me/preferences', { method: 'GET' });
}