import { useAuthContext } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';

export default function AuthScreen() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const { isLoading, isAuthenticated } = useAuthContext();
  const backgroundColor = useThemeColor({}, 'background');
  console.log("Auth screen rerendered!");

  useEffect(() => {
    console.log("Auth screen mounted or updated");
  }, [isAuthenticated]);

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {isLoginMode ? (
        <LoginScreen onSwitchToRegister={() => setIsLoginMode(false)} />
      ) : (
        <RegisterScreen onSwitchToLogin={() => setIsLoginMode(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
