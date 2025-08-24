import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  likeButtonContainer: {
    position: 'absolute',
    bottom: 300,
    right: 5,
    zIndex: 1,
  },
  fullScreenContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden', // Clip the double-height container
  },
  doubleHeightContainer: {
    height: '200%', // Double the screen height
    position: 'relative',
  },
  cardSection: {
    height: '50%', // Each section takes half the double-height container (i.e., full screen)
    position: 'relative',
  },
  safeAreaContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  backgroundVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainerFixed: {
    position: 'absolute',
    top: 32,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: 'transparent',
    height: 10,
    display: 'flex',
  },
  progressBar: {
    borderRadius: 4,
    flex: 1,
    height: 8
  },
  fsrsContainer: {
    marginBottom: 16,
  },
  hintContainer: {
    marginBottom: 32,
  },
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completionButtons: {
    marginTop: 32,
    gap: 12,
    width: '100%',
  },
  button: {
    marginVertical: 4,
  },
  audioContainer: {
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  flipContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  flipButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  nextCardPreview: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  nextCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  nextCardText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    opacity: 0.7,
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  timerText: {
    fontSize: 64,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
});
