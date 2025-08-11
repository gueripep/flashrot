import { useThemeColor } from '@/hooks/useThemeColor';
import { useTTS } from '@/hooks/useTTS';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import AudioPlayer from './AudioPlayer';

interface StudyCardProps {
  isFlipped: boolean;
  questionText: string;
  answerText: string;
  questionAudio?: string;
  answerAudio?: string;
  onFlip: () => void;
}

export default function StudyCard({ 
  isFlipped, 
  questionText, 
  answerText, 
  questionAudio,
  answerAudio,
  onFlip 
}: StudyCardProps) {
  const textColor = useThemeColor({}, 'text');
  const cardBackgroundColor = useThemeColor({}, 'cardBackground');
  const { settings } = useTTS();

  const currentAudio = isFlipped ? answerAudio : questionAudio;

  return (
    <View style={styles.cardContainer}>
      <Card style={[styles.studyCard, { backgroundColor: cardBackgroundColor }]} onPress={onFlip}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text variant="bodySmall" style={[
              styles.cardLabel,
              { color: textColor }
            ]}>
              {isFlipped ? 'Answer' : 'Question'}
            </Text>
            {settings.enabled && currentAudio && (
              <AudioPlayer
                audioUri={currentAudio}
                autoPlay={true} // Always autoplay when TTS is enabled
                size={20}
              />
            )}
          </View>
          <View style={styles.cardTextContainer}>
            <Text variant="headlineSmall" style={[
              styles.cardMainText,
              { color: textColor }
            ]}>
              {isFlipped ? answerText : questionText}
            </Text>
          </View>
          <Text variant="bodySmall" style={[
            styles.cardHint,
            { color: textColor }
          ]}>
            Tap to {isFlipped ? 'see question' : 'reveal answer'}
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 24,
  },
  studyCard: {
    minHeight: 280,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  cardLabel: {
    opacity: 0.8,
    textAlign: 'center',
    fontWeight: '500',
    flex: 1,
  },
  cardTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    minHeight: 120,
  },
  cardMainText: {
    textAlign: 'center',
    lineHeight: 32,
    fontWeight: '600',
    fontSize: 20,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  cardHint: {
    opacity: 0.6,
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '400',
  },
});
