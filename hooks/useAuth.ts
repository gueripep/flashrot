import { useEffect, useState } from 'react';
import {
    getCurrentUser,
    login as serviceLogin,
    logout as serviceLogout,
    register as serviceRegister,
} from '../services/authService';

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

// ...use service helpers from services/authService

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
        setIsLoading(true);
        const user = await getCurrentUser();
        if (user) {
            console.log('Restoring user session:', user);
            setUser(user);
        }
        else {
            console.log('No stored authentication found');
            setUser(null);
        }
        setIsLoading(false);
    };

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            const ok = await serviceLogin(email, password);
            if (ok) {
                const storedUser = await getCurrentUser();
                setUser(storedUser);
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
            const ok = await serviceRegister(email, password, name);
            if (ok) {
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
            await serviceLogout();
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
