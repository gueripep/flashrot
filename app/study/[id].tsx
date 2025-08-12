import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Button, IconButton, ProgressBar, Text } from 'react-native-paper';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
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
import { Gesture } from 'react-native-gesture-handler';

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
  cards?: FlashCard[];
}

// Background Video Component
const BackgroundVideo = ({ 
  videoSource, 
  animatedStyle, 
  zIndex = -1,
  paused = false,
  onVideoLoaded
}: { 
  videoSource: any;
  animatedStyle?: any;
  zIndex?: number;
  paused?: boolean;
  onVideoLoaded?: () => void;
}) => {
  const player = useVideoPlayer(videoSource, player => {
    player.loop = true;
    player.muted = true;
    if (paused) {
      player.pause();
    } else {
      player.play();
    }

    // Notify when the video is ready
    player.addListener('sourceChange', () => {
      console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      if (onVideoLoaded) {
        console.log('Video loaded callback triggered');

        setTimeout(() => {
          onVideoLoaded();
        }, 200); // Delay the callback by 200 milliseconds
      }
    });
  });

  return (
    <Animated.View style={[styles.backgroundVideoContainer, { zIndex }, animatedStyle]}>
      <VideoView
        style={styles.backgroundVideo}
        player={player}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        nativeControls={false}
        contentFit="cover"
      />
    </Animated.View>
  );
};

// Full Screen Container with Background Video
const FullScreenContainer = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.fullScreenContainer}>
    <BackgroundVideo videoSource={require('@/assets/videos/parkour.mp4')} />
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

  // TikTok-style swipe animation values
  const translateY = useSharedValue(0);
  const containerHeight = useSharedValue(0); // Will be set to screen height
  
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

  // Function to get video source based on card index
  const getVideoSource = (cardIndex: number) => {
    const videos = [
      require('@/assets/videos/parkour.mp4'),
      require('@/assets/videos/background-gameplay.webm'),
      // Add more videos here as needed, or cycle through existing ones
    ];
    return videos[cardIndex % videos.length];
  };

  // Get current and next video sources
  const currentVideoSource = getVideoSource(fsrsCardIndex || 0);
  
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
  const [isProcessingRating, setIsProcessingRating] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [nextVideoSource, setNextVideoSource] = useState<any>(null);


  const loading = decksLoading || cardsLoading || fsrsLoading;

  // TikTok-style swipe gesture for "Good" rating
  const handleSwipeUp = () => {
    console.log('👆 StudyScreen: handleSwipeUp called', { isFlipped, showRatingButtons, isDiscussionStage, isProcessingRating });
    try {
      if (isProcessingRating) {
        console.log('⚠️ StudyScreen: handleSwipeUp blocked - already processing rating');
        return;
      }
      
      if (!isFlipped || !showRatingButtons || isDiscussionStage) {
        console.log('⚠️ StudyScreen: handleSwipeUp blocked - invalid state');
        return;
      }
      
      if (!currentCard || !reviewStartTime) {
        console.log('⚠️ StudyScreen: handleSwipeUp blocked - missing data', { 
          hasCurrentCard: !!currentCard, 
          hasReviewStartTime: !!reviewStartTime 
        });
        return;
      }
      
      setIsProcessingRating(true);
      
      // Trigger "Good" rating (Rating.Good = 2)
      console.log('👍 StudyScreen: Triggering Good rating via swipe');
      handleFSRSRating(Rating.Good);
    } catch (error) {
      console.error('❌ StudyScreen: Error in handleSwipeUp', error);
      setIsProcessingRating(false);
    }
  };

  // plays the animation after swipe gesture
  const swipeGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
    })
    .onChange((event) => {
      'worklet';
      // Only respond to upward swipes when card is flipped and rating buttons are shown
      if (!isFlipped || !showRatingButtons || isDiscussionStage) return;
      
      // Only allow upward swipes (negative Y)
      if (event.translationY >= 0) return;
      
      // Move the entire container up as user swipes
      // Clamp between 0 and -screenHeight to prevent over-scrolling
      const maxTranslate = -containerHeight.value;
      translateY.value = Math.max(Math.min(event.translationY, 0), maxTranslate);
    })
    .onEnd((event) => {
      'worklet';
      console.log('🎭 StudyScreen: Swipe gesture ended');
      try {
        if (!isFlipped || !showRatingButtons || isDiscussionStage) return;
        
        const swipeThreshold = -100;
        const screenHeight = containerHeight.value;
        
        if (event.translationY < swipeThreshold) {
          // Swipe threshold reached - complete the transition to next video
          translateY.value = withSpring(-screenHeight, { damping: 100, stiffness: 1000 }, (isFinished: any) => {
            if (isFinished) {
              runOnJS(handleSwipeUp)();
            }
          });          
        } else {
          // Swipe not far enough - reset position
          translateY.value = withSpring(0, { damping: 15, stiffness: 250 });
        }
      } catch (error) {
        console.log('❌ StudyScreen: Error in swipe onEnd', error);
      }
    })
    .activeOffsetY([-10, 10]) // Activate after 10px vertical movement
    .failOffsetX([-20, 20]); // Fail if horizontal movement exceeds 20px

  // Reset animation values when card changes
  useEffect(() => {
    try {
      translateY.value = 0;
      const newNextVideoSource = getVideoSource((fsrsCardIndex || 0) + 1);
      setNextVideoSource(newNextVideoSource);
      setVideoLoaded(false); // Reset video loaded state
      console.log('✅ StudyScreen: Animation values reset successfully');
    } catch (error) {
      console.error('❌ StudyScreen: Error resetting animation values', error);
    }
  }, [videoLoaded]);

  // transform responsible to follow your thumb as you swipe
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
    ],
  }));

  // No individual video animations needed - they move with the container

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
      if(inDiscussionStage){
        console.log("currentCard.discussion.text:", currentCard.discussion.text);
      }
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
    
    setIsProcessingRating(false); // Reset processing state
    
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

  try {
    return (
      <View 
        style={styles.fullScreenContainer}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          containerHeight.value = height;
        }}
      >
        {/* Double-height animated container for TikTok-style scrolling */}
        <Animated.View style={[styles.doubleHeightContainer, containerAnimatedStyle]}>
          {/* Current card section (top half) */}
          <View style={styles.cardSection}>
            <BackgroundVideo 
              videoSource={currentVideoSource}
              zIndex={-1}
              onVideoLoaded={() => setVideoLoaded(true)}
            />
            
            {/* Progress Bar - fixed position */}
            <View style={styles.progressContainerFixed}>
              <ProgressBar progress={progress} color={tintColor} style={styles.progressBar} />
            </View>
            
            <GestureDetector gesture={swipeGesture}>
              <View style={styles.safeAreaContainer}>
                <SafeAreaView style={styles.safeAreaContainer}>
                  <View style={styles.container}>
                    {/* Subtitle Display */}
                    <SubtitleDisplay
                      text={isDiscussionStage 
                        ? currentCard?.discussion.text || '' 
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
                        <Text style={[styles.swipeHint, { color: textColor }]}>
                          Swipe up for "Good" or tap a button
                        </Text>
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
            </GestureDetector>
          </View>
          
          {/* Next card section (bottom half) */}
          <View style={styles.cardSection}>
            <BackgroundVideo 
              videoSource={nextVideoSource}
              zIndex={-1}
              paused={true}
            />
          </View>
        </Animated.View>
      </View>
    );
  } catch (error) {
    console.error('❌ StudyScreen: Error rendering main interface', error);
    return (
      <FullScreenContainer>
        <View style={styles.centerContent}>
          <Text variant="bodyLarge" style={{ color: textColor, textAlign: 'center' }}>
            Error loading study interface
          </Text>
          <Button mode="outlined" onPress={() => router.back()} style={{ marginTop: 20 }}>
            Go Back
          </Button>
        </View>
      </FullScreenContainer>
    );
  }
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden', // Clip the double-height container
  },
  doubleHeightContainer: {
    height: '200%', // Double the screen height
    position: 'relative',
  },
  cardSection: {
    height: '50%', // Each section takes half the double-height container (i.e., full screen)
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
  backgroundVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
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
  nextCardPreview: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  nextCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  nextCardText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    opacity: 0.7,
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
    opacity: 0.7,
    fontStyle: 'italic',
  },
});
