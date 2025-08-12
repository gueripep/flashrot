import { useThemeColor } from '@/hooks/useThemeColor';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

// Custom component for text with strong border
const BorderedText = ({ children, style, isHighlighted = false, ...props }: any) => {
    const textColor = 'white';
    const borderColor = '#000000';
    const tintColor = useThemeColor({}, 'tint');
    const getOutlineShadow = (color: string, width: number) => {
        return {
            textShadowColor: color,
            textShadowOffset: { width, height: 0 },
            textShadowRadius: 1,
        };
    };

    return (
        <View style={{
            backgroundColor: isHighlighted ? tintColor : 'transparent',
            borderRadius: 12,
            paddingHorizontal: 4,
            paddingVertical: 2,
            overflow: 'hidden', // Force clipping to border radius
            alignSelf: 'flex-start', // Ensure proper sizing
        }}>
            {/* Main text */}
            <Text {...props} style={[
                style,
                {
                    color: textColor,
                    ...getOutlineShadow(borderColor, -2),
                    ...getOutlineShadow(borderColor, 2),

                    // Only apply text shadow for non-highlighted words, with no offset
                    // ...(isHighlighted ? {} : {
                        
                    // }),
                }
            ]}>
                {children}
            </Text>
        </View>
    );
};

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
}

export default function SubtitleDisplay({
    text,
    timingData,
    currentTime,
    isPlaying,
}: SubtitleDisplayProps) {
    const textColor = useThemeColor({}, 'text');
    const tintColor = useThemeColor({}, 'tint');
    const backgroundColor = useThemeColor({}, 'background');
    const cardBackgroundColor = useThemeColor({}, 'cardBackground');

    const [highlightedWords, setHighlightedWords] = useState<Set<number>>(new Set());
    const [isReady, setIsReady] = useState(false);
    const previousHighlightedWords = useRef<Set<number>>(new Set());

    useEffect(() => {
        // We are ready to display subtitles if we should show the full text,
        // or if we have valid timing data.
        
        // A small delay helps prevent a "flash" of content if data arrives quickly.
        const timer = setTimeout(() => setIsReady(true), 50);
        
        return () => clearTimeout(timer);
    }, [timingData]);

    useEffect(() => {
        if (!timingData) {
            setHighlightedWords(new Set());
            previousHighlightedWords.current = new Set();
            return;
        }


        const highlighted = new Set<number>();
        timingData.word_timings?.forEach((wordTiming, index) => {
            // Calculate end time from start_time + duration, or use end_time if available
            const endTime = wordTiming.end_time ||
                (wordTiming.duration ? wordTiming.start_time + wordTiming.duration : wordTiming.start_time + 0.5);

            const isHighlighted = currentTime >= wordTiming.start_time && currentTime <= endTime;
            
            if (isHighlighted) {
                highlighted.add(index);
            }
        });
        
        // Update the previous state reference
        previousHighlightedWords.current = new Set(highlighted);
        setHighlightedWords(highlighted);
    }, [currentTime, timingData]);

    const getCurrentSubtitleChunk = () => {
        if (!timingData || !timingData.word_timings || timingData.word_timings.length === 0) {
            return { words: [], startIndex: 0 };
        }

        const maxWordsPerChunk = 4;
        const wordTimings = timingData.word_timings;
        
        // Find the current word being spoken
        let currentWordIndex = -1;
        for (let i = 0; i < wordTimings.length; i++) {
            const wordTiming = wordTimings[i];
            const endTime = wordTiming.end_time || 
                (wordTiming.duration ? wordTiming.start_time + wordTiming.duration : wordTiming.start_time + 0.5);
            
            if (currentTime >= wordTiming.start_time && currentTime <= endTime) {
                currentWordIndex = i;
                break;
            }
        }

        // If no current word is found, find the closest upcoming word
        if (currentWordIndex === -1) {
            for (let i = 0; i < wordTimings.length; i++) {
                if (currentTime < wordTimings[i].start_time) {
                    currentWordIndex = i;
                    break;
                }
            }
        }

        // If still no word found, use the last chunk
        if (currentWordIndex === -1) {
            currentWordIndex = wordTimings.length - 1;
        }

        // Find the chunk that contains the current word
        const chunkStartIndex = Math.floor(currentWordIndex / maxWordsPerChunk) * maxWordsPerChunk;
        const chunkEndIndex = Math.min(chunkStartIndex + maxWordsPerChunk, wordTimings.length);
        
        return {
            words: wordTimings.slice(chunkStartIndex, chunkEndIndex),
            startIndex: chunkStartIndex
        };
    };

    const renderTextWithHighlight = () => {
        if (!isReady) {
            return null;
        }

        const { words: currentChunk, startIndex } = getCurrentSubtitleChunk();

        // If we have timing data but no current chunk, show the first chunk
        if (currentChunk.length === 0 && timingData && timingData.word_timings.length > 0) {
            const firstChunk = timingData.word_timings.slice(0, Math.min(4, timingData.word_timings.length));
            return (
                <View style={styles.wordContainer}>
                    {firstChunk.map((wordTiming, index) => (
                        <BorderedText
                            key={index}
                            variant="headlineLarge"
                            style={styles.word}
                            isHighlighted={false}
                            tintColor={tintColor}
                        >
                            {wordTiming.word.toUpperCase()}
                        </BorderedText>
                    ))}
                </View>
            );
        }

        return (
            <View style={styles.wordContainer}>
                {currentChunk.map((wordTiming, index) => {
                    const globalIndex = startIndex + index;
                    const isHighlighted = highlightedWords.has(globalIndex);
                    return (
                        <BorderedText
                            key={globalIndex}
                            variant="headlineLarge"
                            style={styles.word}
                            isHighlighted={isHighlighted}
                            tintColor={tintColor}
                        >
                            {wordTiming.word.toUpperCase()}
                        </BorderedText>
                    );
                })}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.subtitleContainer}>
                {renderTextWithHighlight()}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        marginBottom: 24,
    },
    subtitleContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 240,
    },
    wordContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    word: {
        fontWeight: '900',
        textAlign: 'center',
        lineHeight: 36,
        fontSize: 24,
        fontFamily: Platform.OS === 'ios' ? 'Helvetica-Bold' : 'sans-serif-black',
    },
    highlightedWord: {
        // This style is now handled by BorderedText component
    },
    fullText: {
        textAlign: 'center',
        lineHeight: 52,
        fontWeight: '900',
        fontSize: 36,
        fontFamily: Platform.OS === 'ios' ? 'Helvetica-Bold' : 'sans-serif-black',
        paddingHorizontal: 16,
    },
    hint: {
        color: 'white',
        opacity: 0.8,
        marginTop: 16,
        textAlign: 'center',
        fontStyle: 'italic',
        fontWeight: '600',
        textShadowColor: '#000000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
});
