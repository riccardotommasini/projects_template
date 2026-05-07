import { apiFetch } from '@/src/config/api'
import { Tag } from '../types/recipe'

export async function getTags(): Promise<Tag[]> {
    return apiFetch('/tags', { method: 'GET' })
}
