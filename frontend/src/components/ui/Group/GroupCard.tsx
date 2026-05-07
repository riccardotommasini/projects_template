import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { ChevronRight, UsersRound, CookingPot } from "lucide-react-native";
import { Colors } from "../../../constants/colors";
import { FontSize, FontWeight } from "../../../constants/typography";
import { groupColor } from "@/src/utils/groupColor";

type GroupCardProps = {
    name: string
    membersCount: number
    recipesCount: number
    onPress?: () => void
}

export default function GroupCard({ name, membersCount, recipesCount, onPress }: GroupCardProps) {
    const bg = groupColor(name)
    const initial = name.trim()[0]?.toUpperCase() ?? '?'

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
            {/* Initiale colorée */}
            <View style={[styles.avatar, { backgroundColor: bg }]}>
                <Text style={styles.avatarText}>{initial}</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.title} numberOfLines={1}>{name}</Text>
                <View style={styles.infoRow}>
                    <View style={styles.info}>
                        <UsersRound size={14} color={Colors.primaryMuted} />
                        <Text style={styles.infoText}>{membersCount}</Text>
                    </View>
                    <View style={styles.info}>
                        <CookingPot size={14} color={Colors.primaryMuted} />
                        <Text style={styles.infoText}>{recipesCount}</Text>
                    </View>
                </View>
            </View>

            <ChevronRight size={20} color={Colors.border} />
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 14,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 2,
    },
    avatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    content: { flex: 1 },
    title: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    infoRow: { flexDirection: 'row', gap: 14 },
    info: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    infoText: {
        fontSize: FontSize.sm,
        color: Colors.primaryMuted,
        fontWeight: FontWeight.medium,
    },
})
