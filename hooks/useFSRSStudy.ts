import {
    EnhancedFlashCard,
    fsrsService,
    Rating
} from '@/services/fsrsService';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { FlashCard } from './useCards';

export interface StudyStats {
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  dueCards: number;
  avgRetention: number;
}

export interface StudyModeOptions {
  mode: 'review' | 'all' | 'new';
  maxCards?: number;
  includeOverdue?: boolean;
}

export function useFSRSStudy(deckId: string, allCards: FlashCard[]) {
  const [enhancedCards, setEnhancedCards] = useState<EnhancedFlashCard[]>([]);
  const [studyCards, setStudyCards] = useState<EnhancedFlashCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isStudyActive, setIsStudyActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [studyStats, setStudyStats] = useState<StudyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const lastStartAttempt = useRef<number>(0);

  // Load enhanced cards with FSRS data
  useEffect(() => {
    loadEnhancedCards();
  }, [deckId, allCards]);

  // Load study statistics
  useEffect(() => {
    if (deckId) {
      loadStudyStats();
    }
  }, [deckId, enhancedCards]);

  const loadEnhancedCards = async () => {
    try {
      setLoading(true);
      console.log('Loading enhanced cards for', allCards.length, 'cards');
      const enhanced = await Promise.all(
        allCards.map(card => fsrsService.enhanceCard(card))
      );
      console.log('Enhanced cards loaded:', enhanced.length);
      console.log('Enhanced cards FSRS status:', enhanced.map(card => ({ 
        id: card.id, 
        reps: card.fsrs.reps,
        state: card.fsrs.state
      })));
      setEnhancedCards(enhanced);
    } catch (error) {
      console.error('Error loading enhanced cards:', error);
      Alert.alert('Error', 'Failed to load study data');
    } finally {
      setLoading(false);
    }
  };

  const loadStudyStats = async () => {
    try {
      const stats = await fsrsService.getDeckStats(deckId);
      setStudyStats(stats);
    } catch (error) {
      console.error('Error loading study stats:', error);
    }
  };

  /**
   * Start a study session with specified options
   */
  const startStudySession = async (options: StudyModeOptions = { mode: 'review' }) => {
    const now = Date.now();
    
    // Debounce: prevent calls within 1 second of each other
    if (now - lastStartAttempt.current < 1000) {
      console.log('Debouncing start session call');
      return false;
    }
    lastStartAttempt.current = now;

    // Prevent multiple simultaneous calls
    if (isStartingSession || isStudyActive) {
      console.log('Study session already starting or active, skipping...');
      return false;
    }

    // Don't start if still loading
    if (loading) {
      console.log('Still loading cards, cannot start session yet');
      return false;
    }

    try {
      setIsStartingSession(true);
      console.log('Starting study session with mode:', options.mode);
      console.log('Enhanced cards available:', enhancedCards.length);
      console.log('All cards available:', allCards.length);
      
      let cardsToStudy: EnhancedFlashCard[] = [];
      
      switch (options.mode) {
        case 'review':
          cardsToStudy = await fsrsService.getCardsForReview(deckId, allCards);
          break;
        case 'new':
          console.log('Getting new cards for today...');
          cardsToStudy = await fsrsService.getNewCardsForToday(deckId, allCards);
          console.log('New cards found:', cardsToStudy.length);
          break;
        case 'all':
        default:
          cardsToStudy = enhancedCards;
          break;
      }

      // Apply max cards limit if specified
      if (options.maxCards && cardsToStudy.length > options.maxCards) {
        cardsToStudy = cardsToStudy.slice(0, options.maxCards);
      }
      
      console.log('Cards to study:', cardsToStudy.length);
      
      if (cardsToStudy.length === 0) {
        Alert.alert(
          'No Cards Available', 
          options.mode === 'review' 
            ? 'No cards are due for review at this time.' 
            : 'No cards available for study.'
        );
        return false;
      }

      const newSessionId = await fsrsService.startStudySession(deckId);
      setSessionId(newSessionId);
      setStudyCards(cardsToStudy);
      setCurrentCardIndex(0);
      setIsStudyActive(true);
      
      return true;
    } catch (error) {
      console.error('Error starting study session:', error);
      Alert.alert('Error', 'Failed to start study session');
      return false;
    } finally {
      setIsStartingSession(false);
    }
  };

  /**
   * End the current study session
   */
  const endStudySession = async () => {
    try {
      if (sessionId) {
        const session = await fsrsService.endStudySession(sessionId);
        console.log('Study session ended:', session);
      }
      
      setIsStudyActive(false);
      setSessionId(null);
      setStudyCards([]);
      setCurrentCardIndex(0);
      setIsStartingSession(false); // Reset the starting flag
      
      // Reload enhanced cards and stats
      await loadEnhancedCards();
      await loadStudyStats();
    } catch (error) {
      console.error('Error ending study session:', error);
    }
  };

  /**
   * Review the current card with FSRS rating
   */
  const reviewCard = async (rating: Rating, timeTaken: number = 0) => {
    try {
      if (!isStudyActive || currentCardIndex >= studyCards.length) {
        return false;
      }

      const currentCard = studyCards[currentCardIndex];
      const reviewDate = new Date();
      
      // Update FSRS data
      const updatedFSRSData = await fsrsService.reviewCard(
        currentCard.id, 
        rating, 
        reviewDate, 
        timeTaken
      );

      // Update the card in our local state
      const updatedCard = { ...currentCard, fsrs: updatedFSRSData };
      const updatedStudyCards = [...studyCards];
      updatedStudyCards[currentCardIndex] = updatedCard;
      setStudyCards(updatedStudyCards);

      // Update enhanced cards
      const updatedEnhancedCards = enhancedCards.map(card => 
        card.id === currentCard.id ? updatedCard : card
      );
      setEnhancedCards(updatedEnhancedCards);

      return true;
    } catch (error) {
      console.error('Error reviewing card:', error);
      Alert.alert('Error', 'Failed to record review');
      return false;
    }
  };

  /**
   * Move to the next card
   */
  const nextCard = () => {
    if (currentCardIndex < studyCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      return true;
    }
    return false; // No more cards
  };

  /**
   * Move to the previous card
   */
  const previousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      return true;
    }
    return false; // At first card
  };

  /**
   * Get review options for the current card
   */
  const getReviewOptions = async (cardId?: string) => {
    try {
      const targetCardId = cardId || studyCards[currentCardIndex]?.id;
      if (!targetCardId) return null;
      
      return await fsrsService.getReviewOptions(targetCardId);
    } catch (error) {
      console.error('Error getting review options:', error);
      return null;
    }
  };

  /**
   * Get formatted time until next review for a card
   */
  const getTimeUntilDue = (card: EnhancedFlashCard): string => {
    return fsrsService.formatTimeUntilDue(card.fsrs.due);
  };

  /**
   * Get rating labels for UI
   */
  const getRatingLabels = () => {
    return fsrsService.getRatingLabels();
  };

  /**
   * Check if there are cards due for review
   */
  const hasCardsForReview = async (): Promise<boolean> => {
    try {
      const dueCards = await fsrsService.getCardsForReview(deckId, allCards);
      return dueCards.length > 0;
    } catch (error) {
      console.error('Error checking for due cards:', error);
      return false;
    }
  };

  /**
   * Get daily progress information
   */
  const getDailyProgressInfo = async () => {
    try {
      return await fsrsService.getDailyProgressInfo();
    } catch (error) {
      console.error('Error getting daily progress:', error);
      return {
        newCardsStudied: 0,
        newCardsRemaining: 20,
        dailyLimit: 20,
        date: new Date().toDateString()
      };
    }
  };

  // Current card and session info
  const currentCard = studyCards[currentCardIndex] || null;
  const progress = studyCards.length > 0 ? (currentCardIndex + 1) / studyCards.length : 0;
  const isLastCard = currentCardIndex === studyCards.length - 1;
  const cardsRemaining = studyCards.length - currentCardIndex - 1;

  return {
    // Cards and data
    enhancedCards,
    studyCards,
    currentCard,
    studyStats,
    loading,

    // Session state
    isStudyActive,
    sessionId,
    currentCardIndex,
    progress,
    isLastCard,
    cardsRemaining,
    isStartingSession,

    // Actions
    startStudySession,
    endStudySession,
    reviewCard,
    nextCard,
    previousCard,
    
    // Utilities
    getReviewOptions,
    getTimeUntilDue,
    getRatingLabels,
    hasCardsForReview,
    getDailyProgressInfo,
    
    // Debug Tools (only expose in development)
    debug: __DEV__ ? {
      resetAllCards: () => fsrsService.debugResetAllCards(),
      resetCards: (cardIds: string[]) => fsrsService.debugResetCards(cardIds),
      timeTravel: (days: number) => fsrsService.debugTimeTravel(days),
      setCardDueDate: (cardId: string, dueDate: Date) => fsrsService.debugSetCardDueDate(cardId, dueDate),
      makeAllCardsDue: () => fsrsService.debugMakeAllCardsDue(),
      setDailyProgress: (studied: number, date?: string) => fsrsService.debugSetDailyProgress(studied, date),
      getAllData: () => fsrsService.debugGetAllData(),
      createTestCards: (count: number, state?: any) => fsrsService.debugCreateTestCards(count, state),
      exportData: () => fsrsService.debugExportData(),
      importData: (jsonData: string) => fsrsService.debugImportData(jsonData)
    } : undefined,
    
    // Refresh
    refreshData: () => {
      loadEnhancedCards();
      loadStudyStats();
    }
  };
}

export { Rating } from '@/services/fsrsService';

