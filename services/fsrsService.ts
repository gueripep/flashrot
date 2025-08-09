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
export interface EnhancedFlashCard {
    // Original card data
    id: string;
    front: string;
    back: string;
    createdAt: string;
    deckId: string;
    questionAudio?: string;
    answerAudio?: string;

    // FSRS data
    fsrs: Card;
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
    private readonly FSRS_CARDS_KEY = 'fsrs_cards';
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
     */
    async enhanceCard(card: any): Promise<EnhancedFlashCard> {
        const fsrsCards = await this.loadFSRSCards();
        let fsrsData = fsrsCards[card.id];

        if (!fsrsData) {
            // Create new FSRS data for this card
            fsrsData = this.createNewFSRSCard(card.id, card.deckId);
            await this.saveFSRSCardData(card.id, fsrsData);
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
    async getNewCardsForToday(deckId: string, allCards: any[]): Promise<EnhancedFlashCard[]> {
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

        const enhancedCards = await Promise.all(
            allCards
                .filter(card => card.deckId === deckId)
                .map(card => this.enhanceCard(card))
        );

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
    async getCardsForReview(deckId: string, allCards: any[]): Promise<EnhancedFlashCard[]> {
        const now = new Date();
        const enhancedCards = await Promise.all(
            allCards
                .filter(card => card.deckId === deckId)
                .map(card => this.enhanceCard(card))
        );

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
    async getAllCardsForDeck(deckId: string, allCards: any[]): Promise<EnhancedFlashCard[]> {
        const enhancedCards = await Promise.all(
            allCards
                .filter(card => card.deckId === deckId)
                .map(card => this.enhanceCard(card))
        );

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
        const fsrsCards = await this.loadFSRSCards();
        const currentFSRSData = fsrsCards[cardId];

        if (!currentFSRSData) {
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

        console.log('FSRS scheduling result:', schedulingCards);

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

        console.log('Selected card for rating', rating, ':', updatedCard);

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

        // Save updated FSRS data
        await this.saveFSRSCardData(cardId, newFSRSData);

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
        const fsrsCards = await this.loadFSRSCards();
        const currentFSRSData = fsrsCards[cardId];

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

        console.log('Review options schedulingCards:', schedulingCards);

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
        avgRetention: number;
    }> {
        const fsrsCards = await this.loadFSRSCards();
        const now = new Date();

        // Filter cards for this deck
        const deckCardIds = Object.keys(fsrsCards).filter(cardId => {
            // You might need to store deckId in FSRS data or cross-reference
            return true; // For now, we'll process all cards
        });

        let totalCards = 0;
        let newCards = 0;
        let learningCards = 0;
        let reviewCards = 0;
        let dueCards = 0;

        for (const cardId of deckCardIds) {
            const fsrsData = fsrsCards[cardId];
            totalCards++;

            if (fsrsData.state === State.New) {
                newCards++;
            } else if (fsrsData.state === State.Learning || fsrsData.state === State.Relearning) {
                learningCards++;
            } else if (fsrsData.state === State.Review) {
                reviewCards++;
            }

            console.log(`FSRS Data for card ${cardId}: due=${new Date(fsrsData.due).toLocaleString()}, now=${new Date(now).toLocaleString()}`);
            if (fsrsData.due <= now) {
                dueCards++;
            }
        }

        // Calculate average retention (simplified)
        const avgRetention = await this.calculateAverageRetention(deckId);

        return {
            totalCards,
            newCards,
            learningCards,
            reviewCards,
            dueCards,
            avgRetention
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

    // Private helper methods

    private async loadFSRSCards(): Promise<{ [cardId: string]: Card }> {
        try {
            const data = await AsyncStorage.getItem(this.FSRS_CARDS_KEY);
            const fsrsCards = data ? JSON.parse(data) : {};

            // Convert date strings back to Date objects
            for (const cardId in fsrsCards) {
                const card = fsrsCards[cardId];
                if (card.due && typeof card.due === 'string') {
                    card.due = new Date(card.due);
                }
                if (card.last_review && typeof card.last_review === 'string') {
                    card.last_review = new Date(card.last_review);
                }
            }

            return fsrsCards;
        } catch (error) {
            console.error('Error loading FSRS cards:', error);
            return {};
        }
    }

    private async saveFSRSCardData(cardId: string, fsrsData: Card): Promise<void> {
        try {
            const fsrsCards = await this.loadFSRSCards();
            fsrsCards[cardId] = fsrsData;
            await AsyncStorage.setItem(this.FSRS_CARDS_KEY, JSON.stringify(fsrsCards));
        } catch (error) {
            console.error('Error saving FSRS card data:', error);
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

    private async calculateAverageRetention(deckId: string): Promise<number> {
        // Simplified retention calculation
        // In a real implementation, you'd analyze review history
        return 0.85; // 85% default retention
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
            await AsyncStorage.removeItem(this.FSRS_CARDS_KEY);
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
            const fsrsCards = await this.loadFSRSCards();
            for (const cardId of cardIds) {
                delete fsrsCards[cardId];
            }
            await AsyncStorage.setItem(this.FSRS_CARDS_KEY, JSON.stringify(fsrsCards));
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
            const fsrsCards = await this.loadFSRSCards();
            const timeOffset = days * 24 * 60 * 60 * 1000; // Convert days to milliseconds
            
            // Update all card due dates by moving them backward in time
            // (making them more overdue if days is positive)
            for (const cardId in fsrsCards) {
                const card = fsrsCards[cardId];
                card.due = new Date(card.due.getTime() - timeOffset);
                if (card.last_review) {
                    card.last_review = new Date(card.last_review.getTime() - timeOffset);
                }
            }
            
            await AsyncStorage.setItem(this.FSRS_CARDS_KEY, JSON.stringify(fsrsCards));
            
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
            const fsrsCards = await this.loadFSRSCards();
            if (fsrsCards[cardId]) {
                fsrsCards[cardId].due = dueDate;
                await AsyncStorage.setItem(this.FSRS_CARDS_KEY, JSON.stringify(fsrsCards));
                console.log(`🔧 DEBUG: Set card ${cardId} due date to:`, dueDate);
            } else {
                console.warn(`🔧 DEBUG: Card ${cardId} not found in FSRS data`);
            }
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
            const fsrsCards = await this.loadFSRSCards();
            const now = new Date();
            
            for (const cardId in fsrsCards) {
                fsrsCards[cardId].due = now;
            }
            
            await AsyncStorage.setItem(this.FSRS_CARDS_KEY, JSON.stringify(fsrsCards));
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
        fsrsCards: { [cardId: string]: Card };
        dailyProgress: { date: string, newCardsStudied: number };
        sessions: { [sessionId: string]: StudySession };
    }> {
        try {
            const fsrsCards = await this.loadFSRSCards();
            const dailyProgress = await this.getDailyProgress();
            const sessions = await this.loadStudySessions();
            
            console.log('🔧 DEBUG: All FSRS Data:', {
                totalCards: Object.keys(fsrsCards).length,
                dailyProgress,
                totalSessions: Object.keys(sessions).length
            });
            
            return { fsrsCards, dailyProgress, sessions };
        } catch (error) {
            console.error('Error getting debug data:', error);
            throw error;
        }
    }

    /**
     * Create test cards with specific states (for testing)
     */
    async debugCreateTestCards(count: number, state: State = State.New): Promise<string[]> {
        try {
            const testCardIds: string[] = [];
            const now = new Date();
            
            for (let i = 0; i < count; i++) {
                const cardId = `debug_test_card_${Date.now()}_${i}`;
                const fsrsData: Card = {
                    due: state === State.New ? now : new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000), // Due in i+1 days
                    stability: 2.5,
                    difficulty: 5.0,
                    elapsed_days: 0,
                    scheduled_days: state === State.New ? 0 : i + 1,
                    reps: state === State.New ? 0 : 1,
                    lapses: 0,
                    state: state,
                    last_review: state === State.New ? undefined : now,
                    learning_steps: 0,
                };
                
                await this.saveFSRSCardData(cardId, fsrsData);
                testCardIds.push(cardId);
            }
            
            console.log(`🔧 DEBUG: Created ${count} test cards with state ${state}:`, testCardIds);
            return testCardIds;
        } catch (error) {
            console.error('Error creating test cards:', error);
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
            
            if (data.fsrsCards) {
                await AsyncStorage.setItem(this.FSRS_CARDS_KEY, JSON.stringify(data.fsrsCards));
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
}

export const fsrsService = new FSRSService();
export { Rating, State };

