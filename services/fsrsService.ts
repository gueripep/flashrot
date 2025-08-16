import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Card,
    createEmptyCard,
    FSRS,
    fsrs,
    Card as FSRSCard,
    generatorParameters,
    IPreview,
    Rating,
    RecordLog,
    State
} from 'ts-fsrs';

// Enhanced FlashCard interface with FSRS data
export interface FlashCard {
    // Original card data
    id: string;
    createdAt: string;
    deckId: string;
    stage: Stage;

    // Ai generated discussion
    discussion: Discussion;
    // flash card with back and front
    finalCard: FinalCard;


    // FSRS data
    fsrs: Card;
}

export enum Stage {
    Discussion,
    Learning
}

export interface FinalCard {
    front: string;
    back: string;
    // Grouped audio filename + timing filename
    questionAudio: AudioFileRef;
    answerAudio: AudioFileRef;
}

export interface Discussion {
    ssmlText: string;
    text: string;
    // Grouped audio filename + timing filename
    audio: AudioFileRef;
}

/**
 * Small helper type to pair an audio filename with its timing filename.
 */
export interface AudioFileRef {
    filename: string;
    timingFilename: string;
}

export interface StudySession {
    id: string;
    deckId: string;
    startTime: Date;
    endTime?: Date;
    cardsStudied: number;
    correctAnswers: number;
    reviews: ReviewRecord[];
}

export interface ReviewRecord {
    cardId: string;
    rating: Rating;
    timestamp: Date;
    timeTaken: number; // in seconds
    wasCorrect: boolean;
}

class FSRSService {
    private fsrsInstance: FSRS;
    private readonly STUDY_SESSIONS_KEY = 'study_sessions';
    private readonly FSRS_SETTINGS_KEY = 'fsrs_settings';
    private readonly DAILY_PROGRESS_KEY = 'daily_progress';
    private readonly DAILY_NEW_CARDS_LIMIT = 20; // Adjust as needed

    constructor() {
        // Initialize FSRS with default parameters
        const params = generatorParameters({
            enable_fuzz: true,
        });
        this.fsrsInstance = fsrs(params);
    }

    /**
     * Initialize a new card with FSRS data
     */
    createNewFSRSCard(cardId: string, deckId: string): Card {
        const fsrsCard = createEmptyCard(new Date());
        console.log("Generated FSRS card:", fsrsCard);
        return {
            due: new Date(), // Make new cards immediately due for study
            stability: fsrsCard.stability,
            difficulty: fsrsCard.difficulty,
            elapsed_days: fsrsCard.elapsed_days,
            scheduled_days: fsrsCard.scheduled_days,
            reps: fsrsCard.reps,
            lapses: fsrsCard.lapses,
            state: fsrsCard.state,
            last_review: fsrsCard.last_review || undefined,
            learning_steps: fsrsCard.learning_steps || 0,
        };
    }

    /**
     * Convert FlashCard to EnhancedFlashCard with FSRS data
     * This method is now mainly for backward compatibility
     */
    async enhanceCard(card: any): Promise<FlashCard> {
        let fsrsData = card.fsrs;

        if (!fsrsData) {
            // Create new FSRS data for this card
            fsrsData = this.createNewFSRSCard(card.id, card.deckId);
        } else {
            // Ensure dates are Date objects
            if (fsrsData.due && typeof fsrsData.due === 'string') {
                fsrsData.due = new Date(fsrsData.due);
            }
            if (fsrsData.last_review && typeof fsrsData.last_review === 'string') {
                fsrsData.last_review = new Date(fsrsData.last_review);
            }
        }

        return {
            ...card,
            fsrs: fsrsData
        };
    }

    /**
     * Get new cards for today with daily limit
     */
    async getNewCardsForToday(deckId: string, allCards?: any[]): Promise<FlashCard[]> {
        const dailyProgress = await this.getDailyProgress();
        const today = new Date().toDateString();

        // Reset progress if it's a new day
        if (dailyProgress.date !== today) {
            dailyProgress.date = today;
            dailyProgress.newCardsStudied = 0;
            await this.saveDailyProgress(dailyProgress);
        }

        const remainingNewCards = this.DAILY_NEW_CARDS_LIMIT - dailyProgress.newCardsStudied;
        if (remainingNewCards <= 0) {
            console.log('Daily new card limit reached:', this.DAILY_NEW_CARDS_LIMIT);
            return [];
        }

        console.log('Daily new cards remaining:', remainingNewCards);

        // Load cards from deck storage instead of using allCards parameter
        const enhancedCards = await this.loadCardsFromDeck(deckId);

        // Get new cards (reps === 0) that are due
        const now = new Date();
        const newCards = enhancedCards.filter(card =>
            card.fsrs.reps === 0 && card.fsrs.due <= now
        );

        // Return up to the daily limit
        return newCards.slice(0, remainingNewCards);
    }

    /**
     * Get cards due for review for a specific deck
     */
    async getCardsForReview(deckId: string, allCards?: any[]): Promise<FlashCard[]> {
        const now = new Date();

        // Load cards from deck storage
        const enhancedCards = await this.loadCardsFromDeck(deckId);

        // Filter cards that are due for review
        const dueCards = enhancedCards.filter(card => {
            return card.fsrs.due <= now;
        });

        // Sort by due date (most overdue first)
        dueCards.sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());

        return dueCards;
    }

    /**
     * Get all cards for a deck with FSRS data, sorted by next review date
     */
    async getAllCardsForDeck(deckId: string, allCards?: any[]): Promise<FlashCard[]> {
        // Load cards from deck storage
        const enhancedCards = await this.loadCardsFromDeck(deckId);

        // Sort by due date
        enhancedCards.sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());

        return enhancedCards;
    }

    /**
     * Process a card review and update FSRS data
     */
    async reviewCard(
        cardId: string,
        rating: Rating,
        reviewDate: Date = new Date(),
        timeTaken: number = 0
    ): Promise<Card> {
        // Find the card and get its deck ID
        let deckId: string | null = null;
        let currentFSRSData: Card | null = null;

        // We need to find which deck this card belongs to
        const allKeys = await AsyncStorage.getAllKeys();
        const deckKeys = allKeys.filter(key => key.startsWith('flashcards_'));

        for (const key of deckKeys) {
            const currentDeckId = key.replace('flashcards_', '');
            const cards = await this.loadCardsFromDeck(currentDeckId);
            const card = cards.find(c => c.id === cardId);
            if (card) {
                deckId = currentDeckId;
                currentFSRSData = card.fsrs;
                break;
            }
        }

        if (!currentFSRSData || !deckId) {
            throw new Error(`No FSRS data found for card ${cardId}`);
        }

        // Convert our FSRSCardData back to FSRS Card format
        const fsrsCard: FSRSCard = {
            due: currentFSRSData.due,
            stability: currentFSRSData.stability,
            difficulty: currentFSRSData.difficulty,
            elapsed_days: currentFSRSData.elapsed_days,
            scheduled_days: currentFSRSData.scheduled_days,
            reps: currentFSRSData.reps,
            lapses: currentFSRSData.lapses,
            state: currentFSRSData.state,
            last_review: currentFSRSData.last_review,
            learning_steps: currentFSRSData.learning_steps,
        };

        // Calculate new scheduling
        const schedulingCards: IPreview = this.fsrsInstance.repeat(fsrsCard, reviewDate);

        // Check if schedulingCards is valid
        if (!schedulingCards) {
            throw new Error('FSRS repeat method returned undefined');
        }

        const arr = [...schedulingCards];
        const updatedCard = arr[rating];

        if (!updatedCard) {
            const availableRatings = Object.keys(schedulingCards);
            throw new Error(`Invalid rating: ${rating}. Available ratings: ${availableRatings.join(', ')}`);
        }

        // Extract the new card data
        const newFSRSData: Card = {
            due: updatedCard.card.due,
            stability: updatedCard.card.stability,
            difficulty: updatedCard.card.difficulty,
            elapsed_days: updatedCard.card.elapsed_days,
            scheduled_days: updatedCard.card.scheduled_days,
            reps: updatedCard.card.reps,
            lapses: updatedCard.card.lapses,
            state: updatedCard.card.state,
            last_review: updatedCard.card.last_review,
            learning_steps: updatedCard.card.learning_steps || 0,
        };

        // Save updated FSRS data to the deck
        await this.updateCardInDeck(deckId, cardId, newFSRSData);

        // Update daily progress if this was a new card (first review)
        if (currentFSRSData.reps === 0) {
            await this.updateDailyProgress();
        }

        // Record the review
        await this.recordReview(cardId, rating, reviewDate, timeTaken);

        return newFSRSData;
    }

    /**
     * Get the next review intervals for all rating options
     */
    async getReviewOptions(cardId: string): Promise<{ [key: number]: { interval: number; due: Date } }> {
        // Find the card and get its FSRS data
        let currentFSRSData: Card | null = null;

        // We need to find which deck this card belongs to
        const allKeys = await AsyncStorage.getAllKeys();
        const deckKeys = allKeys.filter(key => key.startsWith('flashcards_'));

        for (const key of deckKeys) {
            const currentDeckId = key.replace('flashcards_', '');
            const cards = await this.loadCardsFromDeck(currentDeckId);
            const card = cards.find(c => c.id === cardId);
            if (card) {
                currentFSRSData = card.fsrs;
                break;
            }
        }

        if (!currentFSRSData) {
            throw new Error(`No FSRS data found for card ${cardId}`);
        }

        const fsrsCard: FSRSCard = {
            due: currentFSRSData.due,
            stability: currentFSRSData.stability,
            difficulty: currentFSRSData.difficulty,
            elapsed_days: currentFSRSData.elapsed_days,
            scheduled_days: currentFSRSData.scheduled_days,
            reps: currentFSRSData.reps,
            lapses: currentFSRSData.lapses,
            state: currentFSRSData.state,
            last_review: currentFSRSData.last_review,
            learning_steps: currentFSRSData.learning_steps,
        };

        const now = new Date();
        const schedulingCards: RecordLog = this.fsrsInstance.repeat(fsrsCard, now);

        // Check if schedulingCards is valid
        if (!schedulingCards) {
            throw new Error('FSRS repeat method returned undefined for review options');
        }

        const options: { [key: number]: { interval: number; due: Date } } = {};

        // The FSRS repeat method returns an object with string keys for ratings
        for (const [ratingStr, item] of Object.entries(schedulingCards)) {
            // Skip the Symbol.iterator property
            if (typeof ratingStr === 'string' && item && typeof item === 'object' && 'card' in item && 'log' in item) {
                const rating = parseInt(ratingStr);
                const card = (item as any).card;

                const intervalDays = Math.round((card.due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                options[rating] = {
                    interval: intervalDays,
                    due: card.due
                };
            }
        }

        return options;
    }

    /**
     * Get study statistics for a deck
     */
    async getDeckStats(deckId: string): Promise<{
        totalCards: number;
        newCards: number;
        learningCards: number;
        reviewCards: number;
        dueCards: number;
    }> {
        const cards = await this.loadCardsFromDeck(deckId);
        const now = new Date();

        let totalCards = 0;
        let newCards = 0;
        let learningCards = 0;
        let reviewCards = 0;
        let dueCards = 0;

        for (const card of cards) {
            const fsrsData = card.fsrs;
            totalCards++;

            if (fsrsData.state === State.New) {
                newCards++;
            } else if (fsrsData.state === State.Learning || fsrsData.state === State.Relearning) {
                learningCards++;
            } else if (fsrsData.state === State.Review) {
                reviewCards++;
            }

            if (fsrsData.due <= now) {
                dueCards++;
            }
        }


        return {
            totalCards,
            newCards,
            learningCards,
            reviewCards,
            dueCards,
        };
    }

    /**
     * Start a new study session
     */
    async startStudySession(deckId: string): Promise<string> {
        const sessionId = Date.now().toString();
        const session: StudySession = {
            id: sessionId,
            deckId,
            startTime: new Date(),
            cardsStudied: 0,
            correctAnswers: 0,
            reviews: []
        };

        const sessions = await this.loadStudySessions();
        sessions[sessionId] = session;
        await AsyncStorage.setItem(this.STUDY_SESSIONS_KEY, JSON.stringify(sessions));

        return sessionId;
    }

    /**
     * End a study session
     */
    async endStudySession(sessionId: string): Promise<StudySession | null> {
        const sessions = await this.loadStudySessions();
        const session = sessions[sessionId];

        if (session) {
            session.endTime = new Date();
            sessions[sessionId] = session;
            await AsyncStorage.setItem(this.STUDY_SESSIONS_KEY, JSON.stringify(sessions));
            return session;
        }

        return null;
    }

    /**
     * Helper method to get cards from a specific deck (public interface)
     */
    async getCardsFromDeck(deckId: string): Promise<FlashCard[]> {
        return this.loadCardsFromDeck(deckId);
    }

    /**
     * Helper method to save cards to a specific deck (public interface)
     */
    async saveCardsToDeck_Public(deckId: string, cards: FlashCard[]): Promise<void> {
        return this.saveCardsToDeck(deckId, cards);
    }

    /**
     * Load cards from deck storage
     */
    private async loadCardsFromDeck(deckId: string): Promise<FlashCard[]> {
        try {
            const STORAGE_KEY = `flashcards_${deckId}`;
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (!data) return [];

            const cards: FlashCard[] = JSON.parse(data);

            // Ensure dates are Date objects
            cards.forEach(card => {
                if (card.fsrs.due && typeof card.fsrs.due === 'string') {
                    card.fsrs.due = new Date(card.fsrs.due);
                }
                if (card.fsrs.last_review && typeof card.fsrs.last_review === 'string') {
                    card.fsrs.last_review = new Date(card.fsrs.last_review);
                }
            });

            return cards;
        } catch (error) {
            console.error('Error loading cards from deck:', error);
            return [];
        }
    }

    /**
     * Save cards to deck storage
     */
    private async saveCardsToDeck(deckId: string, cards: FlashCard[]): Promise<void> {
        try {
            const STORAGE_KEY = `flashcards_${deckId}`;
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
        } catch (error) {
            console.error('Error saving cards to deck:', error);
            throw error;
        }
    }

    /**
     * Update a specific card's FSRS data in deck storage
     */
    private async updateCardInDeck(deckId: string, cardId: string, updatedFSRS: Card): Promise<void> {
        try {
            const cards = await this.loadCardsFromDeck(deckId);
            const updatedCards = cards.map(card =>
                card.id === cardId ? { ...card, fsrs: updatedFSRS } : card
            );
            await this.saveCardsToDeck(deckId, updatedCards);
        } catch (error) {
            console.error('Error updating card in deck:', error);
            throw error;
        }
    }

    private async loadStudySessions(): Promise<{ [sessionId: string]: StudySession }> {
        try {
            const data = await AsyncStorage.getItem(this.STUDY_SESSIONS_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Error loading study sessions:', error);
            return {};
        }
    }

    private async recordReview(
        cardId: string,
        rating: Rating,
        timestamp: Date,
        timeTaken: number
    ): Promise<void> {
        try {
            // Record individual review for analytics
            const review: ReviewRecord = {
                cardId,
                rating,
                timestamp,
                timeTaken,
                wasCorrect: rating >= Rating.Good
            };

            // You can implement more sophisticated review tracking here
            console.log('Review recorded:', review);
        } catch (error) {
            console.error('Error recording review:', error);
        }
    }

    private async getDailyProgress(): Promise<{ date: string, newCardsStudied: number }> {
        try {
            const data = await AsyncStorage.getItem(this.DAILY_PROGRESS_KEY);
            return data ? JSON.parse(data) : { date: '', newCardsStudied: 0 };
        } catch (error) {
            console.error('Error loading daily progress:', error);
            return { date: '', newCardsStudied: 0 };
        }
    }

    private async saveDailyProgress(progress: { date: string, newCardsStudied: number }): Promise<void> {
        try {
            await AsyncStorage.setItem(this.DAILY_PROGRESS_KEY, JSON.stringify(progress));
        } catch (error) {
            console.error('Error saving daily progress:', error);
            throw error;
        }
    }

    /**
     * Update daily progress when a new card is studied
     */
    async updateDailyProgress(): Promise<void> {
        const dailyProgress = await this.getDailyProgress();
        const today = new Date().toDateString();

        // Reset if it's a new day
        if (dailyProgress.date !== today) {
            dailyProgress.date = today;
            dailyProgress.newCardsStudied = 1;
        } else {
            dailyProgress.newCardsStudied += 1;
        }

        await this.saveDailyProgress(dailyProgress);
    }

    /**
     * Get daily study progress information
     */
    async getDailyProgressInfo(): Promise<{
        newCardsStudied: number;
        newCardsRemaining: number;
        dailyLimit: number;
        date: string;
    }> {
        const progress = await this.getDailyProgress();
        const today = new Date().toDateString();

        // Reset if it's a new day
        const isToday = progress.date === today;
        const newCardsStudied = isToday ? progress.newCardsStudied : 0;
        const newCardsRemaining = Math.max(0, this.DAILY_NEW_CARDS_LIMIT - newCardsStudied);

        return {
            newCardsStudied,
            newCardsRemaining,
            dailyLimit: this.DAILY_NEW_CARDS_LIMIT,
            date: today
        };
    }

    /**
     * Format time until next review
     */
    formatTimeUntilDue(dueDate: Date): string {
        const now = new Date();
        const diffMs = dueDate.getTime() - now.getTime();

        if (diffMs <= 0) {
            return 'Due now';
        }

        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffDays > 0) {
            return `${diffDays}d ${diffHours}h`;
        } else if (diffHours > 0) {
            return `${diffHours}h ${diffMinutes}m`;
        } else {
            return `${diffMinutes}m`;
        }
    }

    /**
     * Get rating labels for UI
     */
    getRatingLabels(): { [key: number]: { label: string; color: string; description: string } } {
        return {
            [Rating.Manual]: {
                label: 'Manual',
                color: '#6c757d',
                description: 'Manual scheduling'
            },
            [Rating.Again]: {
                label: 'Again',
                color: '#dc3545',
                description: 'Complete blackout, incorrect response'
            },
            [Rating.Hard]: {
                label: 'Hard',
                color: '#fd7e14',
                description: 'Correct response recalled with serious difficulty'
            },
            [Rating.Good]: {
                label: 'Good',
                color: '#198754',
                description: 'Correct response after a hesitation'
            },
            [Rating.Easy]: {
                label: 'Easy',
                color: '#0dcaf0',
                description: 'Perfect response, immediate recall'
            }
        };
    }

    // ===================
    // DEBUGGING TOOLS
    // ===================

    /**
     * Reset all FSRS data for all cards (WARNING: This will delete all progress!)
     */
    async debugResetAllCards(): Promise<void> {
        try {
            // Get all deck keys and reset FSRS data in each deck
            const allKeys = await AsyncStorage.getAllKeys();
            const deckKeys = allKeys.filter(key => key.startsWith('flashcards_'));

            for (const key of deckKeys) {
                const deckId = key.replace('flashcards_', '');
                const cards = await this.loadCardsFromDeck(deckId);

                // Reset FSRS data for each card
                const resetCards = cards.map(card => ({
                    ...card,
                    fsrs: this.createNewFSRSCard(card.id, card.deckId),
                    stage: Stage.Discussion
                }));

                await this.saveCardsToDeck(deckId, resetCards);
            }

            await AsyncStorage.removeItem(this.DAILY_PROGRESS_KEY);
            await AsyncStorage.removeItem(this.STUDY_SESSIONS_KEY);
            console.log('🔧 DEBUG: All FSRS data has been reset!');
        } catch (error) {
            console.error('Error resetting FSRS data:', error);
            throw error;
        }
    }

    /**
     * Reset FSRS data for specific cards
     */
    async debugResetCards(cardIds: string[]): Promise<void> {
        try {
            // We need to find which decks these cards belong to
            const allKeys = await AsyncStorage.getAllKeys();
            const deckKeys = allKeys.filter(key => key.startsWith('flashcards_'));

            for (const key of deckKeys) {
                const deckId = key.replace('flashcards_', '');
                const cards = await this.loadCardsFromDeck(deckId);
                let hasChanges = false;

                const updatedCards = cards.map(card => {
                    if (cardIds.includes(card.id)) {
                        hasChanges = true;
                        return {
                            ...card,
                            fsrs: this.createNewFSRSCard(card.id, card.deckId)
                        };
                    }
                    return card;
                });

                if (hasChanges) {
                    await this.saveCardsToDeck(deckId, updatedCards);
                }
            }

            console.log(`🔧 DEBUG: Reset FSRS data for ${cardIds.length} cards:`, cardIds);
        } catch (error) {
            console.error('Error resetting specific cards:', error);
            throw error;
        }
    }

    /**
     * Simulate moving forward in time by X days (for testing scheduling)
     */
    async debugTimeTravel(days: number): Promise<void> {
        try {
            const timeOffset = days * 24 * 60 * 60 * 1000; // Convert days to milliseconds

            // Update all cards in all decks
            const allKeys = await AsyncStorage.getAllKeys();
            const deckKeys = allKeys.filter(key => key.startsWith('flashcards_'));

            for (const key of deckKeys) {
                const deckId = key.replace('flashcards_', '');
                const cards = await this.loadCardsFromDeck(deckId);

                // Update all card due dates by moving them backward in time
                // (making them more overdue if days is positive)
                const updatedCards = cards.map(card => ({
                    ...card,
                    fsrs: {
                        ...card.fsrs,
                        due: new Date(card.fsrs.due.getTime() - timeOffset),
                        last_review: card.fsrs.last_review
                            ? new Date(card.fsrs.last_review.getTime() - timeOffset)
                            : card.fsrs.last_review
                    }
                }));

                await this.saveCardsToDeck(deckId, updatedCards);
            }

            // Also update daily progress to simulate new day
            if (days >= 1) {
                const progress = await this.getDailyProgress();
                const newDate = new Date();
                newDate.setDate(newDate.getDate() + days);
                progress.date = newDate.toDateString();
                progress.newCardsStudied = 0; // Reset daily progress
                await this.saveDailyProgress(progress);
            }

            console.log(`🔧 DEBUG: Time traveled ${days} days forward. Cards are now more overdue.`);
        } catch (error) {
            console.error('Error in time travel:', error);
            throw error;
        }
    }

    /**
     * Set specific due dates for testing
     */
    async debugSetCardDueDate(cardId: string, dueDate: Date): Promise<void> {
        try {
            // Find the card and update its due date
            const allKeys = await AsyncStorage.getAllKeys();
            const deckKeys = allKeys.filter(key => key.startsWith('flashcards_'));

            for (const key of deckKeys) {
                const deckId = key.replace('flashcards_', '');
                const cards = await this.loadCardsFromDeck(deckId);

                const updatedCards = cards.map(card => {
                    if (card.id === cardId) {
                        return {
                            ...card,
                            fsrs: { ...card.fsrs, due: dueDate }
                        };
                    }
                    return card;
                });

                // Only save if we found and updated the card
                if (updatedCards.some(card => card.id === cardId)) {
                    await this.saveCardsToDeck(deckId, updatedCards);
                    console.log(`🔧 DEBUG: Set card ${cardId} due date to:`, dueDate);
                    return;
                }
            }

            console.warn(`🔧 DEBUG: Card ${cardId} not found in any deck`);
        } catch (error) {
            console.error('Error setting card due date:', error);
            throw error;
        }
    }

    /**
     * Make all cards due now (for testing)
     */
    async debugMakeAllCardsDue(): Promise<void> {
        try {
            const now = new Date();

            // Update all cards in all decks
            const allKeys = await AsyncStorage.getAllKeys();
            const deckKeys = allKeys.filter(key => key.startsWith('flashcards_'));

            for (const key of deckKeys) {
                const deckId = key.replace('flashcards_', '');
                const cards = await this.loadCardsFromDeck(deckId);

                const updatedCards = cards.map(card => ({
                    ...card,
                    fsrs: { ...card.fsrs, due: now }
                }));

                await this.saveCardsToDeck(deckId, updatedCards);
            }

            console.log('🔧 DEBUG: Made all cards due now');
        } catch (error) {
            console.error('Error making all cards due:', error);
            throw error;
        }
    }

    /**
     * Set daily progress for testing
     */
    async debugSetDailyProgress(newCardsStudied: number, date?: string): Promise<void> {
        try {
            const progress = {
                date: date || new Date().toDateString(),
                newCardsStudied: newCardsStudied
            };
            await this.saveDailyProgress(progress);
            console.log(`🔧 DEBUG: Set daily progress to ${newCardsStudied} new cards studied`);
        } catch (error) {
            console.error('Error setting daily progress:', error);
            throw error;
        }
    }

    /**
     * Get all FSRS data for debugging
     */
    async debugGetAllData(): Promise<{
        deckCards: { [deckId: string]: FlashCard[] };
        dailyProgress: { date: string, newCardsStudied: number };
        sessions: { [sessionId: string]: StudySession };
    }> {
        try {
            const dailyProgress = await this.getDailyProgress();
            const sessions = await this.loadStudySessions();

            // Load all deck cards
            const allKeys = await AsyncStorage.getAllKeys();
            const deckKeys = allKeys.filter(key => key.startsWith('flashcards_'));
            const deckCards: { [deckId: string]: FlashCard[] } = {};

            for (const key of deckKeys) {
                const deckId = key.replace('flashcards_', '');
                deckCards[deckId] = await this.loadCardsFromDeck(deckId);
            }

            const totalCards = Object.values(deckCards).reduce((sum, cards) => sum + cards.length, 0);

            console.log('🔧 DEBUG: All FSRS Data:', {
                totalDecks: Object.keys(deckCards).length,
                totalCards,
                dailyProgress,
                totalSessions: Object.keys(sessions).length
            });

            return { deckCards, dailyProgress, sessions };
        } catch (error) {
            console.error('Error getting debug data:', error);
            throw error;
        }
    }

    /**
     * Export all FSRS data as JSON (for backup/analysis)
     */
    async debugExportData(): Promise<string> {
        try {
            const data = await this.debugGetAllData();
            const exportData = {
                exportDate: new Date().toISOString(),
                ...data
            };
            const jsonString = JSON.stringify(exportData, null, 2);
            console.log('🔧 DEBUG: Exported FSRS data');
            return jsonString;
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    /**
     * Import FSRS data from JSON (for restore/testing)
     */
    async debugImportData(jsonData: string): Promise<void> {
        try {
            const data = JSON.parse(jsonData);

            if (data.deckCards) {
                // Save each deck's cards
                for (const [deckId, cards] of Object.entries(data.deckCards)) {
                    await this.saveCardsToDeck(deckId, cards as FlashCard[]);
                }
            }
            if (data.dailyProgress) {
                await this.saveDailyProgress(data.dailyProgress);
            }
            if (data.sessions) {
                await AsyncStorage.setItem(this.STUDY_SESSIONS_KEY, JSON.stringify(data.sessions));
            }

            console.log('🔧 DEBUG: Imported FSRS data successfully');
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    }

    // A helper function to log all AsyncStorage data
    debugAsyncStorage = async () => {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const items = await AsyncStorage.multiGet(keys);

            console.log("--- AsyncStorage Content ---");
            if (items.length === 0) {
                console.log("No data found.");
            } else {
                items.forEach(([key, value]) => {
                    console.log(`${key}: ${value}`);
                });
            }
            console.log("--------------------------");

        } catch (error) {
            console.error("Error debugging AsyncStorage:", error);
        }
    };

    /**
     * Delete FSRS data for a specific card (now handled in useCards hook)
     * This method is kept for backward compatibility but is no longer needed
     */
    async deleteFSRSCardData(cardId: string): Promise<void> {
        console.log(`🔧 DEBUG: deleteFSRSCardData called for card ${cardId} - this is now handled automatically in the unified storage`);
        // No longer needed since cards are deleted from unified storage in useCards hook
    }
}

export const fsrsService = new FSRSService();
export { Rating, State };

