import { apiFetch } from '@/src/config/api'
import { Unit } from '@/src/types/unit'

export const getUnits = async (): Promise<Unit[]> => {
    return await apiFetch('/units')
}