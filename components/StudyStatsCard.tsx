import { StudyStats } from '@/hooks/useFSRSStudy';
import { useThemeColor } from '@/hooks/useThemeColor';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

interface StudyStatsCardProps {
  stats: StudyStats | null;
  loading?: boolean;
}

export default function StudyStatsCard({ stats, loading = false }: StudyStatsCardProps) {
  const textColor = useThemeColor({}, 'text');
  const cardBackgroundColor = useThemeColor({}, 'cardBackground');
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const warningColor = '#fd7e14';
  const errorColor = useThemeColor({}, 'error');

  if (loading) {
    return (
      <Card style={[styles.card, { backgroundColor: cardBackgroundColor }]}>
        <Card.Content>
          <Text variant="titleMedium" style={[styles.title, { color: textColor }]}>
            Study Statistics
          </Text>
          <Text variant="bodyMedium" style={[styles.loadingText, { color: textColor }]}>
            Loading statistics...
          </Text>
        </Card.Content>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const getStatusColor = (dueCards: number, totalCards: number) => {
    if (dueCards === 0) return successColor;
    if (dueCards / totalCards > 0.5) return errorColor;
    return warningColor;
  };

  const retentionColor = stats.avgRetention >= 0.8 ? successColor : 
                        stats.avgRetention >= 0.6 ? warningColor : errorColor;

  return (
    <Card style={[styles.card, { backgroundColor: cardBackgroundColor }]}>
      <Card.Content>
        <Text variant="titleMedium" style={[styles.title, { color: textColor }]}>
          Study Statistics
        </Text>
        
        <View style={styles.statsGrid}>
          {/* Total Cards */}
          <View style={styles.statItem}>
            <Text variant="headlineSmall" style={[styles.statNumber, { color: tintColor }]}>
              {stats.totalCards}
            </Text>
            <Text variant="bodySmall" style={[styles.statLabel, { color: textColor }]}>
              Total Cards
            </Text>
          </View>

          {/* Due Cards */}
          <View style={styles.statItem}>
            <Text variant="headlineSmall" style={[
              styles.statNumber, 
              { color: getStatusColor(stats.dueCards, stats.totalCards) }
            ]}>
              {stats.dueCards}
            </Text>
            <Text variant="bodySmall" style={[styles.statLabel, { color: textColor }]}>
              Due Now
            </Text>
          </View>

          {/* New Cards */}
          <View style={styles.statItem}>
            <Text variant="headlineSmall" style={[styles.statNumber, { color: tintColor }]}>
              {stats.newCards}
            </Text>
            <Text variant="bodySmall" style={[styles.statLabel, { color: textColor }]}>
              New Cards
            </Text>
          </View>

          {/* Avg Retention */}
          <View style={styles.statItem}>
            <Text variant="headlineSmall" style={[styles.statNumber, { color: retentionColor }]}>
              {Math.round(stats.avgRetention * 100)}%
            </Text>
            <Text variant="bodySmall" style={[styles.statLabel, { color: textColor }]}>
              Retention
            </Text>
          </View>
        </View>

        <View style={styles.progressGrid}>
          {/* Learning Cards */}
          <View style={styles.progressItem}>
            <View style={styles.progressHeader}>
              <Text variant="bodyMedium" style={[styles.progressLabel, { color: textColor }]}>
                Learning
              </Text>
              <Text variant="bodyMedium" style={[styles.progressNumber, { color: warningColor }]}>
                {stats.learningCards}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: textColor + '20' }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: warningColor,
                    width: `${stats.totalCards > 0 ? (stats.learningCards / stats.totalCards) * 100 : 0}%`
                  }
                ]} 
              />
            </View>
          </View>

          {/* Review Cards */}
          <View style={styles.progressItem}>
            <View style={styles.progressHeader}>
              <Text variant="bodyMedium" style={[styles.progressLabel, { color: textColor }]}>
                Reviewing
              </Text>
              <Text variant="bodyMedium" style={[styles.progressNumber, { color: tintColor }]}>
                {stats.reviewCards}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: textColor + '20' }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: tintColor,
                    width: `${stats.totalCards > 0 ? (stats.reviewCards / stats.totalCards) * 100 : 0}%`
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    opacity: 0.7,
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
