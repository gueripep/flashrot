import { useAuthContext } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text, TextInput } from 'react-native-paper';

interface LoginScreenProps {
  onSwitchToRegister: () => void;
}

export default function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, isLoading } = useAuthContext();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const success = await login(email, password);
    if (!success) {
      Alert.alert('Login Failed', 'Invalid email or password');
    }
  };

  const fillDemoCredentials = () => {
    setEmail('demo@example.com');
    setPassword('password');
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: textColor }]}>
            Welcome to Brainflash
          </Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            Sign in to continue
          </Text>

          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={styles.input}
                disabled={isLoading}
              />

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                style={styles.input}
                disabled={isLoading}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />

              <Button
                mode="contained"
                onPress={handleLogin}
                style={styles.loginButton}
                disabled={isLoading}
              >
                {isLoading ? <ActivityIndicator color="white" /> : 'Sign In'}
              </Button>

              <Button
                mode="text"
                onPress={fillDemoCredentials}
                style={styles.demoButton}
                disabled={isLoading}
              >
                Use Demo Credentials
              </Button>
            </Card.Content>
          </Card>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: textColor }]}>
              Don't have an account?
            </Text>
            <Button 
              mode="text" 
              onPress={onSwitchToRegister}
              disabled={isLoading}
            >
              Sign Up
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.7,
  },
  card: {
    marginBottom: 30,
  },
  cardContent: {
    padding: 20,
  },
  input: {
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 4,
  },
  demoButton: {
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
  },
});
