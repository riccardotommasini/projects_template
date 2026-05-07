import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { ChefHat, UsersRound, Mail } from "lucide-react-native";
import { Colors } from "../../../constants/colors";
import { FontSize, FontWeight } from "../../../constants/typography";
import type { ReactNode } from "react";

type ProfileDescriptionProps = {
    avatarUrl: string;
    username: string;
    bio: string;
    recipesCount: number;
    friendsCount: number;
    pendingCount: number;
    onPressFriends?: () => void;
    onPressInvitations?: () => void;
};

export default function ProfileDescription({
    avatarUrl,
    username,
    bio,
    recipesCount,
    friendsCount,
    pendingCount,
    onPressFriends,
    onPressInvitations,
}: ProfileDescriptionProps) {
    return (
        <View>
            <View style={styles.header}>
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                <View style={styles.headerText}>
                    <Text style={styles.username}>@{username}</Text>
                    <Text style={styles.bio}>{bio}</Text>
                </View>
            </View>

            <View style={styles.statsRow}>
                <StatCard
                    icon={<ChefHat size={26} color={Colors.textPrimary} />}
                    value={String(recipesCount)}
                    label="recettes"
                />
                <StatCard
                    icon={<UsersRound size={26} color={Colors.textPrimary} />}
                    value={String(friendsCount)}
                    label="amis"
                    onPress={onPressFriends}
                />
                <StatCard
                    icon={<Mail size={26} color={Colors.textPrimary} />}
                    value=""
                    label="en attente"
                    badge={pendingCount > 0 ? String(pendingCount) : undefined}
                    onPress={onPressInvitations}
                />
            </View>
        </View>
    );
}

function StatCard({
    icon,
    value,
    label,
    badge,
    onPress,
}: {
    icon: ReactNode;
    value: string;
    label: string;
    badge?: string;
    onPress?: () => void;
}) {
    return (
        <TouchableOpacity
            style={styles.statCard}
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
            disabled={!onPress}
        >
            {badge && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                </View>
            )}
            <View style={styles.statIcon}>{icon}</View>
            <Text style={styles.statText}>
                {value !== "" && <Text style={styles.statValue}>{value} </Text>}
                <Text style={styles.statLabel}>{label}</Text>
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        marginBottom: 12,
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: "#E6D7FF",
    },
    headerText: {
        flex: 1,
        marginLeft: 18,
    },
    username: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    bio: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginTop: 6,
    },
    statsRow: {
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 24,
        marginBottom: 15,
    },
    statCard: {
        flex: 1,
        height: 60,
        backgroundColor: Colors.cardLight,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 1,
    },
    statIcon: { marginTop: 5 },
    statText: { flexDirection: "row" },
    statValue: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        marginBottom: 5,
    },
    statLabel: {
        fontSize: FontSize.lg,
        color: Colors.textPrimary,
    },
    badge: {
        position: "absolute",
        top: -8,
        right: -4,
        backgroundColor: Colors.error,
        width: 27,
        height: 27,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    badgeText: {
        color: Colors.surface,
        fontWeight: FontWeight.bold,
        fontSize: FontSize.lg,
    },
});
