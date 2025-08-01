import { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Card, IconButton, Menu, Text } from 'react-native-paper';

import { FlashCard } from '@/hooks/useCards';
import { useThemeColor } from '@/hooks/useThemeColor';

interface FlashCardItemProps {
  card: FlashCard;
  isFlipped: boolean;
  onFlip: (cardId: string) => void;
  onEdit: (card: FlashCard) => void;
  onDelete: (card: FlashCard) => void;
}

export default function FlashCardItem({
  card,
  isFlipped,
  onFlip,
  onEdit,
  onDelete,
}: FlashCardItemProps) {
  const textColor = useThemeColor({}, 'text');
  const cardBackgroundColor = useThemeColor({}, 'cardBackground');
  const iconColor = useThemeColor({}, 'icon');
  
  const [menuVisible, setMenuVisible] = useState(false);

  const handleEdit = () => {
    setMenuVisible(false);
    onEdit(card);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    onDelete(card);
  };

  return (
    <Card style={[styles.flashCard, { backgroundColor: cardBackgroundColor }]}>
      <Card.Content style={styles.cardContent}>
        <TouchableOpacity
          style={styles.cardTouchable}
          onPress={() => onFlip(card.id)}
          activeOpacity={0.7}
        >
          <Text variant="bodySmall" style={{ color: textColor, opacity: 0.6, marginBottom: 8 }}>
            {isFlipped ? 'Back' : 'Front'}
          </Text>
          <Text variant="bodyLarge" style={{ color: textColor, textAlign: 'center', lineHeight: 24 }}>
            {isFlipped ? card.back : card.front}
          </Text>
          <Text variant="bodySmall" style={{ color: textColor, opacity: 0.4, marginTop: 12 }}>
            Tap to flip
          </Text>
        </TouchableOpacity>
        
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              iconColor={iconColor}
              size={20}
              onPress={() => setMenuVisible(true)}
              style={styles.menuButton}
            />
          }
        >
          <Menu.Item
            onPress={handleEdit}
            title="Edit"
            leadingIcon="pencil"
          />
          <Menu.Item
            onPress={handleDelete}
            title="Delete"
            leadingIcon="delete"
          />
        </Menu>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  flashCard: {
    minHeight: 120,
    marginBottom: 12,
  },
  cardContent: {
    justifyContent: 'space-between',
    alignItems: 'stretch',
    minHeight: 100,
    position: 'relative',
  },
  cardTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
  menuButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    margin: 0,
  },
});
