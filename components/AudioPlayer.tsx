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
  onPositionChange?: (position: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export default function AudioPlayer({ 
  audioUri, 
  autoPlay = false, 
  size = 24,
  disabled = false,
  onPositionChange,
  onPlayStateChange
}: AudioPlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const tintColor = useThemeColor({}, 'tint');
  
  const player = useAudioPlayer(audioUri ? { uri: audioUri } as AudioSource : null);

  useEffect(() => {
    if (autoPlay && audioUri && !disabled && player) {
      playAudio();
    }
  }, [audioUri, autoPlay, disabled, player]);

  // Track audio position and playing state
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (player.playing) {
        const currentTime = player.currentTime || 0;
        console.log('🎵 Audio position update:', currentTime.toFixed(2) + 's');
        onPositionChange?.(currentTime);
      }
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [player, onPositionChange]);

  useEffect(() => {
    onPlayStateChange?.(player?.playing || false);
  }, [player?.playing, onPlayStateChange]);

  const playAudio = async () => {
    if (!player || disabled) return;

    try {
      setIsLoading(true);
      // Reset position when starting to play
      onPositionChange?.(0);
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
