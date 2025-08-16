import AuthScreen from '@/components/AuthScreen';
import { Colors } from '@/constants/Colors';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAuthContext();

  useEffect(() => {
    // Debug: log every render and auth state
    console.log("[RootLayout] render", { isAuthenticated, isLoading });
  }, [isAuthenticated, isLoading]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors[colorScheme ?? 'light'].background }}>
      <PaperProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {!isAuthenticated ? (
            <AuthScreen />
          ) : (
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                },
                headerTintColor: Colors[colorScheme ?? 'light'].text,
                contentStyle: {
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                },
                animation: 'slide_from_right',
                animationDuration: 300,
                freezeOnBlur: true,
                animationTypeForReplace: 'push',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="deck/[id]"
                options={{
                  title: 'Deck',
                  headerBackTitle: 'Back'
                }}
              />
              <Stack.Screen
                name="study/[id]"
                options={{
                  title: 'Study',
                  headerBackTitle: 'Back',
                  presentation: 'modal',
                  contentStyle: {
                    backgroundColor: 'transparent',
                  },
                }}
              />
              <Stack.Screen name="+not-found" />
            </Stack>
          )}
          <StatusBar style="auto" />
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
