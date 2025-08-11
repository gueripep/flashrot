import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, BackHandler, StyleSheet, View } from 'react-native';
import {
  Button,
  IconButton,
  Modal,
  Portal,
  ProgressBar,
  Text
} from 'react-native-paper';

import FSRSRatingButtons from '@/components/FSRSRatingButtons';
import StudyCard from '@/components/StudyCard';
import SubtitleDisplay from '@/components/SubtitleDisplay';

import { useCards } from '@/hooks/useCards';
import { useDecks } from '@/hooks/useDecks';
import { Rating, useFSRSStudy } from '@/hooks/useFSRSStudy';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useTTS } from '@/hooks/useTTS';
import { ttsService } from '@/services/ttsService';

export default function FSRSStudyScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackgroundColor = useThemeColor({}, 'cardBackground');
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  
  const { settings } = useTTS();
  const { decks } = useDecks();
  const { cards } = useCards(id || '');
  
  const {
    studyCards,
    currentCard,
    isStudyActive,
    currentCardIndex,
    progress,
    cardsRemaining,
    isLastCard,
    startStudySession,
    endStudySession,
    reviewCard,
    nextCard,
    getReviewOptions,
    getRatingLabels,
    loading
  } = useFSRSStudy(id || '', cards);

  // Local state
  const [isFlipped, setIsFlipped] = useState(false);
  const [showRatingButtons, setShowRatingButtons] = useState(false);
  const [reviewOptions, setReviewOptions] = useState<any>(null);
  const [audioPosition, setAudioPosition] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [timingData, setTimingData] = useState<any>(null);
  const [showSessionComplete, setShowSessionComplete] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    cardsStudied: 0,
    correctAnswers: 0,
    startTime: new Date()
  });
  const [reviewStartTime, setReviewStartTime] = useState<Date | null>(null);

  const currentDeck = decks.find(d => d.id === id);

  // Set header
  useLayoutEffect(() => {
    if (currentDeck && isStudyActive) {
      navigation.setOptions({
        title: `Study: ${currentDeck.name}`,
        headerLeft: () => (
          <IconButton
            icon="close"
            iconColor={textColor}
            onPress={handleEndStudy}
          />
        ),
      });
    }
  }, [currentDeck, navigation, textColor, isStudyActive]);

  // Start study session when component mounts
  useEffect(() => {
    if (id && cards.length > 0 && !isStudyActive) {
      const studyMode = (mode as 'review' | 'all' | 'new') || 'review';
      startStudySession({ mode: studyMode });
    }
  }, [id, cards, mode, isStudyActive, startStudySession]);

  // Load timing data when card changes
  useEffect(() => {
    const loadTimingData = async () => {
      if (!currentCard) return;

      setTimingData(null);
      
      try {
        const currentAudio = isFlipped ? currentCard.answerAudio : currentCard.questionAudio;
        if (currentAudio) {
          const timing = await ttsService.getLocalTimingData(currentAudio);
          if (timing) {
            setTimingData(timing);
          }
        }
      } catch (error) {
        console.log('Error loading timing data:', error);
      }
    };

    loadTimingData();
  }, [currentCard, isFlipped]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isStudyActive) {
        handleEndStudy();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isStudyActive]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setAudioPosition(0);
    setIsAudioPlaying(false);
    
    if (!isFlipped) {
      // Card was flipped to answer side, show rating buttons and start timing
      setShowRatingButtons(true);
      setReviewStartTime(new Date());
      loadReviewOptions();
    }
  };

  const loadReviewOptions = async () => {
    if (currentCard) {
      const options = await getReviewOptions(currentCard.id);
      setReviewOptions(options);
    }
  };

  const handleRating = async (rating: Rating) => {
    if (!currentCard || !reviewStartTime) return;

    const timeTaken = (new Date().getTime() - reviewStartTime.getTime()) / 1000;
    const wasCorrect = rating >= Rating.Good;
    
    // Record the review
    const success = await reviewCard(rating, timeTaken);
    
    if (success) {
      // Update session stats
      setSessionStats(prev => ({
        ...prev,
        cardsStudied: prev.cardsStudied + 1,
        correctAnswers: prev.correctAnswers + (wasCorrect ? 1 : 0)
      }));

      // Move to next card or end session
      if (isLastCard) {
        setShowSessionComplete(true);
      } else {
        const hasNext = nextCard();
        if (hasNext) {
          // Reset state for next card
          setIsFlipped(false);
          setShowRatingButtons(false);
          setReviewOptions(null);
          setAudioPosition(0);
          setIsAudioPlaying(false);
          setReviewStartTime(null);
        } else {
          setShowSessionComplete(true);
        }
      }
    }
  };

  const handleEndStudy = () => {
    Alert.alert(
      'End Study Session',
      'Are you sure you want to end this study session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Session', 
          style: 'destructive',
          onPress: async () => {
            await endStudySession();
            router.back();
          }
        }
      ]
    );
  };

  const handleSessionComplete = async () => {
    await endStudySession();
    setShowSessionComplete(false);
    router.back();
  };

  const handleRestartSession = async () => {
    setShowSessionComplete(false);
    setSessionStats({
      cardsStudied: 0,
      correctAnswers: 0,
      startTime: new Date()
    });
    
    const studyMode = (mode as 'review' | 'all' | 'new') || 'review';
    await startStudySession({ mode: studyMode });
    
    // Reset card state
    setIsFlipped(false);
    setShowRatingButtons(false);
    setReviewOptions(null);
    setAudioPosition(0);
    setIsAudioPlaying(false);
    setReviewStartTime(null);
  };

  if (loading || !currentDeck) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.centerContent}>
          <Text variant="bodyLarge" style={{ color: textColor }}>
            Loading study session...
          </Text>
        </View>
      </View>
    );
  }

  if (!isStudyActive || studyCards.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.centerContent}>
          <Text variant="bodyLarge" style={{ color: textColor, textAlign: 'center' }}>
            No cards available for this study mode
          </Text>
          <Button mode="outlined" onPress={() => router.back()} style={{ marginTop: 20 }}>
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  if (!currentCard) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.centerContent}>
          <Text variant="bodyLarge" style={{ color: textColor }}>
            No current card available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.container, { backgroundColor }]}>
        {/* Progress Header */}
        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text variant="bodyMedium" style={{ color: textColor }}>
              Card {currentCardIndex + 1} of {studyCards.length}
            </Text>
            <Text variant="bodySmall" style={{ color: textColor, opacity: 0.7 }}>
              {cardsRemaining} remaining
            </Text>
          </View>
          <ProgressBar 
            progress={progress} 
            color={tintColor}
            style={styles.progressBar}
          />
        </View>

        {/* Study Card */}
        <View style={styles.cardContainer}>
          <StudyCard
            isFlipped={isFlipped}
            questionText={currentCard.front}
            answerText={currentCard.back}
            questionAudio={currentCard.questionAudio}
            answerAudio={currentCard.answerAudio}
            onFlip={handleFlip}
          />
          
          {/* Subtitle Display for TTS */}
          {settings.enabled && (
            <SubtitleDisplay
              text={isFlipped ? currentCard.back : currentCard.front}
              timingData={timingData}
              currentTime={audioPosition}
              isPlaying={isAudioPlaying}
              showFullText={false}
            />
          )}
        </View>

        {/* FSRS Rating Buttons */}
        {isFlipped && showRatingButtons && (
          <View style={styles.ratingContainer}>
            <FSRSRatingButtons
              onRate={handleRating}
              reviewOptions={reviewOptions}
              showPreview={true}
            />
          </View>
        )}
      </View>

      {/* Session Complete Modal */}
      <Portal>
        <Modal
          visible={showSessionComplete}
          onDismiss={() => {}}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: cardBackgroundColor }
          ]}
        >
          <Text variant="headlineSmall" style={[styles.modalTitle, { color: textColor }]}>
            Study Session Complete! 🎉
          </Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={[styles.statNumber, { color: tintColor }]}>
                {sessionStats.cardsStudied}
              </Text>
              <Text variant="bodyMedium" style={[styles.statLabel, { color: textColor }]}>
                Cards Studied
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={[styles.statNumber, { color: successColor }]}>
                {sessionStats.correctAnswers}
              </Text>
              <Text variant="bodyMedium" style={[styles.statLabel, { color: textColor }]}>
                Correct
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={[styles.statNumber, { color: tintColor }]}>
                {sessionStats.cardsStudied > 0 
                  ? Math.round((sessionStats.correctAnswers / sessionStats.cardsStudied) * 100)
                  : 0}%
              </Text>
              <Text variant="bodyMedium" style={[styles.statLabel, { color: textColor }]}>
                Accuracy
              </Text>
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={handleRestartSession}
              style={styles.modalButton}
            >
              Study Again
            </Button>
            <Button
              mode="contained"
              onPress={handleSessionComplete}
              style={[styles.modalButton, { backgroundColor: tintColor }]}
            >
              Finish
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  ratingContainer: {
    marginTop: 16,
    marginBottom: 32,
  },
  hintContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  hint: {
    textAlign: 'center',
    opacity: 0.7,
    fontStyle: 'italic',
  },
  modalContainer: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    opacity: 0.8,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  modalButton: {
    flex: 1,
  },
});
