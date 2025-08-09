import { useThemeColor } from '@/hooks/useThemeColor';
import { AudioSource, useAudioPlayer } from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
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
  const isMountedRef = useRef(true);
  
  const player = useAudioPlayer(audioUri ? { uri: audioUri } as AudioSource : null);

  // Cleanup effect to mark component as unmounted
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (autoPlay && audioUri && !disabled && player) {
      playAudio();
    }
  }, [audioUri, autoPlay, disabled, player]);

  // Track audio position and playing state
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      // Check if component is still mounted and player is valid
      if (!isMountedRef.current) {
        clearInterval(interval);
        return;
      }

      try {
        // More defensive checks before accessing player properties
        if (player && typeof player === 'object' && 'playing' in player && 'currentTime' in player) {
          const isPlaying = player.playing;
          if (isPlaying) {
            const currentTime = player.currentTime || 0;
            onPositionChange?.(currentTime);
          }
        }
      } catch (error) {
        console.error('Error getting current time:', error);
        clearInterval(interval);
      }
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [player, onPositionChange]);

  useEffect(() => {
    try {
      if (player && typeof player === 'object' && 'playing' in player) {
        onPlayStateChange?.(player.playing || false);
      } else {
        onPlayStateChange?.(false);
      }
    } catch (error) {
      console.error('Error getting playing state:', error);
      onPlayStateChange?.(false);
    }
  }, [player?.playing, onPlayStateChange]);

  const playAudio = async () => {
    if (!player || disabled || !isMountedRef.current) return;

    try {
      setIsLoading(true);
      // Reset position when starting to play
      onPositionChange?.(0);
      
      // Check if player is still valid before calling play
      if (player && typeof player === 'object' && 'play' in player) {
        await player.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      onPlayStateChange?.(false);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const pauseAudio = () => {
    if (!isMountedRef.current) return;
    
    try {
      if (player && typeof player === 'object' && 'pause' in player) {
        player.pause();
      }
    } catch (error) {
      console.error('Error pausing audio:', error);
      onPlayStateChange?.(false);
    }
  };

  const handlePress = () => {
    if (!isMountedRef.current) return;
    
    try {
      // Safely check if player is playing
      let isCurrentlyPlaying = false;
      if (player && typeof player === 'object' && 'playing' in player) {
        isCurrentlyPlaying = player.playing;
      }
      
      if (isCurrentlyPlaying) {
        pauseAudio();
      } else {
        playAudio();
      }
    } catch (error) {
      console.error('Error in handlePress:', error);
      onPlayStateChange?.(false);
    }
  };

  if (!audioUri) {
    return null;
  }

  // Safely determine the player state
  let isPlaying = false;
  try {
    if (player && typeof player === 'object' && 'playing' in player) {
      isPlaying = player.playing || false;
    }
  } catch (error) {
    console.error('Error checking playing state:', error);
    isPlaying = false;
  }

  return (
    <View style={styles.container}>
      <IconButton
        icon={isLoading ? "loading" : isPlaying ? "pause" : "play"}
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
