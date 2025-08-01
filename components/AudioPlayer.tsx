import { useThemeColor } from '@/hooks/useThemeColor';
import { AudioSource, useAudioPlayer } from 'expo-audio';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';

interface AudioPlayerProps {
  audioUri: string | null | undefined;
  autoPlay?: boolean;
  size?: number;
  disabled?: boolean;
}

export default function AudioPlayer({ 
  audioUri, 
  autoPlay = false, 
  size = 24,
  disabled = false 
}: AudioPlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const tintColor = useThemeColor({}, 'tint');
  
  const player = useAudioPlayer(audioUri ? { uri: audioUri } as AudioSource : null);

  useEffect(() => {
    if (autoPlay && audioUri && !disabled && player) {
      playAudio();
    }
  }, [audioUri, autoPlay, disabled, player]);

  const playAudio = async () => {
    if (!player || disabled) return;

    try {
      setIsLoading(true);
      player.play();
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pauseAudio = () => {
    if (player) {
      player.pause();
    }
  };

  const handlePress = () => {
    if (player?.playing) {
      pauseAudio();
    } else {
      playAudio();
    }
  };

  if (!audioUri) {
    return null;
  }

  return (
    <View style={styles.container}>
      <IconButton
        icon={isLoading ? "loading" : player?.playing ? "pause" : "play"}
        size={size}
        iconColor={tintColor}
        disabled={disabled || isLoading}
        onPress={handlePress}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    margin: 0,
  },
});
