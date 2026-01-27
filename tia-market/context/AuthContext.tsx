import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthContextType, RegisterData } from '@/types';
import { authApi, testBackendConnection, api } from '@/utils/api';

export const AuthContext = createContext<AuthContextType>({
  userToken: null,
  userInfo: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<User | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      await testBackendConnection();
      await checkLoginStatus();
    } catch (error) {
      console.error('Erreur initialisation auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userString = await AsyncStorage.getItem('userInfo');
      
      if (token && userString) {
        const user = JSON.parse(userString);
        
        // Ajouter les champs calculés si manquants
        const userWithCalculatedFields = {
          ...user,
          isPremium: user.premiumPack && user.premiumPack !== 'simple',
          premiumPlan: user.premiumPack || user.premiumPlan,
        };
        
        setUserToken(token);
        setUserInfo(userWithCalculatedFields);
        
        // Vérifier si le token est toujours valide
        try {
          await authApi.getProfile();
          console.log('✅ Token valide, utilisateur connecté');
        } catch (error) {
          console.log('⚠️ Token expiré, déconnexion...');
          await logout();
        }
      }
    } catch (error) {
      console.error('❌ Erreur vérification connexion:', error);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    console.log(`🔐 Tentative connexion: ${email}`);
    setIsLoading(true);
    
    try {
      const response = await authApi.login({ email, password });
      
      console.log('✅ Connexion réussie via API');
      console.log('Premium pack reçu:', response.user.premiumPack);
      
      // Préparer l'objet user avec les champs calculés
      const userData = {
        ...response.user,
        // Calculer isPremium à partir de premiumPack
        isPremium: response.user.premiumPack && response.user.premiumPack !== 'simple',
        // Alias pour la compatibilité
        premiumPlan: response.user.premiumPack,
      };
      
      setUserToken(response.token);
      setUserInfo(userData);
  
      // Sauvegarder dans AsyncStorage
      await AsyncStorage.setItem('userToken', response.token);
      await AsyncStorage.setItem('userInfo', JSON.stringify(userData));
      
    } catch (error: any) {
      console.error('❌ Erreur API login:', error);
      
      let errorMessage = 'Erreur de connexion';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message?.includes('Network Error')) {
        errorMessage = 'Impossible de se connecter au serveur';
      }
      
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<void> => {
    console.log(`📝 Tentative inscription: ${userData.email}`);
    setIsLoading(true);
    
    try {
      const response = await authApi.register(userData);
      
      console.log('✅ Inscription réussie via API');
      console.log('   Nouvel user ID:', response.user.id);
      
      // Ajouter les champs calculés
      const userWithCalculatedFields = {
        ...response.user,
        isPremium: response.user.premiumPack && response.user.premiumPack !== 'simple',
        premiumPlan: response.user.premiumPack,
      };
      
      setUserToken(response.token);
      setUserInfo(userWithCalculatedFields);
  
      await AsyncStorage.setItem('userToken', response.token);
      await AsyncStorage.setItem('userInfo', JSON.stringify(userWithCalculatedFields));
      
      console.log('💾 Compte créé et session sauvegardée');
      
    } catch (error: any) {
      console.error('❌ Erreur API register:', error);
      
      let errorMessage = 'Erreur d\'inscription';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message?.includes('Network Error')) {
        errorMessage = 'Impossible de se connecter au serveur';
      }
      
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    console.log('🚪 Déconnexion...');
    setIsLoading(true);
    
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userInfo');
      
      setUserToken(null);
      setUserInfo(null);
      
      console.log('✅ Déconnexion réussie');
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const changePremiumPack = async (pack: 'simple' | 'starter' | 'pro' | 'entreprise') => {
    try {
      const response = await api.patch('/user/premium-pack', { premiumPack: pack });
      
      if (response.data.success) {
        // Mettre à jour les informations utilisateur
        setUserInfo(prev => ({
          ...prev,
          premiumPack: pack
        }));
        
        // Sauvegarder dans AsyncStorage si nécessaire
        const updatedUser = { ...userInfo, premiumPack: pack };
        await AsyncStorage.setItem('userInfo', JSON.stringify(updatedUser));
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erreur changement pack premium:', error);
      throw error;
    }
  };

  const updateUserPremium = async () => {
    try {
      const response = await authApi.getProfile();
      
      if (response.user) {
        // Ajouter les champs calculés
        const updatedUser = {
          ...response.user,
          isPremium: response.user.premiumPack && response.user.premiumPack !== 'simple',
          premiumPlan: response.user.premiumPack,
        };
        
        setUserInfo(updatedUser);
        await AsyncStorage.setItem('userInfo', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Erreur mise à jour profil premium:', error);
    }
  };

  const value = {
    changePremiumPack,
    updateUserPremium,
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        userToken,
        userInfo,
        login,
        register,
        logout,
        updateUserPremium,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};