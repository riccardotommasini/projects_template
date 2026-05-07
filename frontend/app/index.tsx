import { Redirect } from 'expo-router'
import { useAuth } from '@/src/hooks/useAuth'

export default function Index() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Redirect href="/(tabs)/profile" />
  return <Redirect href="/welcome" />
}

