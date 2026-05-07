export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export type Friendship = {
    requesterID: string
    receiverID: string
    status: FriendshipStatus
    createdAt: string
}

export type FriendUser = {
    userID: string
    pseudo: string
    firstName: string
    lastName: string
    avatar?: string | null
}

export type InvitationWithUser = Friendship & {
    user: FriendUser
}
