import { AntDesign } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { useThemeColor } from '@/hooks/useThemeColor';

export default function EmptyCardState() {
  const textColor = useThemeColor({}, 'text');
  const cardBackgroundColor = useThemeColor({}, 'cardBackground');
  const iconColor = useThemeColor({}, 'icon');

  return (
    <Card style={[styles.emptyCard, { backgroundColor: cardBackgroundColor }]}>
      <Card.Content style={styles.emptyCardContent}>
        <AntDesign name="plus" size={48} color={iconColor} style={{ opacity: 0.3 }} />
        <Text variant="bodyLarge" style={{ color: textColor, marginTop: 16, textAlign: 'center' }}>
          No cards yet
        </Text>
        <Text variant="bodyMedium" style={{ color: textColor, opacity: 0.6, textAlign: 'center' }}>
          Add your first flashcard to get started
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    marginTop: 32,
  },
  emptyCardContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
});
