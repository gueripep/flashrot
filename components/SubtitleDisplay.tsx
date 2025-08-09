import { useThemeColor } from '@/hooks/useThemeColor';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

interface WordTiming {
  word: string;
  start_time: number;
  duration?: number | null;
  end_time?: number;
  word_index?: number;
}

interface TimingData {
  text: string;
  word_timings: WordTiming[];
  audio_file: string;
}

interface SubtitleDisplayProps {
  text: string;
  timingData?: TimingData | null;
  currentTime: number;
  isPlaying: boolean;
  showFullText?: boolean;
}

export default function SubtitleDisplay({
  text,
  timingData,
  currentTime,
  isPlaying,
  showFullText = false
}: SubtitleDisplayProps) {
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackgroundColor = useThemeColor({}, 'cardBackground');
  
  const [highlightedWords, setHighlightedWords] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!timingData || !isPlaying) {
      setHighlightedWords(new Set());
      return;
    }

    // Debug: Log current time and timing data
    console.log('🕐 Current time:', currentTime);
    console.log('📊 Timing data available:', timingData.word_timings?.length || 0, 'words');

    // Find which words should be highlighted based on current time
    const highlighted = new Set<number>();
    timingData.word_timings?.forEach((wordTiming, index) => {
      // Calculate end time from start_time + duration, or use end_time if available
      const endTime = wordTiming.end_time || 
        (wordTiming.duration ? wordTiming.start_time + wordTiming.duration : wordTiming.start_time + 0.5);
      
      const isHighlighted = currentTime >= wordTiming.start_time && currentTime <= endTime;
      if (isHighlighted) {
        highlighted.add(index);
        console.log(`🔥 Highlighting word ${index}: "${wordTiming.word}" (${wordTiming.start_time.toFixed(2)}s - ${endTime.toFixed(2)}s) at time ${currentTime.toFixed(2)}s`);
      }
    });
    
    setHighlightedWords(highlighted);
  }, [currentTime, timingData, isPlaying]);

  const renderTextWithHighlight = () => {
    if (!timingData || showFullText) {
      return (
        <Text variant="headlineMedium" style={[styles.fullText, { color: textColor }]}>
          {text}
        </Text>
      );
    }

    // Debug: Log timing data structure
    console.log('🔍 Rendering with timing data:', {
      wordCount: timingData.word_timings?.length || 0,
      highlightedCount: highlightedWords.size,
      highlightedIndices: Array.from(highlightedWords)
    });

    return (
      <View style={styles.wordContainer}>
        {timingData.word_timings?.map((wordTiming, index) => {
          const isHighlighted = highlightedWords.has(index);
          return (
            <Text
              key={index}
              variant="headlineMedium"
              style={[
                styles.word,
                { 
                  color: isHighlighted ? 'white' : textColor,
                  backgroundColor: isHighlighted ? tintColor : 'transparent',
                }
              ]}
            >
              {wordTiming.word}
            </Text>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: cardBackgroundColor }]}>
      <View style={styles.subtitleContainer}>
        {renderTextWithHighlight()}
        {timingData && !showFullText && (
          <Text variant="bodySmall" style={[styles.hint, { color: textColor }]}>
            {isPlaying ? 'Following audio...' : 'Press play to see highlighted words'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 24,
    borderRadius: 12,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  subtitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  wordContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  word: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 32,
    fontSize: 20,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  fullText: {
    textAlign: 'center',
    lineHeight: 36,
    fontWeight: '600',
    fontSize: 22,
    paddingHorizontal: 16,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  hint: {
    opacity: 0.6,
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
