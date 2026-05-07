import { Stack } from "expo-router";
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="invitations" />
        <Stack.Screen name="voice-chat" />
        <Stack.Screen name="recipe/[recipeID]" />
        <Stack.Screen name="group/[groupID]" />
      </Stack>
    </GestureHandlerRootView>
  );
}