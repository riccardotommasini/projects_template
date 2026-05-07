let pending: number | null = null
export const setPendingListID = (id: number) => { pending = id }
export const consumePendingListID = (): number | null => { const id = pending; pending = null; return id }
