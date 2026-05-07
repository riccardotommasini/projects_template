import { supabase } from '@/src/config/supabase'

export const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined');
}

export const apiFetch = async (path: string, options?: RequestInit) => {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || 'Erreur réseau')
  }

  const text = await response.text()
  return text.length > 0 ? JSON.parse(text) : undefined
}