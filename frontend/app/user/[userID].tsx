import { useLocalSearchParams } from 'expo-router'
import UserProfileScreen from '@/src/screens/UserProfileScreen'

export default function UserRoute() {
    const { userID, pseudo, firstName, lastName, avatar } = useLocalSearchParams<{
        userID: string
        pseudo: string
        firstName: string
        lastName: string
        avatar?: string
    }>()

    return (
        <UserProfileScreen
            userID={userID}
            pseudo={pseudo}
            firstName={firstName}
            lastName={lastName}
            avatar={avatar || null}
        />
    )
}
