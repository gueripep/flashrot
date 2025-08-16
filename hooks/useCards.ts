import { aiService } from '@/services/aiService';
import { Discussion, FinalCard, FlashCard, fsrsService, Stage } from '@/services/fsrsService';
import { ttsService } from '@/services/ttsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';



// Function to extract plain text from SSML string
const extractTextFromSSML = (ssmlString: string): string => {
  // Remove all SSML tags and extract just the text content
  return ssmlString
    .replace(/<[^>]*>/g, '') // Remove all XML/SSML tags
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .trim(); // Remove leading/trailing whitespace
};

export function useCards(deckId: string) {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);

  const STORAGE_KEY = `flashcards_${deckId}`;

  const loadCards = async () => {
    try {
      setLoading(true);
      const storedCards = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedCards) {
        const parsedCards: FlashCard[] = JSON.parse(storedCards);
        setCards(parsedCards);
      } else {
        // No cards found, initialize with empty array
        setCards([]);
      }
    } catch (error) {
      console.error('Error loading cards:', error);
      Alert.alert('Error', 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  const saveCard = async (front: string, back: string, useAI = false) => {
    try {
      const baseCard = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        deckId: deckId,
      };
      // Generate ai discussion
      const discussion = await getDiscussion(front, back);
      //generate final card
      const finalCard = await getFinalCard(baseCard, front, back, useAI);

      const fsrs = fsrsService.createNewFSRSCard(baseCard.id, deckId);

      const card: FlashCard = {
        ...baseCard,
        discussion,
        finalCard,
        fsrs,
        stage: Stage.Discussion,
      };
      // Only save the card after all processing is complete
      const updatedCards = [...cards, card];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      console.log('Card saved:', card);
      setCards(updatedCards);

      return true;
    } catch (error) {
      console.error('Error saving card:', error);
      Alert.alert('Error', 'Failed to save card');
      return false;
    }
  };

  const getDiscussion = async (front: string, back: string): Promise<Discussion> => {
    try {
      const discussionSsml = await aiService.generateCourse(front, back);
      const discussionText = extractTextFromSSML(discussionSsml);
      //generate audio for discussion
      const audioData = await ttsService.generateTTS(discussionSsml);
      console.log("discussion text:", discussionText);
      const discussion: Discussion = {
        ssmlText: discussionSsml,
        text: discussionText,
        audio: audioData
      };
      console.log('Generated discussion:', discussion);
      return discussion;
    } catch (error) {
      throw new Error('Failed to generate discussion');
    }
  };

  const getFinalCard = async (baseCard: any, front: string, back: string, useAI: boolean): Promise<FinalCard> => {
    // Generate AI answer if requested
    if (useAI) {
      const aiAnswer = await aiService.generateAnswer(front);
      if (aiAnswer) {
        back = aiAnswer;
      } else {
        throw new Error('AI failed to generate answer');
      }

    }
    const audioData = await ttsService.generateCardAudio(
      baseCard.id,
      front,
      back
    );


    console.log("Generated final card")
    const card: FinalCard = {
      front: front.trim(),
      back: useAI ? '' : back.trim(),
      questionAudio: audioData.questionAudio,
      answerAudio: audioData.answerAudio
    };
    return card;
  };

  const deleteCard = async (cardId: string) => {
    try {
      console.log('Deleting card:', cardId);
      // Find the card to get audio file paths
      const cardToDelete = cards.find(card => card.id === cardId);

      // Delete associated audio files
      await ttsService.deleteCardAudio(
        cardId,
        cardToDelete?.finalCard.questionAudio.filename,
        cardToDelete?.finalCard.answerAudio.filename
      );

      const updatedCards = cards.filter(card => card.id !== cardId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);
      return true;
    } catch (error) {
      console.error('Error deleting card:', error);
      Alert.alert('Error', 'Failed to delete card');
      return false;
    }
  };

  const updateCard = async (cardId: string, front: string, back: string) => {
    try {
      const updatedCards = cards.map(card =>
        card.id === cardId
          ? { ...card, front: front.trim(), back: back.trim() }
          : card
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);
      return true;
    } catch (error) {
      console.error('Error updating card:', error);
      Alert.alert('Error', 'Failed to update card');
      return false;
    }
  };

  const updateCardStage = async (cardId: string, stage: Stage) => {
    try {
      const updatedCards = cards.map(card =>
        card.id === cardId
          ? { ...card, stage, fsrs: { ...card.fsrs, due: new Date(Date.now() + 23 * 60 * 60 * 1000) } }
          : card
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);
      return true;
    } catch (error) {
      console.error('Error updating card stage:', error);
      Alert.alert('Error', 'Failed to update card stage');
      return false;
    }
  };

  const getCardById = (cardId: string): FlashCard | undefined => {
    return cards.find(card => card.id === cardId);
  };

  // Load cards on hook initialization
  useEffect(() => {
    if (deckId) {
      loadCards();
    }
  }, [deckId]);

  return {
    cards,
    loading,
    saveCard,
    deleteCard,
    updateCard,
    updateCardStage,
    getCardById,
    refreshCards: loadCards,
  };
}
