import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { messagingApi } from '@/utils/api';
import { AuthContext } from '@/context/AuthContext';

export default function NewMessageScreen() {
  const params = useLocalSearchParams<{
    adId: string;
    receiverId: string;
    adTitle: string;
    receiverName: string;
  }>();
  
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { userToken } = useContext(AuthContext);

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert('Erreur', 'Veuillez écrire un message');
      return;
    }

    if (!params.adId || !params.receiverId) {
      Alert.alert('Erreur', 'Informations manquantes');
      return;
    }

    setSending(true);
    try {
      const response = await messagingApi.sendMessage({
        adId: params.adId,
        receiverId: params.receiverId,
        content: message.trim(),
        // Pas de conversationId pour le premier message
      });

      if (response.success) {
        Alert.alert(
          'Succès',
          'Message envoyé !',
          [
            {
              text: 'OK',
              onPress: () => {
                // Rediriger vers la conversation
                if (response.message?.conversationId) {
                  router.push(`/messages/${response.message.conversationId}`);
                } else {
                  router.back();
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Erreur', response.error || 'Impossible d\'envoyer le message');
      }
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau message</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Informations sur l'annonce */}
        <View style={styles.adInfo}>
          <Text style={styles.infoLabel}>À propos de l'annonce :</Text>
          <Text style={styles.adTitle} numberOfLines={2}>
            {params.adTitle || 'Annonce'}
          </Text>
        </View>

        {/* Informations sur le destinataire */}
        <View style={styles.receiverInfo}>
          <Text style={styles.infoLabel}>Destinataire :</Text>
          <Text style={styles.receiverName}>
            {params.receiverName || 'Utilisateur'}
          </Text>
        </View>

        {/* Zone de saisie */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Votre message :</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Bonjour, je suis intéressé par votre annonce..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>
            {message.length}/1000 caractères
          </Text>
        </View>

        {/* Conseils */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Conseils :</Text>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#34C759" />
            <Text style={styles.tipText}>Soyez clair et poli</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#34C759" />
            <Text style={styles.tipText}>Posez des questions précises</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#34C759" />
            <Text style={styles.tipText}>Proposez un prix si négociable</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bouton d'envoi */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!message.trim() || sending) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!message.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFF" />
              <Text style={styles.sendButtonText}>Envoyer le message</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  adInfo: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  receiverInfo: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  adTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  receiverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B5E20',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  tipsContainer: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 8,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  sendButton: {
    backgroundColor: '#1B5E20',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#1B5E20AA',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});