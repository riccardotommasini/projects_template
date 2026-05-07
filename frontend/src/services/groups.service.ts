import { apiFetch } from './api.service'
import { Group } from '../types/group'

export const getMyGroups = async (): Promise<Group[]> =>
    apiFetch('/groups/me', { method: 'GET' })

export const getGroup = async (groupID: number): Promise<Group> =>
    apiFetch(`/groups/${groupID}`, { method: 'GET' })

export const createGroup = async (name: string, memberIDs: string[]): Promise<Group> =>
    apiFetch('/groups', {
        method: 'POST',
        body: JSON.stringify({ name, memberIDs }),
    })

export const updateGroup = async (groupID: number, name: string): Promise<Group> =>
    apiFetch(`/groups/${groupID}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
    })

export const addMember = async (groupID: number, userID: string): Promise<void> =>
    apiFetch(`/groups/${groupID}/members`, {
        method: 'POST',
        body: JSON.stringify({ userID }),
    })

export const addRecipeToGroup = async (groupID: number, recipeID: number): Promise<void> =>
    apiFetch(`/groups/${groupID}/recipes`, {
        method: 'POST',
        body: JSON.stringify({ recipeID }),
    })

export const removeRecipeFromGroup = async (groupID: number, recipeID: number): Promise<void> =>
    apiFetch(`/groups/${groupID}/recipes/${recipeID}`, { method: 'DELETE' })

export const leaveGroup = async (groupID: number): Promise<void> =>
    apiFetch(`/groups/${groupID}/members/me`, { method: 'DELETE' })
