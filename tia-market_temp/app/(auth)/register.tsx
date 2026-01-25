import { AuthContext } from '@/context/AuthContext';
import { RegisterData } from '@/types';
import { Ionicons } from '@expo/vector-icons'; // Changé à Ionicons
import { Link, router } from 'expo-router';
import React, { useContext, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function RegisterScreen() {
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useContext(AuthContext);

  const handleRegister = async () => {
    // Validation améliorée
    if (!formData.email || !formData.password || !confirmPassword) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs obligatoires (*)');
      return;
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Email invalide', 'Veuillez saisir une adresse email valide');
      return;
    }

    // Validation mot de passe (au moins 6 caractères)
    if (formData.password.length < 6) {
      Alert.alert('Mot de passe trop court', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (formData.password !== confirmPassword) {
      Alert.alert('Mot de passe', 'Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🔄 Début inscription...');
      await register(formData);
      
      Alert.alert(
        '🎉 Inscription réussie !',
        'Votre compte a été créé avec succès.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('➡️ Redirection vers l\'accueil...');
              router.replace('/(tabs)');
            }
          }
        ]
      );
      
    } catch (error: any) {
      console.error('❌ Erreur inscription:', error);
      
      // Messages d'erreur personnalisés
      let errorMessage = error.message || 'Une erreur est survenue lors de l\'inscription';
      
      if (errorMessage.includes('Email déjà utilisé')) {
        errorMessage = 'Cet email est déjà utilisé. Essayez de vous connecter ou utilisez un autre email.';
      } else if (errorMessage.includes('Network Error') || errorMessage.includes('Pas de réponse')) {
        errorMessage = 'Impossible de se connecter au serveur.\n\nVérifiez que:\n• Le backend est démarré\n• Votre téléphone est sur le même WiFi que l\'ordinateur\n• L\'adresse IP est correcte (192.168.88.29)';
      }
      
      Alert.alert('Erreur d\'inscription', errorMessage);
      
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (field: keyof RegisterData, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.backButton} disabled={isLoading}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
        </Link>

        <View style={styles.header}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez TIA Market</Text>
          <Text style={styles.serverInfo}>
            Serveur: 192.168.88.29:3001
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfInput]}>
              <TextInput
                style={styles.input}
                placeholder="Prénom"
                value={formData.firstName}
                onChangeText={(text) => updateFormData('firstName', text)}
                editable={!isLoading}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.inputContainer, styles.halfInput]}>
              <TextInput
                style={styles.input}
                placeholder="Nom"
                value={formData.lastName}
                onChangeText={(text) => updateFormData('lastName', text)}
                editable={!isLoading}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email *"
              value={formData.email}
              onChangeText={(text) => updateFormData('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              importantForAutofill="yes"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Téléphone"
              value={formData.phone}
              onChangeText={(text) => updateFormData('phone', text)}
              keyboardType="phone-pad"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe *"
              value={formData.password}
              onChangeText={(text) => updateFormData('password', text)}
              secureTextEntry={!showPassword}
              editable={!isLoading}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              disabled={isLoading}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirmer le mot de passe *"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity 
            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]} 
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Ionicons name="reload-outline" size={20} color="#FFF" />
                <Text style={styles.registerButtonText}>Création du compte...</Text>
              </View>
            ) : (
              <Text style={styles.registerButtonText}>Créer mon compte</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Déjà un compte ? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity disabled={isLoading}>
                <Text style={styles.loginLink}>Se connecter</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#1B5E20" />
            <Text style={styles.infoText}>
              Votre compte sera enregistré dans la base de données PostgreSQL
            </Text>
          </View>

          <Text style={styles.terms}>
            En créant un compte, vous acceptez nos{' '}
            <Text style={styles.termsLink}>Conditions Générales</Text> et notre{' '}
            <Text style={styles.termsLink}>Politique de Confidentialité</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  backButton: {
    marginTop: 50,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  serverInfo: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  form: {
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  halfInput: {
    width: '48%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 5,
  },
  registerButton: {
    backgroundColor: '#1B5E20',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    flexDirection: 'row',
  },
  registerButtonDisabled: {
    backgroundColor: '#1B5E20AA',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    color: '#1B5E20',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFECB3',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#5D4037',
    marginLeft: 8,
  },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  termsLink: {
    color: '#1B5E20',
    textDecorationLine: 'underline',
  },
});