import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Button, IconButton, ProgressBar, Text } from 'react-native-paper';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import AudioPlayer from '@/components/AudioPlayer';
import BackgroundVideo, { FullScreenContainer } from '@/components/StudyBackground';
import { styles } from '@/components/StudyStyles';
import SubtitleDisplay from '@/components/SubtitleDisplay';
import { useCards } from '@/hooks/useCards';
import { useDecks } from '@/hooks/useDecks';
import { Rating, useFSRSStudy } from '@/hooks/useFSRSStudy';
import { useThemeColor } from '@/hooks/useThemeColor';
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

// BackgroundVideo and FullScreenContainer moved to components/StudyBackground

export default function StudyScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const tickerAudioPlayerRef = useRef<{ playAudio: () => void, stopAudio: () => void } | null>(null);
  const mainAudioPlayerRef = useRef<{ playAudio: () => void, stopAudio: () => void } | null>(null);
  const backgroundVideoRef = useRef<{ playVideo: () => void } | null>(null);
  const navigation = useNavigation();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  // TikTok-style swipe animation values
  const translateY = useSharedValue(0);
  const containerHeight = useSharedValue(0); // Will be set to screen height

  const { decks, loading: decksLoading } = useDecks();
  const { cards, loading: cardsLoading, updateCardStage } = useCards(id || '');

  // FSRS Integration
  const {
    fsrsCurrentCard,
    isStudyActive,
    currentCardIndex: fsrsCardIndex,
    progress: fsrsProgress,
    isLastCard,
    startStudySession,
    reviewCard,
    loading: fsrsLoading,
    nextCard
  } = useFSRSStudy(id || '', cards);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      clearRevealTimer();
    };
  }, []);

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
  //used for subtitle display
  const [audioPosition, setAudioPosition] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [timingData, setTimingData] = useState<any>(null);
  const [showRatingButtons, setShowRatingButtons] = useState(false);
  //used for calculating the amount of time spent on a card and giving to fsrs
  const [reviewStartTime, setReviewStartTime] = useState<Date | null>(null);
  const [isProcessingRating, setIsProcessingRating] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [nextVideoSource, setNextVideoSource] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(3);
  const [countdownInterval, setCountdownInterval] = useState<number | null>(null);

  const loading = decksLoading || cardsLoading || fsrsLoading;
  const isDiscussionStage = fsrsCurrentCard?.stage === Stage.Discussion;

  // TikTok-style swipe gesture for rating based on like state
  const handleSwipeUp = () => {
    console.log('👆 StudyScreen: handleSwipeUp called', { isFlipped, showRatingButtons, isDiscussionStage, isProcessingRating, isLiked });
    try {
      setIsProcessingRating(true);

      // Use the rating based on like state
      if (isDiscussionStage) {
        // If in discussion stage, just move to next card
        handleDiscussionNext();
      }
      else if (!isFlipped) {
        console.log("easy, skipped...");
        handleFSRSRating(Rating.Easy);
      }
      else {
        const rating = getRatingFromLikeState(isLiked);
        handleFSRSRating(rating);
      }
      handleNextCardOrComplete();

      console.log(`👍 StudyScreen: Triggering ${isLiked ? 'Hard' : 'Good'} rating via swipe`);
    } catch (error) {
      console.error('❌ StudyScreen: Error in handleSwipeUp', error);
      setIsProcessingRating(false);
    }
  };

  // Helper function to get rating based on like state
  const getRatingFromLikeState = (liked: boolean): Rating => {
    return liked ? Rating.Hard : Rating.Good;
  };

  // Start timer countdown after question audio finishes
  const startRevealTimer = () => {
    console.log("timer started");
    if (isTimerActive || isFlipped) return;

    setIsTimerActive(true);
    setTimerSeconds(3);

    console.log('🎵 AudioPlayer: Starting reveal timer');
    console.log(tickerAudioPlayerRef.current)
    tickerAudioPlayerRef.current?.playAudio();

    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimerActive(false);
          setCountdownInterval(null);
          handleFlip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setCountdownInterval(interval);
  };

  // Clear timer if needed
  const clearRevealTimer = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
    }
    setIsTimerActive(false);
    setTimerSeconds(3);
  };

  // Handle when audio finishes playing
  const handleAudioFinished = () => {
    if (!isFlipped && !isDiscussionStage) {
      // Start the reveal timer when question audio finishes
      setTimeout(() => {
        startRevealTimer();
      }, 500); // Small delay before starting timer
    }
  };

  // Handle like button toggle
  const handleLikeToggle = () => {
    setIsLiked(!isLiked);
  };

  // plays the animation after swipe gesture
  const swipeGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
    })
    .onChange((event) => {
      'worklet';
      if (event.translationY >= 0) return;
      const maxTranslate = -containerHeight.value;
      translateY.value = Math.max(Math.min(event.translationY, 0), maxTranslate);
    })
    .onEnd((event) => {
      'worklet';
      console.log('🎭 StudyScreen: Swipe gesture ended');
      try {
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
      if (!videoLoaded) return;
      console.log('🎭 StudyScreen: Resetting animation values for new card');
      translateY.value = 0;
      const newNextVideoSource = getVideoSource((fsrsCardIndex || 0) + 1);
      setNextVideoSource(newNextVideoSource);
      setVideoLoaded(false); // Reset video loaded state

      // Clear any active timer
      clearRevealTimer();
      loadTimingData();
      mainAudioPlayerRef.current?.playAudio();
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

  async function loadTimingData() {
    // Always use FSRS current card
    const currentCard = fsrsCurrentCard;
    if (!currentCard) return;

    // Check if we're in discussion stage
    setTimingData(null);

    try {
      // Get timing data for the current audio using local files
      let timingUri: string;

  const isInDiscussionStage = currentCard.stage === Stage.Discussion;

      if (isInDiscussionStage) {
        // In discussion stage, use discussion audio if available
        timingUri = currentCard.discussion.audio.signed_url_files.timing_file;
      } else {
        // In learning stage, use front/back audio as usual
        timingUri = isFlipped ? currentCard.final_card.answer_audio.signed_url_files.timing_file : currentCard.final_card.question_audio.signed_url_files.timing_file;
      }

      if (timingUri) {
        const timing = await ttsService.getTimingData(timingUri);
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

  const handleFlip = () => {
    // Clear any active timer
    clearRevealTimer();
    tickerAudioPlayerRef.current?.stopAudio();

    setIsFlipped(!isFlipped);
    setAudioPosition(0);
    // Don't force stop audio playing state - let AudioPlayer handle autoplay

    if (!isFlipped) {
      setShowRatingButtons(true);
      setReviewStartTime(new Date());
    }
  };

  // Common function to handle moving to the next card or ending the study session
  const handleNextCardOrComplete = () => {
    if (isLastCard) {
      setStudyComplete(true);
    } else {
      console.log('🎭 StudyScreen: Moving to next card');
      // Reset state for next card
      setIsFlipped(false);
      setAudioPosition(0);
      setIsLiked(false); // Reset like state for next card
      clearRevealTimer(); // Clear any active timer
      setReviewStartTime(null);
      mainAudioPlayerRef.current?.stopAudio();
      nextCard();
      // loadTimingData(); // Load timing data for the next card

      // there is some other stuff happening for handling next card, but it waits for the videoLoaded useState
    }
  };

  const handleDiscussionNext = async () => {
    if (!fsrsCurrentCard) return;
    try {
      // Update the card's stage to Learning in storage
      await updateCardStage(fsrsCurrentCard.id, Stage.Learning);
      setIsProcessingRating(false);
    } catch (error) {
      console.error('Error transitioning from discussion to learning:', error);
    }
  };

  const handleFSRSRating = async (rating: Rating) => {
    if (!fsrsCurrentCard || !reviewStartTime) return;
    const timeTaken = (new Date().getTime() - reviewStartTime.getTime()) / 1000;
    // Record the review with FSRS
    await reviewCard(rating, timeTaken);
    setIsProcessingRating(false); // Reset processing state
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
  const noCardsAvailable = !currentDeck || !cards || cards.length === 0;
  if (noCardsAvailable) {
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
        {/* Progress Bar - fixed position */}
        <View style={styles.progressContainerFixed}>
          <ProgressBar progress={fsrsProgress} color={tintColor} style={styles.progressBar} />
        </View>

        {/* Double-height animated container for TikTok-style scrolling */}
        <Animated.View style={[styles.doubleHeightContainer, containerAnimatedStyle]}>
          {/* Current card section (top half) */}
          <View style={styles.cardSection}>
            <BackgroundVideo
              videoSource={currentVideoSource}
              zIndex={-1}
              onVideoLoaded={() => setVideoLoaded(true)}
              ref={backgroundVideoRef}
            />
            <AudioPlayer
              audioUri={require('@/assets/audio/timer-tick.mp3')}
              autoPlay={false}
              ref={tickerAudioPlayerRef}>
            </AudioPlayer>


            <GestureDetector gesture={swipeGesture}>
              <View style={styles.safeAreaContainer}>
                <SafeAreaView style={styles.safeAreaContainer}>
                  <View style={styles.container}>
                    {/* Subtitle Display */}
                    <SubtitleDisplay
                      text={isDiscussionStage
                        ? fsrsCurrentCard?.discussion.text || ''
                        : (isFlipped ? fsrsCurrentCard?.final_card.back || '' : fsrsCurrentCard?.final_card.front || '')
                      }
                      timingData={timingData}
                      currentTime={audioPosition}
                      isPlaying={isAudioPlaying}
                    />

                    {/* Audio Player */}
                    {(() => {
                      let audioUri: string | undefined;
                      let audioLabel: string;

                      if (isDiscussionStage) {
                        audioUri = fsrsCurrentCard?.discussion.audio.signed_url_files.audio_file;
                        audioLabel = 'Discussion Audio';
                      } else {
                        audioUri = isFlipped ? fsrsCurrentCard?.final_card.answer_audio.signed_url_files.audio_file : fsrsCurrentCard?.final_card.question_audio.signed_url_files.audio_file;
                        audioLabel = isFlipped ? 'Answer Audio' : 'Question Audio';
                      }
                      return audioUri ? (
                        <View style={[styles.audioContainer, { display: 'none' }]}>
                          <AudioPlayer
                            audioUri={audioUri}
                            autoPlay={false}
                            size={24}
                            onPositionChange={setAudioPosition}
                            onPlayStateChange={setIsAudioPlaying}
                            onAudioFinished={handleAudioFinished}
                            ref={mainAudioPlayerRef}
                          />
                          <Text variant="bodySmall" style={{ color: textColor, textAlign: 'center', marginTop: 8 }}>
                            {audioLabel}
                          </Text>
                        </View>
                      ) : null;
                    })()}

                    {/* Timer Display */}
                    {!isDiscussionStage && !isFlipped && isTimerActive && (
                      <TouchableOpacity onPress={handleFlip} style={styles.timerContainer}>
                        <Text variant="headlineLarge" style={[styles.timerText, { color: tintColor }]}>
                          {timerSeconds}
                        </Text>
                        <Text variant="bodyMedium" style={{ color: textColor, textAlign: 'center', marginTop: 8 }}>
                          Auto-revealing answer...
                        </Text>
                        <Text variant="bodySmall" style={{ color: textColor, textAlign: 'center', marginTop: 4, opacity: 0.7 }}>
                          Tap to reveal now
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Manual reveal option when no timer is active */}
                    {!isDiscussionStage && !isFlipped && !isTimerActive && (
                      <View style={styles.flipContainer}>
                        <Button
                          mode="outlined"
                          onPress={handleFlip}
                          style={[styles.flipButton, { borderColor: tintColor }]}
                          labelStyle={{ color: tintColor }}
                        >
                          Tap to Reveal Answer
                        </Button>
                      </View>
                    )}
                  </View>
                </SafeAreaView>
                <View style={styles.likeButtonContainer}>
                  <IconButton
                    icon="heart"
                    iconColor={isLiked ? "red" : "white"}
                    size={48}
                    onPress={handleLikeToggle}
                  />
                </View>
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

// styles moved to components/StudyStyles
