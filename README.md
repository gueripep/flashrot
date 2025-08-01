# BrainFlash - Flashcard Study App 🧠✨

BrainFlash is a modern flashcard study application built with Expo and React Native. It features beautiful UI, organized deck management, and cutting-edge text-to-speech capabilities powered by Google's Gemini AI.

## Features

- 📚 **Deck Management**: Create and organize flashcard decks
- 📝 **Card Creation**: Add questions and answers with rich text support
- 🎯 **Study Mode**: Interactive study sessions with progress tracking
- 🔊 **AI Text-to-Speech**: Generate natural-sounding audio for cards using Gemini TTS
- 🎵 **Audio Playback**: Auto-play or manual audio playback during study
- 🌙 **Theme Support**: Dark and light theme compatibility
- 📱 **Cross-Platform**: Works on iOS, Android, and Web

## Getting Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

3. Open the app in your preferred environment:
   - [Development build](https://docs.expo.dev/develop/development-builds/introduction/)
   - [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
   - [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
   - [Expo Go](https://expo.dev/go)

## Text-to-Speech Setup

To enable TTS features:

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Open the app and tap the settings icon (⚙️) in the top-right corner
3. Enter your API key in the TTS settings
4. Enable TTS and configure auto-play preferences

### TTS Features

- **Question Audio**: Hear the question read aloud when studying
- **Answer Audio**: Audio playback for answers
- **Auto-play**: Automatically play audio when cards are displayed
- **Manual Playback**: Tap the play button to hear audio on demand
- **Background Generation**: Audio is generated when cards are created

## Project Structure

```
app/
├── (tabs)/           # Main tab navigation
├── deck/            # Deck management screens
└── study/           # Study session screens

components/
├── StudyCard.tsx    # Interactive study card component
├── AudioPlayer.tsx  # TTS audio playback component
├── TTSSettingsModal.tsx # TTS configuration
└── ...              # Other UI components

services/
└── ttsService.ts    # Gemini TTS integration

hooks/
├── useCards.ts      # Card management logic
├── useTTS.ts        # TTS settings and state
└── ...              # Other custom hooks
```

## Technologies

- **Expo**: Cross-platform development framework
- **React Native**: Mobile app framework
- **React Native Paper**: Material Design components
- **Google Gemini AI**: Text-to-speech generation
- **Expo Audio**: Audio playback functionality
- **AsyncStorage**: Local data persistence
- **Expo Router**: File-based navigation

## Get a fresh project


