import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '../constants/config';

interface User {
    id: string;
    email: string;
    name: string;
}

interface AuthState {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthActions {
    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string) => Promise<boolean>;
    logout: () => Promise<void>;
}

const USER_DATA_KEY = 'user_data';


const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'API error');
        }
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error' };
    }
};

export function useAuth(): AuthState & AuthActions {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isAuthenticated = !!user;

    // Debug: log every state change
    useEffect(() => {
        console.log('[useAuth] user:', user, 'isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);
    }, [user, isAuthenticated, isLoading]);

    useEffect(() => {
        checkAuthState();
    }, []);

    const checkAuthState = async () => {
        try {
            setIsLoading(true);
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            const userData = await AsyncStorage.getItem(USER_DATA_KEY);

            if (token && userData) {
                const parsedUser = JSON.parse(userData);
                console.log('Restoring user session:', parsedUser);
                setUser(parsedUser);
            } else {
                console.log('No stored authentication found');
                setUser(null);
            }
        } catch (error) {
            console.error('Error checking auth state:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            const body = new URLSearchParams();
            body.append("grant_type", "password");
            body.append("username", email);
            body.append("password", password);

            const response = await apiCall('/auth/jwt/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            });
            console.log('Login response:', response);
            if (response.success && response.data.access_token) {
                console.log('Login successful:', response.data);
                await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.data.access_token);
                // Create a minimal user object since server doesn't return user data
                const userData = { id: 'user', email, name: email.split('@')[0] };
                await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
                
                // Set user state immediately to trigger UI update
                setUser(userData);
                setIsLoading(false);
                return true;
            }
            setIsLoading(false);
            return false;
        } catch (error) {
            console.error('Login error:', error);
            setIsLoading(false);
            return false;
        }
    };


    const register = async (email: string, password: string, name: string): Promise<boolean> => {
        try {
            console.log("initiating registration");
            setIsLoading(true);
            const response = await apiCall('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, name }),
            });

            if (response.success) {
                // Auto-login after successful registration
                const loginSuccess = await login(email, password);
                return loginSuccess;
            }
            setIsLoading(false);
            return false;
        } catch (error) {
            console.error('Registration error:', error);
            setIsLoading(false);
            return false;
        }
    };

    const logout = async (): Promise<void> => {
        try {
            // If your backend supports logout endpoint, call it here
            await apiCall('/auth/jwt/logout', { method: 'POST' });
            await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
            await AsyncStorage.removeItem(USER_DATA_KEY);
            setUser(null);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return {
        user,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
    };
}
