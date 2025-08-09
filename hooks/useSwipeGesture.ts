import { useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeLeftThreshold?: number;
  swipeRightThreshold?: number;
  maxSwipeLeftDistance?: number;
  maxSwipeRightDistance?: number;
  gestureThreshold?: number;
  enableVerticalGestureCheck?: boolean;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  swipeLeftThreshold = -100,
  swipeRightThreshold = 100,
  maxSwipeLeftDistance = -180,
  maxSwipeRightDistance = 180,
  gestureThreshold = 10,
  enableVerticalGestureCheck = true,
}: SwipeGestureOptions = {}) {
  const [isGestureActive, setIsGestureActive] = useState(false);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);

  // Safe wrapper for runOnJS calls
  const setGestureActive = (active: boolean) => {
    'worklet';
    runOnJS(setIsGestureActive)(active);
  };

  const triggerSwipeLeft = () => {
    'worklet';
    if (onSwipeLeft) {
      runOnJS(onSwipeLeft)();
    }
  };

  const triggerSwipeRight = () => {
    'worklet';
    if (onSwipeRight) {
      runOnJS(onSwipeRight)();
    }
  };

  const panGesture = (() => {
    let gesture = Gesture.Pan()
      .onBegin(() => {
        setGestureActive(false);
      })
      .onChange((event) => {
        // Check if vertical movement is greater than horizontal (if enabled)
        if (enableVerticalGestureCheck && Math.abs(event.translationY) > Math.abs(event.translationX)) {
          return;
        }

        // Clamp translation based on direction and enabled actions
        let clampedTranslation = event.translationX;
        
        if (event.translationX < 0 && onSwipeLeft) {
          // Swiping left (negative direction)
          clampedTranslation = Math.max(event.translationX, maxSwipeLeftDistance);
        } else if (event.translationX > 0 && onSwipeRight) {
          // Swiping right (positive direction)
          clampedTranslation = Math.min(event.translationX, maxSwipeRightDistance);
        } else {
          // No action enabled for this direction, don't allow movement
          clampedTranslation = 0;
        }

        translateX.value = clampedTranslation;

        if (Math.abs(event.translationX) > gestureThreshold) {
          setGestureActive(true);
        }
      })
      .onEnd((event) => {
        // Check if vertical movement is greater than horizontal (if enabled)
        if (enableVerticalGestureCheck && Math.abs(event.translationY) > Math.abs(event.translationX)) {
          translateX.value = withSpring(0, {
            damping: 20,
            stiffness: 300,
            mass: 0.5,
          });
          setGestureActive(false);
          return;
        }

        const wasGestureActive = Math.abs(event.translationX) > gestureThreshold;

        // Check thresholds and trigger actions
        if (event.translationX < swipeLeftThreshold && onSwipeLeft) {
          triggerSwipeLeft();
        } else if (event.translationX > swipeRightThreshold && onSwipeRight) {
          triggerSwipeRight();
        }

        // Reset animations
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
          mass: 0.5,
        });
        scale.value = withSpring(1, {
          damping: 20,
          stiffness: 300,
          mass: 0.5,
        });

        if (!wasGestureActive) {
          setGestureActive(false);
        }
      })
      .activeOffsetX([-10, 10]); // Only activate after 10px horizontal movement
    
    if (enableVerticalGestureCheck) {
      gesture = gesture.failOffsetY([-20, 20]); // Fail if vertical movement exceeds 20px
    }
    
    return gesture;
  })();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value }
    ],
  }));

  const leftActionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value / 2 }],
    opacity: translateX.value < 0 ? 1 : 0,
  }));

  const rightActionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value / 2 }],
    opacity: translateX.value > 0 ? 1 : 0,
  }));

  const leftBackgroundStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? 1 : 0,
  }));

  const rightBackgroundStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 0 ? 1 : 0,
  }));

  const resetGestureState = () => {
    setIsGestureActive(false);
  };

  return {
    panGesture,
    isGestureActive,
    animatedStyle,
    leftActionStyle,
    rightActionStyle,
    leftBackgroundStyle,
    rightBackgroundStyle,
    resetGestureState,
  };
}
