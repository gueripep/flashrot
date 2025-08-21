import { VideoView, useVideoPlayer } from 'expo-video';
import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Platform, SafeAreaView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { styles } from './StudyStyles';

interface BackgroundVideoProps {
    videoSource: any;
    animatedStyle?: any;
    zIndex?: number;
    paused?: boolean;
    onVideoLoaded?: () => void;
}

// Background Video Component
const BackgroundVideo = forwardRef(function BackgroundVideo({
  videoSource,
  animatedStyle,
  zIndex = -1,
  paused = false,
  onVideoLoaded
}: BackgroundVideoProps, ref) {
  useImperativeHandle(ref, () => ({
    playVideo
  }));
  const player = useVideoPlayer(videoSource, player => {
    player.loop = true;
    player.muted = true;
    if (paused) {
      player.pause();
    } else {
      player.play();
    }

    // Notify when the video is ready
    player.addListener('sourceChange', () => {
      if (onVideoLoaded) {
        // small delay to ensure player is ready
        setTimeout(() => {
          onVideoLoaded();
        }, 200);
      }
    });
  });

  // fixes autoplay not working on web
  useEffect(() => {
    if (Platform.OS === 'web' && player && !paused) {
      playVideo();
    }
  }, [player]);

  function playVideo(){
    player.play();
  }

  return (
    <Animated.View style={[styles.backgroundVideoContainer, { zIndex }, animatedStyle]}>
      <VideoView
        style={styles.backgroundVideo}
        player={player}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        nativeControls={false}
        contentFit="cover"
      />
    </Animated.View>
  );
});

// Full Screen Container with Background Video
export const FullScreenContainer = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.fullScreenContainer}>
    <BackgroundVideo videoSource={require('@/assets/videos/parkour.mp4')} />
    <SafeAreaView style={styles.safeAreaContainer}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  </View>
);


export default BackgroundVideo;