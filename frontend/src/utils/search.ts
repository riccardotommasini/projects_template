export function normalize(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0153/gi, 'oe')
        .replace(/\u00e6/gi, 'ae')
        .toLowerCase()
}

export function sortByMatch<T>(items: T[], query: string, getText: (item: T) => string): T[] {
    const q = normalize(query)
    if (!q) return items
    return items
        .filter(item => normalize(getText(item)).includes(q))
        .sort((a, b) => {
            const aStarts = normalize(getText(a)).startsWith(q)
            const bStarts = normalize(getText(b)).startsWith(q)
            return aStarts === bStarts ? 0 : aStarts ? -1 : 1
        })
}
