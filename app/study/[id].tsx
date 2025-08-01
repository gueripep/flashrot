import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, ProgressBar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlashCard, useCards } from '@/hooks/useCards';
import { useDecks } from '@/hooks/useDecks';
import { useThemeColor } from '@/hooks/useThemeColor';

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
  cards?: FlashCard[];
}

const { width: screenWidth } = Dimensions.get('window');

export default function StudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackgroundColor = useThemeColor({}, 'cardBackground');
  const tintColor = useThemeColor({}, 'tint');
  const errorColor = '#ef4444';
  const successColor = '#22c55e';
  
  const { decks, loading: decksLoading } = useDecks();
  const { cards, loading: cardsLoading } = useCards(id || '');
  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyComplete, setStudyComplete] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const loading = decksLoading || cardsLoading;

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

  const currentCard = cards[currentCardIndex];
  const progress = cards.length > 0 ? (currentCardIndex / cards.length) : 0;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    }

    // Move to next card
    if (cards.length > 0 && currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setStudyComplete(true);
    }
  };

  const handleRestart = () => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setStudyComplete(false);
    setCorrectCount(0);
  };

  const handleFinish = () => {
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.centerContent}>
          <Text variant="bodyLarge" style={{ color: textColor }}>
            Loading study session...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentDeck || !cards || cards.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.centerContent}>
          <Text variant="bodyLarge" style={{ color: textColor, textAlign: 'center' }}>
            No cards available for studying
          </Text>
          <Button mode="outlined" onPress={() => router.back()} style={{ marginTop: 20 }}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (studyComplete) {
    const accuracy = Math.round((correctCount / cards.length) * 100);
    
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.completionContainer}>
          <AntDesign name="checkcircle" size={64} color={successColor} />
          <Text variant="headlineMedium" style={{ color: textColor, marginTop: 16, textAlign: 'center' }}>
            Study Complete!
          </Text>
          <Text variant="bodyLarge" style={{ color: textColor, marginTop: 8, textAlign: 'center' }}>
            You got {correctCount} out of {cards.length} cards correct
          </Text>
          <Text variant="titleLarge" style={{ color: tintColor, marginTop: 16, textAlign: 'center' }}>
            {accuracy}% Accuracy
          </Text>
          
          <View style={styles.completionButtons}>
            <Button mode="outlined" onPress={handleRestart} style={styles.button}>
              Study Again
            </Button>
            <Button mode="contained" onPress={handleFinish} style={styles.button}>
              Finish
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text variant="bodyMedium" style={{ color: textColor, marginBottom: 8 }}>
          Card {currentCardIndex + 1} of {cards.length}
        </Text>
        <ProgressBar progress={progress} color={tintColor} style={styles.progressBar} />
      </View>

      {/* Study Card */}
      <View style={styles.cardContainer}>
        <Card style={[styles.studyCard, { backgroundColor: cardBackgroundColor }]} onPress={handleFlip}>
          <Card.Content style={styles.cardContent}>
            <Text variant="bodySmall" style={{ color: textColor, opacity: 0.6, marginBottom: 16 }}>
              {isFlipped ? 'Answer' : 'Question'}
            </Text>
            <Text variant="headlineSmall" style={{ color: textColor, textAlign: 'center', lineHeight: 32 }}>
              {isFlipped ? currentCard?.back : currentCard?.front}
            </Text>
            <Text variant="bodySmall" style={{ color: textColor, opacity: 0.4, marginTop: 16 }}>
              Tap to {isFlipped ? 'see question' : 'reveal answer'}
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Action Buttons */}
      {isFlipped && (
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

      {!isFlipped && (
        <View style={styles.hintContainer}>
          <Text variant="bodyMedium" style={{ color: textColor, opacity: 0.6, textAlign: 'center' }}>
            Think about your answer, then tap to reveal
          </Text>
        </View>
      )}
    </SafeAreaView>
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
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 24,
  },
  studyCard: {
    minHeight: 280,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  actionButtons: {
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
});
