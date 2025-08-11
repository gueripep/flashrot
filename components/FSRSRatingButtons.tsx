import { useThemeColor } from '@/hooks/useThemeColor';
import { Rating } from '@/services/fsrsService';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

interface FSRSRatingButtonsProps {
  onRate: (rating: Rating) => void;
  disabled?: boolean;
  showPreview?: boolean;
  reviewOptions?: {[key: number]: { interval: number; due: Date }} | null;
}

export default function FSRSRatingButtons({
  onRate,
  disabled = false,
  showPreview = true,
  reviewOptions = null
}: FSRSRatingButtonsProps) {
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  const ratingData = [
    { 
      rating: Rating.Again, 
      label: 'Again', 
      color: '#dc3545',
      description: 'Incorrect'
    },
    { 
      rating: Rating.Hard, 
      label: 'Hard', 
      color: '#fd7e14',
      description: 'Difficult'
    },
    { 
      rating: Rating.Good, 
      label: 'Good', 
      color: '#198754',
      description: 'Correct'
    },
    { 
      rating: Rating.Easy, 
      label: 'Easy', 
      color: '#0dcaf0',
      description: 'Perfect'
    }
  ];

  const formatInterval = (days: number): string => {
    if (days === 0) return 'Now';
    if (days < 1) return '<1d';
    if (days === 1) return '1d';
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${Math.round(days / 365)}yr`;
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.buttonContainer}>
        {ratingData.map(({ rating, label, color, description }) => {
          const interval = reviewOptions?.[rating]?.interval;
          return (
            <View key={rating} style={styles.buttonWrapper}>
              <Button
                mode="contained"
                onPress={() => onRate(rating)}
                disabled={disabled}
                buttonColor={color}
                textColor="white"
                style={[
                  styles.ratingButton,
                  disabled && styles.disabledButton
                ]}
                labelStyle={styles.buttonLabel}
              >
                {label}
              </Button>
              
              <Text variant="bodySmall" style={[styles.buttonDescription, { color: textColor }]}>
                {description}
              </Text>
              
              {showPreview && interval !== undefined && (
                <Text variant="bodySmall" style={[styles.intervalText, { color: textColor }]}>
                  {formatInterval(interval)}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  hint: {
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.8,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  buttonWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  ratingButton: {
    borderRadius: 8,
    minWidth: 70,
    paddingVertical: 4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDescription: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 11,
    opacity: 0.7,
    fontWeight: '500',
  },
  intervalText: {
    textAlign: 'center',
    marginTop: 2,
    fontSize: 11,
    fontWeight: 'bold',
    opacity: 0.9,
  },
  previewHint: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 11,
    opacity: 0.6,
    fontStyle: 'italic',
  },
});
