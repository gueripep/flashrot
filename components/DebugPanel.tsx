import { useFSRSStudy } from '@/hooks/useFSRSStudy';
import { useThemeColor } from '@/hooks/useThemeColor';
import { State } from '@/services/fsrsService';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text, TextInput } from 'react-native-paper';

interface DebugPanelProps {
  deckId: string;
  allCards: any[];
  onRefresh?: () => void;
}

export default function DebugPanel({ deckId, allCards, onRefresh }: DebugPanelProps) {
  const { debug, refreshData } = useFSRSStudy(deckId, allCards);
  const [timeTravel, setTimeTravel] = useState('1');
  const [testCardCount, setTestCardCount] = useState('3');
  const [dailyProgress, setDailyProgress] = useState('5');
  
  const textColor = useThemeColor({}, 'text');
  const cardBackgroundColor = useThemeColor({}, 'cardBackground');
  const warningColor = '#fd7e14';
  const dangerColor = '#dc3545';
  const successColor = '#198754';

  // Don't show debug panel in production
  if (!__DEV__ || !debug) {
    return null;
  }

  const handleTimeTravel = async () => {
    try {
      const days = parseInt(timeTravel);
      await debug.timeTravel(days);
      refreshData();
      onRefresh?.();
      Alert.alert('Success', `Time traveled ${days} days forward!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to time travel');
    }
  };

  const handleResetAll = () => {
    Alert.alert(
      'WARNING',
      'This will delete ALL FSRS progress for ALL cards. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'DELETE ALL', 
          style: 'destructive',
          onPress: async () => {
            try {
              await debug.resetAllCards();
              refreshData();
              onRefresh?.();
              Alert.alert('Success', 'All FSRS data has been reset!');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset data');
            }
          }
        }
      ]
    );
  };

  const handleMakeAllDue = async () => {
    try {
      await debug.makeAllCardsDue();
      refreshData();
      onRefresh?.();
      Alert.alert('Success', 'All cards are now due for review!');
    } catch (error) {
      Alert.alert('Error', 'Failed to make cards due');
    }
  };

  const handleCreateTestCards = async () => {
    try {
      const count = parseInt(testCardCount);
      const cardIds = await debug.createTestCards(count, State.New);
      refreshData();
      onRefresh?.();
      Alert.alert('Success', `Created ${count} test cards!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create test cards');
    }
  };

  const handleSetDailyProgress = async () => {
    try {
      const progress = parseInt(dailyProgress);
      await debug.setDailyProgress(progress);
      refreshData();
      onRefresh?.();
      Alert.alert('Success', `Daily progress set to ${progress}!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to set daily progress');
    }
  };

  const handleExportData = async () => {
    try {
      const jsonData = await debug.exportData();
      Alert.alert('Success', 'Data exported to console. Check logs!');
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleGetAllData = async () => {
    try {
      const data = await debug.getAllData();
      Alert.alert('Success', 'All data logged to console!');
    } catch (error) {
      Alert.alert('Error', 'Failed to get data');
    }
  };

  return (
    <Card style={[styles.debugCard, { backgroundColor: cardBackgroundColor }]}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium" style={{ color: textColor }}>
            🔧 Debug Tools
          </Text>
          <Chip 
            icon="bug" 
            style={{ backgroundColor: warningColor + '20' }}
            textStyle={{ color: warningColor, fontSize: 12 }}
          >
            DEV ONLY
          </Chip>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Time Travel */}
          <View style={styles.section}>
            <Text variant="bodyMedium" style={[styles.sectionTitle, { color: textColor }]}>
              Time Travel
            </Text>
            <View style={styles.row}>
              <TextInput
                mode="outlined"
                label="Days"
                value={timeTravel}
                onChangeText={setTimeTravel}
                keyboardType="numeric"
                style={styles.input}
                dense
              />
              <Button mode="contained" onPress={handleTimeTravel} style={styles.button}>
                Travel Forward
              </Button>
            </View>
          </View>

          {/* Card Management */}
          <View style={styles.section}>
            <Text variant="bodyMedium" style={[styles.sectionTitle, { color: textColor }]}>
              Card Management
            </Text>
            <View style={styles.buttonGrid}>
              <Button 
                mode="contained" 
                onPress={handleMakeAllDue}
                style={[styles.gridButton, { backgroundColor: successColor }]}
                textColor="white"
              >
                Make All Due
              </Button>
              <Button 
                mode="contained" 
                onPress={handleResetAll}
                style={[styles.gridButton, { backgroundColor: dangerColor }]}
                textColor="white"
              >
                Reset All
              </Button>
            </View>
          </View>

          {/* Test Data */}
          <View style={styles.section}>
            <Text variant="bodyMedium" style={[styles.sectionTitle, { color: textColor }]}>
              Test Data
            </Text>
            <View style={styles.row}>
              <TextInput
                mode="outlined"
                label="Count"
                value={testCardCount}
                onChangeText={setTestCardCount}
                keyboardType="numeric"
                style={styles.input}
                dense
              />
              <Button mode="contained" onPress={handleCreateTestCards} style={styles.button}>
                Create Test Cards
              </Button>
            </View>
          </View>

          {/* Daily Progress */}
          <View style={styles.section}>
            <Text variant="bodyMedium" style={[styles.sectionTitle, { color: textColor }]}>
              Daily Progress
            </Text>
            <View style={styles.row}>
              <TextInput
                mode="outlined"
                label="Cards Studied"
                value={dailyProgress}
                onChangeText={setDailyProgress}
                keyboardType="numeric"
                style={styles.input}
                dense
              />
              <Button mode="contained" onPress={handleSetDailyProgress} style={styles.button}>
                Set Progress
              </Button>
            </View>
          </View>

          {/* Data Export/Debug */}
          <View style={styles.section}>
            <Text variant="bodyMedium" style={[styles.sectionTitle, { color: textColor }]}>
              Data & Debugging
            </Text>
            <View style={styles.buttonGrid}>
              <Button 
                mode="outlined" 
                onPress={handleGetAllData}
                style={styles.gridButton}
              >
                Log All Data
              </Button>
              <Button 
                mode="outlined" 
                onPress={handleExportData}
                style={styles.gridButton}
              >
                Export JSON
              </Button>
            </View>
          </View>
        </ScrollView>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  debugCard: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scrollView: {
    maxHeight: 400,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  input: {
    flex: 1,
    minWidth: 80,
  },
  button: {
    minWidth: 120,
  },
  gridButton: {
    flex: 1,
    minWidth: 100,
  },
});
