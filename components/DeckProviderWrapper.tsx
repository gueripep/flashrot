// components/DeckProviderWrapper.tsx

import { FSRSProvider } from '@/contexts/FSRSContext';
import { useCards } from '@/hooks/useCards';
import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function DeckProviderWrapper() {
  const { id } = useLocalSearchParams();
  const deckId = Array.isArray(id) ? id[0] : id;
  const { cards } = useCards(deckId);

  return (
    <FSRSProvider deckId={deckId} allCards={cards}>
      <Stack
        screenOptions={{
          headerShown: false, // The parent stack will handle headers
        }}
      >
        <Stack.Screen name="index" />  
        <Stack.Screen name="study/[id]" />
      </Stack>
    </FSRSProvider>
  );
}