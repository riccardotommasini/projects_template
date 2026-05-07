import { useLocalSearchParams } from 'expo-router'
import GroupDetailScreen from '@/src/screens/GroupDetailScreen'

export default function GroupDetailPage() {
    const { groupID } = useLocalSearchParams<{ groupID: string }>()
    return <GroupDetailScreen groupID={Number(groupID)} />
}
