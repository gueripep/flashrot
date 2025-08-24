import { aiService } from "@/services/aiService";
import {
  Discussion,
  FinalCard,
  FlashCard,
  fsrsService,
  Stage,
} from "@/services/fsrsService";
import { createSyncManager } from "@/services/syncService";
import { ttsService } from "@/services/ttsService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

// Function to extract plain text from SSML string
const extractTextFromSSML = (ssmlString: string): string => {
  // Remove all SSML tags and extract just the text content
  return ssmlString
    .replace(/<[^>]*>/g, "") // Remove all XML/SSML tags
    .replace(/\s+/g, " ") // Replace multiple whitespace with single space
    .trim(); // Remove leading/trailing whitespace
};

export function useCards(deckId: string) {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);

  const STORAGE_KEY = `flashcards_${deckId}`;
  const SYNC_QUEUE_KEY = `flashcardsSyncQueue_${deckId}`;

  function isUUID(id: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    );
  }

  // Sync manager for cards
  const syncManager = createSyncManager<FlashCard>({
    resourcePath: "/flashcards",
    storageKey: STORAGE_KEY,
    syncQueueKey: SYNC_QUEUE_KEY,
    getId: (c) => c.id,
    mapServerResponseToId: (resp) => resp?.id,
    transformCreateBody: (c) => ({
      deck_id: c.deck_id,
      stage: c.stage,
      discussion: {
        ssml_text: c.discussion.ssmlText,
        text: c.discussion.text,
        audio: {
          filename: c.discussion.audio.filename,
          timing_filename: c.discussion.audio.timing_filename,
        },
      },
      final_card: {
        front: c.final_card.front,
        back: c.final_card.back,
        question_audio: {
          filename: c.final_card.question_audio.filename,
          timing_filename: c.final_card.question_audio.timing_filename,
        },
        answer_audio: {
          filename: c.final_card.answer_audio.filename,
          timing_filename: c.final_card.answer_audio.timing_filename,
        },
      },
      fsrs: {
        due: c.fsrs.due,
        stability: c.fsrs.stability,
        difficulty: c.fsrs.difficulty,
        elapsed_days: c.fsrs.elapsed_days,
        scheduled_days: c.fsrs.scheduled_days,
        reps: c.fsrs.reps,
        lapses: c.fsrs.lapses,
        state: c.fsrs.state,
        learning_steps: c.fsrs.learning_steps,
        audio_id: (c.fsrs as any).audio_id ?? 0,
      },
    }),
    transformUpdateBody: (c) => ({
      stage: c.stage,
      discussion: {
        ssml_text: c.discussion.ssmlText,
        text: c.discussion.text,
        audio: {
          filename: c.discussion.audio.filename,
          timing_filename: c.discussion.audio.timing_filename,
        },
      },
      final_card: {
        front: c.final_card.front,
        back: c.final_card.back,
        question_audio: {
          filename: c.final_card.question_audio.filename,
          timing_filename: c.final_card.question_audio.timing_filename,
        },
        answer_audio: {
          filename: c.final_card.answer_audio.filename,
          timing_filename: c.final_card.answer_audio.timing_filename,
        },
      },
      fsrs: {
        due: c.fsrs.due,
        stability: c.fsrs.stability,
        difficulty: c.fsrs.difficulty,
        elapsed_days: c.fsrs.elapsed_days,
        scheduled_days: c.fsrs.scheduled_days,
        reps: c.fsrs.reps,
        lapses: c.fsrs.lapses,
        state: c.fsrs.state,
        learning_steps: c.fsrs.learning_steps,
      },
    }),
    updateLocalAfterSync: async (localId, updates) => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const localCards: FlashCard[] = raw ? JSON.parse(raw) : [];
        const idx = localCards.findIndex((c) => c.id === localId);
        if (idx >= 0) {
          localCards[idx] = { ...localCards[idx], ...updates };
        }
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(localCards));
        setCards(localCards);
      } catch (e) {
        console.error("Error updating local card after sync:", e);
      }
    }
  });

  const enqueueCardForSync = syncManager.enqueueCreate;
  const enqueueUpdateForSync = syncManager.enqueueUpdate;
  const enqueueDeleteForSync = syncManager.enqueueDelete;
  const processSyncQueue = syncManager.processQueue;

  const loadCards = async () => {
    try {
      setLoading(true);
      await loadLocalCards();
      // after loading local cards, try to flush local changes to server
      await processSyncQueue();
      // then fetch authoritative cards from server and merge
      await syncManager.fetchAndMerge();
      // finally reload local cards to reflect any changes
      await loadLocalCards();
    } catch (error) {
      console.error("Error loading cards:", error);
      Alert.alert("Error", "Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  const loadLocalCards = async () => {
    const storedCards = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedCards) {
      const parsedCards: FlashCard[] = JSON.parse(storedCards);
      const deckCards = parsedCards.filter((c) => c.deck_id === deckId);
      setCards(deckCards);
    }
  };

  const saveCard = async (front: string, back: string) => {
    try {
      const baseCard = {
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        deck_id: deckId,
      };
      const card = await generateCardContent(front, back, baseCard);
      // Only save the card after all processing is complete
      const updatedCards = [...cards, card];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);
      // Try to sync to server in background; if it fails we enqueue for retry
      enqueueCardForSync(card).catch((err) => {
        // already handled in enqueue; swallow here but log for debug
        console.debug("enqueueCardForSync error:", err);
      });
      return true;
    } catch (error) {
      console.error("Error saving card:", error);
      Alert.alert("Error", "Failed to save card");
      return false;
    }
  };

  const generateCardContent = async (
    front: string,
    back: string,
    baseCard: any
  ): Promise<FlashCard> => {
    // Generate ai discussion
    const discussion = await getDiscussion(front, back);
    //generate final card
    const final_card = await getFinalCard(baseCard, front, back);

    const fsrs = fsrsService.createNewFSRSCard(baseCard.id, deckId);

    const card: FlashCard = {
      ...baseCard,
      discussion,
      final_card,
      fsrs,
      stage: Stage.Discussion,
    };

    return card;
  };

  const getDiscussion = async (
    front: string,
    back: string
  ): Promise<Discussion> => {
    try {
      const discussionSsml = await aiService.generateCourse(front, back);
      const discussionText = extractTextFromSSML(discussionSsml);
      //generate audio for discussion
      const audioData = await ttsService.generateTTS(discussionSsml);
      console.log("discussion text:", discussionText);
      const discussion: Discussion = {
        ssmlText: discussionSsml,
        text: discussionText,
        audio: audioData,
      };
      console.log("Generated discussion:", discussion);
      return discussion;
    } catch (error) {
      throw new Error("Failed to generate discussion");
    }
  };

  const getFinalCard = async (
    baseCard: any,
    front: string,
    back: string
  ): Promise<FinalCard> => {
    const audioData = await ttsService.generateCardAudio(
      baseCard.id,
      front,
      back
    );

    const card: FinalCard = {
      front: front.trim(),
      back: back.trim(),
      question_audio: audioData.questionAudio,
      answer_audio: audioData.answerAudio,
    };
    return card;
  };

  const deleteCard = async (cardId: string) => {
    try {
      console.log("Deleting card:", cardId);
      // Find the card to get audio file paths
      const cardToDelete = cards.find((card) => card.id === cardId);

      // Delete associated audio files
      await ttsService.deleteCardAudio(
        cardId,
        cardToDelete?.final_card.question_audio.local_files?.audio_file,
        cardToDelete?.final_card.answer_audio.local_files?.audio_file
      );

      const updatedCards = cards.filter((card) => card.id !== cardId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);
      // If it is a uuid it means the card was saved on server
      if (isUUID(cardId)) {
        enqueueDeleteForSync(cardId).catch((err) =>
          console.debug("enqueueDeleteForSync err", err)
        );
      }
      return true;
    } catch (error) {
      console.error("Error deleting card:", error);
      Alert.alert("Error", "Failed to delete card");
      return false;
    }
  };

  const updateCard = async (cardId: string, front: string, back: string, stage: Stage, generateDiscussionAndTTS: boolean = false) => {
    try {
      const updatedCards = cards.map((card) =>
        card.id === cardId
          ? {
            ...card,
            stage,
            final_card: {
              ...card.final_card,
              front: front.trim(),
              back: back.trim(),
            },
          }
          : card
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);
      // try to sync update remotely; enqueue on failure
      let updatedLocal = updatedCards.find((c) => c.id === cardId);
      if (updatedLocal) {
        if (generateDiscussionAndTTS) {
          updatedLocal = await generateCardContent(updatedLocal.final_card.front, updatedLocal.final_card.back, updatedLocal);
        }
        enqueueUpdateForSync(updatedLocal).catch((err) =>
          console.debug("enqueueUpdateForSync err", err)
        );
      }
      return true;
    } catch (error) {
      console.error("Error updating card:", error);
      Alert.alert("Error", "Failed to update card");
      return false;
    }
  };

  const getCardById = (cardId: string): FlashCard | undefined => {
    return cards.find((card) => card.id === cardId);
  };

  // Load cards on hook initialization
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (deckId) {
      loadCards();
      // attempt any pending syncs when the hook initializes
      processSyncQueue();
      // set up periodic retry every 30 seconds while mounted
      interval = setInterval(() => {
        processSyncQueue();
      }, 30_000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [deckId]);

  return {
    cards,
    loading,
    saveCard,
    deleteCard,
    updateCard,
    getCardById,
    refreshCards: loadCards,
  };
}
