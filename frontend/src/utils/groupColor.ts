export const GROUP_PALETTE = ['#FFE6CF', '#E2F9F7', '#E9FADB', '#F0CAA7', '#FBE9DC', '#EEE0FF']

export function groupColor(name: string): string {
    let hash = 0
    for (let i = 0; i < name.length; i++)
        hash = (hash * 31 + name.charCodeAt(i)) % GROUP_PALETTE.length
    return GROUP_PALETTE[Math.abs(hash)]
}
