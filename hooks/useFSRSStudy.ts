import { API_BASE_URL } from '@/constants/config';
import { fetchApiWithRefresh } from '@/services/authService';
import {
  FlashCard,
  fsrsService,
  Rating
} from '@/services/fsrsService';
import {
  addToSyncQueue,
  processSyncQueue as processGenericSyncQueue,
  removeFromSyncQueue,
} from '@/services/syncQueue';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

export interface StudyStats {
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  dueCards: number;
}

export interface StudyModeOptions {
  mode: 'review' | 'all' | 'new';
  maxCards?: number;
  includeOverdue?: boolean;
}

export function useFSRSStudy(deckId: string, allCards: FlashCard[]) {
  const [enhancedCards, setEnhancedCards] = useState<FlashCard[]>([]);
  const [studyCards, setStudyCards] = useState<FlashCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isStudyActive, setIsStudyActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [studyStats, setStudyStats] = useState<StudyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const lastStartAttempt = useRef<number>(0);
  const lastRefreshAttempt = useRef<number>(0);

  const FSRS_SYNC_QUEUE_KEY = `fsrsSyncQueue_${deckId}`;

  function isUUID(id: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  // Custom FSRS sync functions
  const syncFSRSUpdate = async (card: FlashCard): Promise<boolean> => {
    try {
      const body = {
        due: card.fsrs.due,
        stability: card.fsrs.stability,
        difficulty: card.fsrs.difficulty,
        elapsed_days: card.fsrs.elapsed_days,
        scheduled_days: card.fsrs.scheduled_days,
        reps: card.fsrs.reps,
        lapses: card.fsrs.lapses,
        state: card.fsrs.state,
        learning_steps: card.fsrs.learning_steps,
      };

      const res = await fetchApiWithRefresh(`${API_BASE_URL}/flashcards/${card.id}/fsrs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      
      // Remove from sync queue on success
      await removeFromSyncQueue<FlashCard>(FSRS_SYNC_QUEUE_KEY, card.id);
      return true;
    } catch (e) {
      console.debug('syncFSRSUpdate failed:', e);
      return false;
    }
  };

  const enqueueFSRSUpdateForSync = async (card: FlashCard) => {
    try {
      // Only sync if card has UUID (is synced to server)
      console.debug('enqueueFSRSUpdateForSync called for card:', card.id);

      if (!isUUID(card.id)) {
        console.debug('Skipping FSRS sync for non-UUID card:', card.id);
        return;
      }

      const success = await syncFSRSUpdate(card);
      if (!success) {
        await addToSyncQueue<FlashCard>(FSRS_SYNC_QUEUE_KEY, { type: 'update', item: card });
      }
    } catch (e) {
      console.error('enqueueFSRSUpdateForSync error:', e);
      await addToSyncQueue<FlashCard>(FSRS_SYNC_QUEUE_KEY, { type: 'update', item: card });
    }
  };

  const processFSRSSyncQueue = async () => {
    await processGenericSyncQueue<FlashCard>(FSRS_SYNC_QUEUE_KEY, {
      update: syncFSRSUpdate,
      create: () => Promise.resolve(false), // Not used for FSRS
      delete: () => Promise.resolve(false), // Not used for FSRS
    });
  };

  const loadEnhancedCards = useCallback(async () => {
    try {
      setLoading(true);
      const enhanced = await Promise.all(
        allCards.map(card => fsrsService.enhanceCard(card))
      );
      setEnhancedCards(enhanced);
    } catch (error) {
      console.error('Error loading enhanced cards:', error);
      Alert.alert('Error', 'Failed to load study data');
    } finally {
      setLoading(false);
    }
  }, [allCards]);

  const loadStudyStats = useCallback(async () => {
    try {
      const stats = await fsrsService.getDeckStats(deckId);
      setStudyStats(stats);
    } catch (error) {
      console.error('Error loading study stats:', error);
    }
  }, [deckId]);

  // Load enhanced cards with FSRS data
  useEffect(() => {
    if (deckId && allCards.length > 0) {
      loadEnhancedCards();
    }
  }, [deckId, loadEnhancedCards]);

  // Load study statistics
  useEffect(() => {
    if (deckId && enhancedCards.length > 0) {
      loadStudyStats();
    }
  }, [deckId, enhancedCards.length, loadStudyStats]); // Use length instead of the full array to prevent unnecessary re-renders

  // Setup periodic FSRS sync processing
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (deckId) {
      // Process any pending FSRS syncs when hook initializes
      processFSRSSyncQueue();
      
      // Set up periodic retry every 30 seconds while mounted
      interval = setInterval(() => {
        processFSRSSyncQueue();
      }, 30_000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [deckId]);

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
    // Don't start if still loading
    if (loading) {
      console.log('Still loading cards, cannot start session yet');
      return false;
    }
    lastStartAttempt.current = now;

    // Prevent multiple simultaneous calls
    if (isStartingSession || isStudyActive) {
      console.log('Study session already starting or active, skipping...');
      return false;
    }



    try {
      setIsStartingSession(true);
      console.log('Starting study session with mode:', options.mode);
      console.log('Enhanced cards available:', enhancedCards.length);
      console.log('All cards available:', allCards.length);
      
      let cardsToStudy: FlashCard[] = [];
      
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
      console.log('Reviewing card:', currentCard.id);
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

      // Update local storage
      // try {
      //   const raw = await AsyncStorage.getItem(`flashcards_${deckId}`);
      //   const localCards: FlashCard[] = raw ? JSON.parse(raw) : [];
      //   const cardIndex = localCards.findIndex(card => card.id === currentCard.id);
      //   if (cardIndex >= 0) {
      //     localCards[cardIndex] = updatedCard;
      //     await AsyncStorage.setItem(`flashcards_${deckId}`, JSON.stringify(localCards));
      //   }
      // } catch (storageError) {
      //   console.error('Error updating local storage after review:', storageError);
      // }

      // Sync FSRS data to server in background
      enqueueFSRSUpdateForSync(updatedCard).catch(err => {
        console.debug('enqueueFSRSUpdateForSync error:', err);
      });

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
  const getTimeUntilDue = (card: FlashCard): string => {
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
  const fsrsCurrentCard = studyCards[currentCardIndex] || null;
  // Fix progress calculation: show how many cards have been COMPLETED, not just started
  const progress = studyCards.length > 0 ? currentCardIndex / studyCards.length : 0;
  const isLastCard = currentCardIndex === studyCards.length - 1;
  const cardsRemaining = studyCards.length - currentCardIndex - 1;

  return {
    // Cards and data
    enhancedCards,
    studyCards,
    fsrsCurrentCard,
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
      resetAllCards: () => { 
        return fsrsService.debugResetAllCards(); 
      },
      resetCards: (cardIds: string[]) => fsrsService.debugResetCards(cardIds),
      timeTravel: (days: number) => fsrsService.debugTimeTravel(days),
      setCardDueDate: (cardId: string, dueDate: Date) => fsrsService.debugSetCardDueDate(cardId, dueDate),
      makeAllCardsDue: () => fsrsService.debugMakeAllCardsDue(),
      setDailyProgress: (studied: number, date?: string) => fsrsService.debugSetDailyProgress(studied, date),
      getAllData: () => fsrsService.debugGetAllData(),
      exportData: () => fsrsService.debugExportData(),
      importData: (jsonData: string) => fsrsService.debugImportData(jsonData)
    } : undefined,
    
    // Refresh
    refreshData: () => {
      const now = Date.now();
      
      // Debounce: prevent calls within 1 second of each other
      if (now - lastRefreshAttempt.current < 1000) {
        return;
      }
      lastRefreshAttempt.current = now;
      
      console.log('Refreshing FSRS data...');
      if (deckId && allCards.length > 0) {
        loadEnhancedCards();
        loadStudyStats();
      }
    }
  };
}

export { Rating } from '@/services/fsrsService';

