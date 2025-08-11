import { StudyStats } from '@/hooks/useFSRSStudy';
import { useThemeColor } from '@/hooks/useThemeColor';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

interface StudyStatsCardProps {
  stats: StudyStats | null;
  loading?: boolean;
}

interface StatItemProps {
  value: string | number;
  label: string;
  color: string;
  isLoading?: boolean;
}

interface ProgressItemProps {
  label: string;
  value: string | number;
  progress: number;
  color: string;
  isLoading?: boolean;
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    opacity: 0.8,
    textAlign: 'center',
    fontSize: 12,
  },
  progressGrid: {
    gap: 12,
  },
  progressItem: {
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontWeight: '500',
  },
  progressNumber: {
    fontWeight: 'bold',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});

function StatItem({ value, label, color, isLoading = false }: StatItemProps) {
  const textColor = useThemeColor({}, 'text');
  
  return (
    <View style={styles.statItem}>
      <Text variant="headlineSmall" style={[
        styles.statNumber, 
        { 
          color: isLoading ? textColor : color, 
          opacity: isLoading ? 0.3 : 1 
        }
      ]}>
        {isLoading ? '--' : value}
      </Text>
      <Text variant="bodySmall" style={[styles.statLabel, { color: textColor }]}>
        {label}
      </Text>
    </View>
  );
}

function ProgressItem({ label, value, progress, color, isLoading = false }: ProgressItemProps) {
  const textColor = useThemeColor({}, 'text');
  
  return (
    <View style={styles.progressItem}>
      <View style={styles.progressHeader}>
        <Text variant="bodyMedium" style={[styles.progressLabel, { color: textColor }]}>
          {label}
        </Text>
        <Text variant="bodyMedium" style={[
          styles.progressNumber, 
          { 
            color: isLoading ? textColor : color, 
            opacity: isLoading ? 0.3 : 1 
          }
        ]}>
          {isLoading ? '--' : value}
        </Text>
      </View>
      <View style={[styles.progressBar, { backgroundColor: textColor + '20' }]}>
        <View style={[
          styles.progressFill, 
          { 
            backgroundColor: isLoading ? textColor + '30' : color,
            width: `${isLoading ? 0 : progress}%`
          }
        ]} />
      </View>
    </View>
  );
}

export default function StudyStatsCard({ stats, loading = false }: StudyStatsCardProps) {
  const textColor = useThemeColor({}, 'text');
  const cardBackgroundColor = useThemeColor({}, 'cardBackground');
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const warningColor = '#fd7e14';
  const errorColor = useThemeColor({}, 'error');

  // Helper functions
  const getStatusColor = (dueCards: number, totalCards: number) => {
    if (dueCards === 0) return successColor;
    if (dueCards / totalCards > 0.5) return errorColor;
    return warningColor;
  };


  const isInitialLoad = !stats;
  const isRefreshing = loading && !!stats;
  const safeStats = stats || {
    totalCards: 0,
    dueCards: 0,
    newCards: 0,
    learningCards: 0,
    reviewCards: 0
  };

  const dueCardsColor = isInitialLoad ? tintColor : getStatusColor(safeStats.dueCards, safeStats.totalCards);
  
  const learningProgress = safeStats.totalCards > 0 ? (safeStats.learningCards / safeStats.totalCards) * 100 : 0;
  const reviewProgress = safeStats.totalCards > 0 ? (safeStats.reviewCards / safeStats.totalCards) * 100 : 0;

  return (
    <Card style={[styles.card, { backgroundColor: cardBackgroundColor }]}>
      <Card.Content style={{ opacity: isRefreshing ? 0.7 : 1 }}>
        <Text variant="titleMedium" style={[styles.title, { color: textColor }]}>
          Study Statistics
        </Text>
        
        <View style={styles.statsGrid}>
          <StatItem
            value={safeStats.totalCards}
            label="Total Cards"
            color={tintColor}
            isLoading={isInitialLoad}
          />
          <StatItem
            value={safeStats.dueCards}
            label="Due Now"
            color={dueCardsColor}
            isLoading={isInitialLoad}
          />
          <StatItem
            value={safeStats.newCards}
            label="New Cards"
            color={tintColor}
            isLoading={isInitialLoad}
          />

        </View>

        <View style={styles.progressGrid}>
          <ProgressItem
            label="Learning"
            value={safeStats.learningCards}
            progress={learningProgress}
            color={warningColor}
            isLoading={isInitialLoad}
          />
          <ProgressItem
            label="Reviewing"
            value={safeStats.reviewCards}
            progress={reviewProgress}
            color={tintColor}
            isLoading={isInitialLoad}
          />
        </View>
      </Card.Content>
    </Card>
  );
}
