import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { FAB, IconButton, Text } from 'react-native-paper';

import DeckCard from '@/components/DeckCard';
import CreateDeckModal from '@/components/modals/CreateDeckModal';
import SettingsModal from '@/components/modals/SettingsModal';
import { useDecks } from '@/hooks/useDecks';
import { useThemeColor } from '@/hooks/useThemeColor';
import { router } from 'expo-router';

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const [modalVisible, setModalVisible] = useState(false);
  const [ttsModalVisible, setSettingsModalVisible] = useState(false);
  
  // Use the custom hook for deck management
  const { decks, loading, saveDeck, deleteDeck } = useDecks();

  // Set up header with settings button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="cog"
          iconColor={textColor}
          onPress={() => setSettingsModalVisible(true)}
        />
      ),
    });
  }, [navigation, textColor]);

  const handlePlusPress = () => {
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const handleCreateDeck = async (newDeck: Deck) => {
    const success = await saveDeck(newDeck);
    if (success) {
      setModalVisible(false);
    }
  };


  return (
    <>
      <ScrollView style={{ backgroundColor, flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
        <Text variant="headlineSmall" style={{ color: textColor, marginBottom: 20, marginTop: 8 }}>
          My Decks
        </Text>
        
        {loading ? (
          <Text variant="bodyLarge" style={{ color: textColor, textAlign: 'center', marginTop: 50 }}>
            Loading decks...
          </Text>
        ) : decks.length === 0 ? (
          <Text variant="bodyLarge" style={{ color: textColor, textAlign: 'center', marginTop: 50 }}>
            No decks yet. Create your first flashcard deck!
          </Text>
        ) : (
          decks.map((deck) => (
            <DeckCard 
              key={deck.id} 
              deck={deck}
              onPress={() => {
                router.push({ pathname: '/deck/[id]', params: { id: deck.id } })
              }}
              onDelete={deleteDeck}
            />
          ))
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.floatingButton, { backgroundColor: tintColor }]}
        onPress={handlePlusPress}
        label="Add Deck"
      />

      <CreateDeckModal
        visible={modalVisible}
        onDismiss={closeModal}
        onCreateDeck={handleCreateDeck}
      />

      <SettingsModal
        visible={ttsModalVisible}
        onDismiss={() => setSettingsModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  floatingButton: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: Platform.select({
      ios: 100, // Account for tab bar + safe area
      android: 80,
      default: 80,
    }),
  },
});
