import { useFSRS } from '@/hooks/useFSRS';
import { FlashCard } from '@/services/fsrsService';
import React, { createContext, ReactNode, useContext } from 'react';

type FSRSContextType = ReturnType<typeof useFSRS>;

const FSRSContext = createContext<FSRSContextType | null>(null);

type FSRSProviderProps = {
  children: ReactNode;
  deckId: string;
  allCards: FlashCard[];
};

export function FSRSProvider({ children, deckId, allCards }: FSRSProviderProps) {
  const fsrs = useFSRS(deckId, allCards);
  return <FSRSContext.Provider value={fsrs}>{children}</FSRSContext.Provider>;
}

export const useFSRSContext = () => {
  const context = useContext(FSRSContext);
  if (!context) throw new Error('useFSRSContext must be used within FSRSProvider');
  return context;
};