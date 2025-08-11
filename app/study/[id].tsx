import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, IconButton, ProgressBar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import AudioPlayer from '@/components/AudioPlayer';
import FSRSRatingButtons from '@/components/FSRSRatingButtons';
import SubtitleDisplay from '@/components/SubtitleDisplay';
import { useCards } from '@/hooks/useCards';
import { useDecks } from '@/hooks/useDecks';
import { Rating, useFSRSStudy } from '@/hooks/useFSRSStudy';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useTTS } from '@/hooks/useTTS';
import { FlashCard, Stage } from '@/services/fsrsService';
import { ttsService } from '@/services/ttsService';

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
  cards?: FlashCard[];
}

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
  const { settings } = useTTS();

  
  const { decks, loading: decksLoading } = useDecks();
  const { cards, loading: cardsLoading, updateCardStage } = useCards(id || '');
  
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
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyComplete, setStudyComplete] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [timingData, setTimingData] = useState<any>(null);
  const [showRatingButtons, setShowRatingButtons] = useState(false);
  const [reviewOptions, setReviewOptions] = useState<any>(null);
  const [reviewStartTime, setReviewStartTime] = useState<Date | null>(null);
  const [isDiscussionStage, setIsDiscussionStage] = useState(false);

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

  // Initialize FSRS study session
  useEffect(() => {
    if (id && cards.length > 0 && !isStudyActive) {
      const studyMode = (mode as 'review' | 'all' | 'new') || 'review';
      startStudySession({ mode: studyMode });
    }
  }, [id, cards, isStudyActive, startStudySession]);

  // Load timing data when card changes
  useEffect(() => {
    const loadTimingData = async () => {
      // Always use FSRS current card
      const currentCard = fsrsCurrentCard;
      if (!currentCard) return;

      // Check if we're in discussion stage
      const inDiscussionStage = currentCard.stage === Stage.Discussion;
      setIsDiscussionStage(inDiscussionStage);

      setTimingData(null);
      
      try {
        // Get timing data for the current audio using local files
        let currentAudio: string | undefined;
        
        if (inDiscussionStage) {
          // In discussion stage, use discussion audio if available
          currentAudio = currentCard.discussion.audioFile;
        } else {
          // In learning stage, use front/back audio as usual
          currentAudio = isFlipped ? currentCard.finalCard.answerAudio : currentCard.finalCard.questionAudio;
        }
        
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
  }, [fsrsCardIndex, isFlipped, fsrsCurrentCard]);

  // Get current card and progress from FSRS
  const currentCard = fsrsCurrentCard;
  const progress = fsrsProgress;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setAudioPosition(0);
    // Don't force stop audio playing state - let AudioPlayer handle autoplay
    
    if (!isFlipped) {
      setShowRatingButtons(true);
      setReviewStartTime(new Date());
      loadReviewOptions();
    }
  };

  const handleDiscussionNext = async () => {
    if (!currentCard) return;

    try {
      // Update the card's stage to Learning in storage
      const success = await updateCardStage(currentCard.id, Stage.Learning);
      
      if (success) {
        // Update local state to reflect the change
        setIsDiscussionStage(false);
        setAudioPosition(0);
        
        console.log('Moved from Discussion to Learning stage for card:', currentCard.id);
      } else {
        console.error('Failed to update card stage');
      }
    } catch (error) {
      console.error('Error transitioning from discussion to learning:', error);
    }
  };

  const loadReviewOptions = async () => {
    if (currentCard) {
      const options = await getReviewOptions(currentCard.id);
      setReviewOptions(options);
    }
  };

  const handleFSRSRating = async (rating: Rating) => {
    if (!currentCard || !reviewStartTime) return;

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
          setIsDiscussionStage(false); // Reset discussion stage for next card
          // Don't force audio playing state - let AudioPlayer handle it
          setReviewStartTime(null);
        } else {
          setStudyComplete(true);
        }
      }
    }
  };

  const handleRestart = () => {
    // Always restart FSRS session
    const studyMode = (mode as 'review' | 'all' | 'new') || 'review';
    startStudySession({ mode: studyMode });
    setShowRatingButtons(false);
    setReviewOptions(null);
    setReviewStartTime(null);
    
    setIsFlipped(false);
    setStudyComplete(false);
    setCorrectCount(0);
    setAudioPosition(0);
    setIsDiscussionStage(false);
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
    const totalStudied = studyCards.length;
    const accuracy = Math.round((correctCount / totalStudied) * 100);
    
    return (
      <FullScreenContainer>
        <View style={[styles.completionContainer, { backgroundColor: backgroundColor }]}>
          <AntDesign name="checkcircle" size={64} color={tintColor} />
          <Text variant="headlineMedium" style={{ color: textColor, marginTop: 16, textAlign: 'center' }}>
            Study Complete!
          </Text>
          
          <View style={styles.completionButtons}>
            <Button mode="contained" onPress={handleFinish} style={styles.button}>
              Finish
            </Button>
          </View>
        </View>
      </FullScreenContainer>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <BackgroundVideo />
      {/* Progress Bar - directly under header */}
      <View style={styles.progressContainerFixed}>
        <ProgressBar progress={progress} color={tintColor} style={styles.progressBar} />
      </View>
      
      <SafeAreaView style={styles.safeAreaContainer}>
        <View style={styles.container}>
          {/* Subtitle Display */}
          <SubtitleDisplay
            text={isDiscussionStage 
              ? currentCard?.discussion.ssmlText || '' 
              : (isFlipped ? currentCard?.finalCard.back || '' : currentCard?.finalCard.front || '')
            }
            timingData={timingData}
            currentTime={audioPosition}
            isPlaying={isAudioPlaying}
            showFullText={!settings.enabled || !timingData}
          />

          {/* Audio Player */}
          {settings.enabled && (() => {
            let audioUri: string | undefined;
            let audioLabel: string;
            
            if (isDiscussionStage) {
              audioUri = currentCard?.discussion.audioFile;
              audioLabel = 'Discussion Audio';
            } else {
              audioUri = isFlipped ? currentCard?.finalCard.answerAudio : currentCard?.finalCard.questionAudio;
              audioLabel = isFlipped ? 'Answer Audio' : 'Question Audio';
            }
            
            return audioUri ? (
              <View style={[styles.audioContainer, { display: 'none' }]}>
                <AudioPlayer
                  audioUri={audioUri}
                  autoPlay={true} // Always autoplay when TTS is enabled
                  size={24}
                  onPositionChange={setAudioPosition}
                  onPlayStateChange={setIsAudioPlaying}
                />
                <Text variant="bodySmall" style={{ color: textColor, textAlign: 'center', marginTop: 8 }}>
                  {audioLabel}
                </Text>
              </View>
            ) : null;
          })()}

          {/* Discussion Stage - Next Button */}
          {isDiscussionStage && (
            <View style={styles.flipContainer}>
              <Button
                mode="contained"
                onPress={handleDiscussionNext}
                style={[styles.flipButton, { backgroundColor: tintColor }]}
                labelStyle={{ color: 'white' }}
              >
                Continue to Learning
              </Button>
            </View>
          )}

          {/* Learning Stage - Flip Button */}
          {!isDiscussionStage && !isFlipped && (
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

          {/* FSRS Rating Buttons - Only in Learning Stage */}
          {!isDiscussionStage && isFlipped && showRatingButtons && (
            <View style={styles.fsrsContainer}>
              <FSRSRatingButtons
                onRate={handleFSRSRating}
                reviewOptions={reviewOptions}
                showPreview={true}
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
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
  progressContainerFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  progressBar: {
    height: 8
  },
  fsrsContainer: {
    marginBottom: 16,
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
