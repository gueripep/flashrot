import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  
  return (
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
      <Stack.Screen 
        name="index" 
        options={{ title: 'Brainflash' }} 
      />
    </Stack>
  );
}
