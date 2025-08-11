import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { Button, IconButton, ProgressBar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import AudioPlayer from '@/components/AudioPlayer';
import FSRSRatingButtons from '@/components/FSRSRatingButtons';
import SubtitleDisplay from '@/components/SubtitleDisplay';
import { FlashCard, useCards } from '@/hooks/useCards';
import { useDecks } from '@/hooks/useDecks';
import { Rating, useFSRSStudy } from '@/hooks/useFSRSStudy';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useTTS } from '@/hooks/useTTS';
import { ttsService } from '@/services/ttsService';

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
  cards?: FlashCard[];
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Background Video Component
const BackgroundVideo = () => {
  const player = useVideoPlayer(require('@/assets/videos/background-gameplay.webm'), player => {
    player.loop = true;
    player.muted = true;
    
    // Add a small delay to ensure the player is ready
    if (Platform.OS === 'web') {
      // On web, we need to handle autoplay differently
      setTimeout(() => {
        try {
          player.play();
        } catch (error) {
          // Autoplay failed, this is expected on web without user interaction
          console.log('Autoplay prevented by browser policy');
        }
      }, 100);
    } else {
      player.play();
    }
  });

  const handleVideoPress = () => {
    // On web, allow user to start video manually if autoplay failed
    if (Platform.OS === 'web') {
      player.play();
    }
  };

  return (
    <VideoView
      style={styles.backgroundVideo}
      player={player}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
      nativeControls={false}
      contentFit="cover"
      {...(Platform.OS === 'web' && {
        onPress: handleVideoPress,
        pointerEvents: 'auto'
      })}
    />
  );
};

// Full Screen Container with Background Video
const FullScreenContainer = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.fullScreenContainer}>
    <BackgroundVideo />
    <SafeAreaView style={styles.safeAreaContainer}>
      <View style={styles.container}>
        {children}
      </View>
    </SafeAreaView>
  </View>
);

export default function StudyScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const errorColor = useThemeColor({}, 'error');
  const successColor = useThemeColor({}, 'success');
  const { settings } = useTTS();

  
  const { decks, loading: decksLoading } = useDecks();
  const { cards, loading: cardsLoading } = useCards(id || '');
  
  // FSRS Integration
  const {
    studyCards,
    currentCard: fsrsCurrentCard,
    isStudyActive,
    currentCardIndex: fsrsCardIndex,
    progress: fsrsProgress,
    cardsRemaining,
    isLastCard,
    startStudySession,
    endStudySession,
    reviewCard,
    nextCard: fsrsNextCard,
    getReviewOptions,
    getRatingLabels,
    loading: fsrsLoading
  } = useFSRSStudy(id || '', cards);
  
  // Local state for study interface
  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyComplete, setStudyComplete] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [timingData, setTimingData] = useState<any>(null);
  const [showRatingButtons, setShowRatingButtons] = useState(false);
  const [reviewOptions, setReviewOptions] = useState<any>(null);
  const [reviewStartTime, setReviewStartTime] = useState<Date | null>(null);
  const [useFSRS, setUseFSRS] = useState(false);

  const loading = decksLoading || cardsLoading || fsrsLoading;

  // Set the header title dynamically
  useLayoutEffect(() => {
    if (currentDeck) {
      navigation.setOptions({
        title: `Study: ${currentDeck.name}`,
        headerLeft: () => (
          <IconButton
            icon="close"
            iconColor={textColor}
            onPress={() => router.back()}
          />
        ),
      });
    }
  }, [currentDeck, navigation, textColor, router]);

  useEffect(() => {
    if (id && decks.length > 0) {
      const deck = decks.find(d => d.id === id);
      if (deck) {
        setCurrentDeck({
          ...deck,
          cards: cards,
          cardCount: cards.length
        });
      }
    }
  }, [id, decks, cards]);

  // Initialize FSRS study session if mode is specified
  useEffect(() => {
    if (mode && id && cards.length > 0 && !isStudyActive) {
      setUseFSRS(true);
      const studyMode =  (mode as 'review' | 'all' | 'new') || 'review';
      startStudySession({ mode: studyMode });
    } else if (!mode) {
      setUseFSRS(false);
    }
  }, [id, cards, mode, isStudyActive, startStudySession]);

  // Load timing data when card changes
  useEffect(() => {
    const loadTimingData = async () => {
      // Use FSRS current card if FSRS is active, otherwise use regular cards
      const currentCard = useFSRS ? fsrsCurrentCard : cards[currentCardIndex];
      if (!currentCard) return;

      setTimingData(null);
      
      try {
        // Get timing data for the current audio using local files
        const currentAudio = isFlipped ? currentCard.answerAudio : currentCard.questionAudio;
        if (currentAudio) {
          const timing = await ttsService.getLocalTimingData(currentAudio);
          if (timing) {
            setTimingData(timing);
          } else {
            console.log('⚠️ No timing data available for this card');
          }
        }
      } catch (error) {
        console.log('⚠️ Error loading timing data:', error);
      }
    };

    loadTimingData();
  }, [useFSRS ? fsrsCardIndex : currentCardIndex, isFlipped, cards, fsrsCurrentCard, useFSRS]);

  // Get current card and progress based on mode
  const currentCard = useFSRS ? fsrsCurrentCard : cards[currentCardIndex];
  const progress = useFSRS ? fsrsProgress : (cards.length > 0 ? (currentCardIndex / cards.length) : 0);
  const totalCards = useFSRS ? studyCards.length : cards.length;
  const currentIndex = useFSRS ? fsrsCardIndex : currentCardIndex;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setAudioPosition(0);
    // Don't force stop audio playing state - let AudioPlayer handle autoplay
    
    if (!isFlipped && useFSRS) {
      // Card was flipped to answer side in FSRS mode
      setShowRatingButtons(true);
      setReviewStartTime(new Date());
      loadReviewOptions();
    }
  };

  const loadReviewOptions = async () => {
    if (currentCard && useFSRS) {
      const options = await getReviewOptions(currentCard.id);
      setReviewOptions(options);
    }
  };

  const handleFSRSRating = async (rating: Rating) => {
    if (!currentCard || !reviewStartTime || !useFSRS) return;

    const timeTaken = (new Date().getTime() - reviewStartTime.getTime()) / 1000;
    const wasCorrect = rating >= Rating.Good;
    
    // Record the review with FSRS
    const success = await reviewCard(rating, timeTaken);
    
    if (success) {
      if (wasCorrect) {
        setCorrectCount(prev => prev + 1);
      }

      // Move to next card or end session
      if (isLastCard) {
        setStudyComplete(true);
      } else {
        const hasNext = fsrsNextCard();
        if (hasNext) {
          // Reset state for next card
          setIsFlipped(false);
          setShowRatingButtons(false);
          setReviewOptions(null);
          setAudioPosition(0);
          // Don't force audio playing state - let AudioPlayer handle it
          setReviewStartTime(null);
        } else {
          setStudyComplete(true);
        }
      }
    }
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (useFSRS) {
      // In FSRS mode, use rating buttons instead
      return;
    }
    
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    }

    // Move to next card (legacy mode)
    if (cards.length > 0 && currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
      setAudioPosition(0);
      // Don't force audio playing state - let AudioPlayer handle it
    } else {
      setStudyComplete(true);
    }
  };

  const handleRestart = () => {
    if (useFSRS) {
      // Restart FSRS session
      const studyMode = (mode as 'review' | 'all' | 'new') || 'review';
      startStudySession({ mode: studyMode });
      setShowRatingButtons(false);
      setReviewOptions(null);
      setReviewStartTime(null);
    } else {
      setCurrentCardIndex(0);
    }
    
    setIsFlipped(false);
    setStudyComplete(false);
    setCorrectCount(0);
    setAudioPosition(0);
    // Don't force audio playing state - let AudioPlayer handle it
  };

  const handleFinish = () => {
    router.back();
  };

  if (loading) {
    return (
      <FullScreenContainer>
        <View style={styles.centerContent}>
          <Text variant="bodyLarge" style={{ color: textColor }}>
            Loading study session...
          </Text>
        </View>
      </FullScreenContainer>
    );
  }

  if (!currentDeck || !cards || cards.length === 0) {
    return (
      <FullScreenContainer>
        <View style={styles.centerContent}>
          <Text variant="bodyLarge" style={{ color: textColor, textAlign: 'center' }}>
            No cards available for studying
          </Text>
          <Button mode="outlined" onPress={() => router.back()} style={{ marginTop: 20 }}>
            Go Back
          </Button>
        </View>
      </FullScreenContainer>
    );
  }

  if (studyComplete) {
    const totalStudied = useFSRS ? studyCards.length : cards.length;
    const accuracy = Math.round((correctCount / totalStudied) * 100);
    
    return (
      <FullScreenContainer>
        <View style={styles.completionContainer}>
          <AntDesign name="checkcircle" size={64} color={successColor} />
          <Text variant="headlineMedium" style={{ color: textColor, marginTop: 16, textAlign: 'center' }}>
            Study Complete!
          </Text>
          <Text variant="bodyLarge" style={{ color: textColor, marginTop: 8, textAlign: 'center' }}>
            You got {correctCount} out of {totalStudied} cards correct
          </Text>
          <Text variant="titleLarge" style={{ color: tintColor, marginTop: 16, textAlign: 'center' }}>
            {accuracy}% Accuracy
          </Text>
          
          {useFSRS && (
            <Text variant="bodyMedium" style={{ color: textColor, marginTop: 8, textAlign: 'center', opacity: 0.8 }}>
              {useFSRS && cardsRemaining > 0 && `${cardsRemaining} cards scheduled for later review`}
            </Text>
          )}
          
          <View style={styles.completionButtons}>
            <Button mode="outlined" onPress={handleRestart} style={styles.button}>
              Study Again
            </Button>
            <Button mode="contained" onPress={handleFinish} style={styles.button}>
              Finish
            </Button>
          </View>
        </View>
      </FullScreenContainer>
    );
  }

  return (
    <FullScreenContainer>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text variant="bodyMedium" style={{ color: textColor, marginBottom: 8 }}>
          Card {currentIndex + 1} of {totalCards}
          {useFSRS && cardsRemaining > 0 && ` • ${cardsRemaining} remaining`}
        </Text>
        <ProgressBar progress={progress} color={tintColor} style={styles.progressBar} />
      </View>

      {/* Subtitle Display */}
      <SubtitleDisplay
        text={isFlipped ? currentCard?.back || '' : currentCard?.front || ''}
        timingData={timingData}
        currentTime={audioPosition}
        isPlaying={isAudioPlaying}
        showFullText={!settings.enabled || !timingData}
      />

      {/* Audio Player */}
      {settings.enabled && (isFlipped ? currentCard?.answerAudio : currentCard?.questionAudio) && (
        <View style={styles.audioContainer}>
          <AudioPlayer
            audioUri={isFlipped ? currentCard?.answerAudio : currentCard?.questionAudio}
            autoPlay={true} // Always autoplay when TTS is enabled
            size={24}
            onPositionChange={setAudioPosition}
            onPlayStateChange={setIsAudioPlaying}
          />
          <Text variant="bodySmall" style={{ color: textColor, textAlign: 'center', marginTop: 8 }}>
            {isFlipped ? 'Answer Audio' : 'Question Audio'}
          </Text>
        </View>
      )}

      {/* Flip Button */}
      {!isFlipped && (
        <View style={styles.flipContainer}>
          <Button
            mode="contained"
            onPress={handleFlip}
            style={[styles.flipButton, { backgroundColor: tintColor }]}
            labelStyle={{ color: 'white' }}
          >
            Reveal Answer
          </Button>
        </View>
      )}

      {/* Action Buttons */}
      {isFlipped && !useFSRS && (
        <View style={styles.actionButtons}>
          <Text variant="bodyMedium" style={{ color: textColor, textAlign: 'center', marginBottom: 16 }}>
            How well did you know this?
          </Text>
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={() => handleAnswer(false)}
              style={[styles.answerButton, { backgroundColor: errorColor }]}
              labelStyle={{ color: 'white' }}
            >
              Need Practice
            </Button>
            <Button
              mode="contained"
              onPress={() => handleAnswer(true)}
              style={[styles.answerButton, { backgroundColor: successColor }]}
              labelStyle={{ color: 'white' }}
            >
              Got It!
            </Button>
          </View>
        </View>
      )}

      {/* FSRS Rating Buttons */}
      {isFlipped && useFSRS && showRatingButtons && (
        <View style={styles.fsrsContainer}>
          <FSRSRatingButtons
            onRate={handleFSRSRating}
            reviewOptions={reviewOptions}
            showPreview={true}
          />
        </View>
      )}

      {!isFlipped && (
        <View style={styles.hintContainer}>
          <Text variant="bodyMedium" style={{ color: textColor, opacity: 0.6, textAlign: 'center' }}>
            Think about your answer, then tap to reveal
          </Text>
        </View>
      )}
    </FullScreenContainer>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    position: 'relative',
  },
  safeAreaContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
    opacity: 0.3,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  actionButtons: {
    marginBottom: 16,
  },
  fsrsContainer: {
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  answerButton: {
    flex: 1,
    paddingVertical: 4,
  },
  hintContainer: {
    marginBottom: 32,
  },
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completionButtons: {
    marginTop: 32,
    gap: 12,
    width: '100%',
  },
  button: {
    marginVertical: 4,
  },
  audioContainer: {
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  flipContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  flipButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
});
