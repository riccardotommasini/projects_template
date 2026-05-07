import { useState, useEffect } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { Colors, FontWeight } from '@/src/constants'
import { getSignedAvatarUrl } from '@/src/services/storage.service'

type Props = {
    user: { pseudo: string; avatar?: string | null }
    size?: number
}

export default function UserAvatar({ user, size = 40 }: Props) {
    const [url, setUrl] = useState<string | null>(null)

    useEffect(() => {
        if (!user.avatar) return
        if (user.avatar.startsWith('http')) { setUrl(user.avatar); return }
        getSignedAvatarUrl(user.avatar).then(setUrl).catch(() => {})
    }, [user.avatar])

    const s = { width: size, height: size, borderRadius: size / 2 }

    if (url) return <Image source={{ uri: url }} style={s} />
    return (
        <View style={[s, styles.fallback]}>
            <Text style={[styles.initial, { fontSize: size * 0.38 }]}>
                {user.pseudo[0]?.toUpperCase()}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create({
    fallback: {
        backgroundColor: Colors.cardLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initial: {
        fontWeight: FontWeight.bold,
        color: Colors.primaryLight,
    },
})
