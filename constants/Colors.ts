/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#b17affff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    cardBackground: '#f8f9fa',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    error: '#ef4444',
    success: '#22c55e',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    cardBackground: '#1f2224',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    error: '#ef4444',
    success: '#22c55e',
  },
};
