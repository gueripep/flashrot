import { useThemeColor } from '@/hooks/useThemeColor';
import { AudioSource, useAudioPlayer } from 'expo-audio';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';

interface AudioPlayerProps {
  audioUri: string | number | null | undefined;
  autoPlay?: boolean;
  size?: number;
  disabled?: boolean;
  onPositionChange?: (position: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onAudioFinished?: () => void;
}

const AudioPlayer = forwardRef(function AudioPlayer(
  { audioUri, autoPlay = false, size = 24, disabled = false, onPositionChange, onPlayStateChange, onAudioFinished }: AudioPlayerProps,
  ref
) {
  useImperativeHandle(ref, () => ({
    playAudio,
    pauseAudio,
    stopAudio
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [hasTimerStarted, setHasTimerStarted] = useState(false);
  const tintColor = useThemeColor({}, 'tint');
  const isMountedRef = useRef(true);
  console.log("uri", audioUri)
  // Accept both string (URL/path) and number (require asset ID)
  const player = useAudioPlayer(
    audioUri
      ? typeof audioUri === 'string'
        ? { uri: audioUri } as AudioSource
        : audioUri // number (require asset ID)
      : null
  );

  // Cleanup effect to mark component as unmounted
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (autoPlay && audioUri && !disabled && player) {
      // Add a small delay to ensure the player is ready
      setTimeout(() => {
        playAudio();
      }, 100);
    }
    // Reset duration tracking when audio changes
    setHasTimerStarted(false);
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
        if (player &&
          typeof player === 'object' &&
          'playing' in player &&
          'currentTime' in player &&
          'duration' in player) {

          // Test if player is still accessible before reading properties
          try {
            const isPlaying = player.playing;
            const currentTime = player.currentTime || 0;
            const duration = player.duration || 0;

            if (isPlaying) {
              onPositionChange?.(currentTime);
            }
            // Check if audio has finished playing
            if (duration > 0 && currentTime >= duration - 0.1 && !hasTimerStarted) {
              // Audio has finished
              setHasTimerStarted(true);
              onAudioFinished?.();
            }
          } catch (innerError) {
            // Player might be released, clear interval and exit
            console.warn('🎵 AudioPlayer: Player released during position tracking');
            clearInterval(interval);
            return;
          }
        }
      } catch (error) {
        console.error('Error getting current time:', error);
        clearInterval(interval);
      }
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [player, onAudioFinished]);

  useEffect(() => {
    try {
      console.log("test");
      if (player && typeof player === 'object' && 'playing' in player) {
        // Test if player is still accessible before reading playing state
        try {
          const playingState = player.playing || false;
          onPlayStateChange?.(playingState);
        } catch (innerError) {
          console.warn('🎵 AudioPlayer: Player released during state check');
          onPlayStateChange?.(false);
        }
      } else {
        onPlayStateChange?.(false);
      }
    } catch (error) {
      console.error('Error getting playing state:', error);
      onPlayStateChange?.(false);
    }
  }, [player?.playing, onPlayStateChange]);

  const playAudio = async () => {
    const isInvalid = !player || disabled || !isMountedRef.current
    console.log('🎵 AudioPlayer: playAudio called', { isInvalid });
    if (isInvalid) return;

    try {
      setIsLoading(true);
      // Reset position when starting to play
      onPositionChange?.(0);

      // Additional validation to check if player is still valid
      if (player &&
        typeof player === 'object' &&
        'play' in player &&
        typeof player.play === 'function') {

        // Check if the player is not already released by testing a property access
        try {
          // Test if we can access player properties without throwing
          const testAccess = player.currentTime;
          await player.play();
        } catch (innerError) {
          console.warn('🎵 AudioPlayer: Player appears to be released, skipping play');
          onPlayStateChange?.(false);
          return;
        }
      }
    } catch (error) {
      console.error('🎵 AudioPlayer: Error playing audio:', error);
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
      if (player &&
        typeof player === 'object' &&
        'pause' in player &&
        typeof player.pause === 'function') {

        // Test if player is still valid before pausing
        try {
          const testAccess = player.currentTime;
          player.pause();
        } catch (innerError) {
          console.warn('🎵 AudioPlayer: Player appears to be released, skipping pause');
          onPlayStateChange?.(false);
        }
      }
    } catch (error) {
      console.error('Error pausing audio:', error);
      onPlayStateChange?.(false);
    }
  };

  const stopAudio = () => {
    try {
      const testAccess = player.currentTime;
      player.pause();
      player.seekTo(0);
    } catch (innerError) {
      console.warn('🎵 AudioPlayer: Player appears to be released, skipping stop');
      onPlayStateChange?.(false);
    }
  }


  const handlePress = () => {
    if (!isMountedRef.current) return;

    try {
      // Safely check if player is playing
      let isCurrentlyPlaying = false;
      if (player && typeof player === 'object' && 'playing' in player) {
        try {
          // Test player accessibility before reading state
          const testAccess = player.currentTime;
          isCurrentlyPlaying = player.playing;
        } catch (innerError) {
          console.warn('🎵 AudioPlayer: Player released during press handler');
          onPlayStateChange?.(false);
          return;
        }
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
      try {
        // Test player accessibility before reading state
        const testAccess = player.currentTime;
        isPlaying = player.playing || false;
      } catch (innerError) {
        console.warn('🎵 AudioPlayer: Player released during render state check');
        isPlaying = false;
      }
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
});
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    margin: 0,
  },
});

export default AudioPlayer;