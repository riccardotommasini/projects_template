import { apiFetch } from './api.service'
import { Friendship, FriendUser, InvitationWithUser } from '../types/friend'

export type MyRelations = {
    myID: string
    friends: FriendUser[]
    invitations: InvitationWithUser[]
    sentPending: Friendship[]
}

export async function getMyRelations(): Promise<MyRelations> {
    const [meRes, friendsRes, invitationsRes, sentRes] = await Promise.allSettled([
        apiFetch('/users/me', { method: 'GET' }),
        apiFetch('/users/me/friends', { method: 'GET' }),
        apiFetch('/users/me/invitations', { method: 'GET' }),
        apiFetch('/users/me/sent-requests', { method: 'GET' }),
    ])

    if (meRes.status === 'rejected') throw meRes.reason

    const me = meRes.value as any
    const friends = friendsRes.status === 'fulfilled' ? (friendsRes.value as FriendUser[]) : []
    const rawInvitations = invitationsRes.status === 'fulfilled' ? (invitationsRes.value as any[]) : []
    const sentPending = sentRes.status === 'fulfilled' ? (sentRes.value as Friendship[]) : []

    return {
        myID: me.userID,
        friends,
        invitations: rawInvitations.map(inv => ({ ...inv, user: inv.requester })),
        sentPending,
    }
}

export async function searchUsers(query: string): Promise<FriendUser[]> {
    return apiFetch(`/users?search=${encodeURIComponent(query)}`, { method: 'GET' })
}

export async function sendFriendRequest(receiverID: string): Promise<void> {
    await apiFetch('/users/me/friendships', {
        method: 'POST',
        body: JSON.stringify({ receiverID }),
    })
}

export async function acceptFriendship(requesterID: string, receiverID: string): Promise<void> {
    await apiFetch(`/users/friendships/${requesterID}/${receiverID}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACCEPTED' }),
    })
}

export async function rejectFriendship(requesterID: string, receiverID: string): Promise<void> {
    await apiFetch(`/users/friendships/${requesterID}/${receiverID}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'REJECTED' }),
    })
}

export async function removeFriendship(requesterID: string, receiverID: string): Promise<void> {
    await apiFetch(`/users/friendships/${requesterID}/${receiverID}`, { method: 'DELETE' })
}
