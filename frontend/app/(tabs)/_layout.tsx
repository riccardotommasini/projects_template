import { Tabs } from 'expo-router'
import { Plus, UsersRound, CircleUserRound, Compass, ShoppingCart } from 'lucide-react-native'

export default function TabsLayout() {
    return (
        <Tabs screenOptions={{ tabBarShowLabel: false, headerShown: false }}>
            <Tabs.Screen
                name="create-recipe"
                options={{
                    tabBarIcon: ({ color, size }) => <Plus color={color} size={size} />
                }}
            />
            <Tabs.Screen
                name="groups"
                options={{
                    tabBarIcon: ({ color, size }) => <UsersRound color={color} size={size} />
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    tabBarIcon: ({ color, size }) => <CircleUserRound color={color} size={size} />
                }}
            />
            <Tabs.Screen
                name="feed"
                options={{
                    tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />
                }}
            />
            <Tabs.Screen
                name="shopping-list"
                options={{
                    tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />
                }}
            />
        </Tabs>
    )
}