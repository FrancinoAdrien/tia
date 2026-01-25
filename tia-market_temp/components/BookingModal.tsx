import React, { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { bookingsApi } from '@/utils/api';

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  onBookingComplete: () => void;
  ad: {
    id: string;
    title: string;
    price: number;
    imageUrl?: string;
  };
}

type Step = 'confirm' | 'payment' | 'success';

export default function BookingModal({ visible, onClose, onBookingComplete, ad }: BookingModalProps) {
  const [step, setStep] = useState<Step>('confirm');
  const [message, setMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState('');

  const handleReserve = async () => {
    if (!message.trim()) {
      Alert.alert('Message requis', 'Veuillez ajouter un message pour le propriétaire');
      return;
    }

    try {
      setLoading(true);
      const response = await bookingsApi.createBooking(ad.id, message);
      if (response.success && response.booking) {
        setBookingId(response.booking.id);
        setStep('payment');
      } else {
        Alert.alert('❌ Erreur', response.error || 'Erreur lors de la réservation');
      }
    } catch (error) {
      Alert.alert('❌ Erreur', 'Erreur lors de la réservation');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      Alert.alert('Méthode requise', 'Veuillez sélectionner une méthode de paiement');
      return;
    }

    try {
      setLoading(true);
      const response = await bookingsApi.payBooking(bookingId, paymentMethod);
      if (response.success) {
        setStep('success');
      } else {
        Alert.alert('❌ Erreur', response.error || 'Erreur lors du paiement');
      }
    } catch (error) {
      Alert.alert('❌ Erreur', 'Erreur lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('confirm');
    setMessage('');
    setPaymentMethod('');
    setBookingId('');
    onClose();
  };

  const handleSuccess = () => {
    onBookingComplete();
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={loading}>
            <Icon name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Réserver cette annonce</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Contenu selon l'étape */}
        {step === 'confirm' && (
          <View style={styles.content}>
            {/* Info annonce */}
            <View style={styles.adCard}>
              <View style={styles.imageContainer}>
                {ad.imageUrl ? (
                  <Image
                    source={{ uri: ad.imageUrl }}
                    style={styles.adImage}
                  />
                ) : (
                  <View style={[styles.adImage, styles.placeholderImage]}>
                    <Icon name="image-off" size={40} color="#CCC" />
                  </View>
                )}
              </View>
              <View style={styles.adInfo}>
                <Text style={styles.adTitle} numberOfLines={2}>
                  {ad.title}
                </Text>
                <Text style={styles.adPrice}>{ad.price.toLocaleString('fr-FR')} DZD</Text>
              </View>
            </View>

            {/* Message */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Message au propriétaire</Text>
              <TextInput
                style={styles.input}
                placeholder="Décrivez votre intérêt ou posez des questions..."
                placeholderTextColor="#999"
                multiline={true}
                numberOfLines={4}
                value={message}
                onChangeText={setMessage}
                editable={!loading}
              />
            </View>

            {/* Info importante */}
            <View style={styles.infoBox}>
              <Icon name="information-outline" size={20} color="#FF9800" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Double confirmation</Text>
                <Text style={styles.infoText}>
                  Le propriétaire recevra votre demande et pourra l'accepter ou la refuser.
                </Text>
              </View>
            </View>

            {/* Bouton */}
            <TouchableOpacity
              style={[styles.button, styles.reserveButton, loading && styles.buttonDisabled]}
              onPress={handleReserve}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Icon name="calendar-check" size={20} color="#FFF" />
                  <Text style={styles.buttonText}>Continuer vers le paiement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === 'payment' && (
          <View style={styles.content}>
            {/* Info prix */}
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Montant à payer</Text>
              <Text style={styles.priceValue}>{ad.price.toLocaleString('fr-FR')} DZD</Text>
            </View>

            {/* Méthodes de paiement */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Méthode de paiement</Text>

              {/* MVola */}
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'MVola' && styles.paymentOptionActive,
                ]}
                onPress={() => setPaymentMethod('MVola')}
                disabled={loading}
              >
                <View style={styles.paymentIcon}>
                  <Icon name="wallet-outline" size={24} color="#1B5E20" />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>MVola</Text>
                  <Text style={styles.paymentDesc}>Paiement mobile Malagasy</Text>
                </View>
                {paymentMethod === 'MVola' && (
                  <Icon name="check-circle" size={24} color="#1B5E20" />
                )}
              </TouchableOpacity>

              {/* Orange Money */}
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'OrangeMoney' && styles.paymentOptionActive,
                ]}
                onPress={() => setPaymentMethod('OrangeMoney')}
                disabled={loading}
              >
                <View style={styles.paymentIcon}>
                  <Icon name="wallet-outline" size={24} color="#FF6B00" />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>Orange Money</Text>
                  <Text style={styles.paymentDesc}>Paiement Orange Money</Text>
                </View>
                {paymentMethod === 'OrangeMoney' && (
                  <Icon name="check-circle" size={24} color="#FF6B00" />
                )}
              </TouchableOpacity>

              {/* Airtel Money */}
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'AirtelMoney' && styles.paymentOptionActive,
                ]}
                onPress={() => setPaymentMethod('AirtelMoney')}
                disabled={loading}
              >
                <View style={styles.paymentIcon}>
                  <Icon name="wallet-outline" size={24} color="#C41E3A" />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>Airtel Money</Text>
                  <Text style={styles.paymentDesc}>Paiement Airtel Money</Text>
                </View>
                {paymentMethod === 'AirtelMoney' && (
                  <Icon name="check-circle" size={24} color="#C41E3A" />
                )}
              </TouchableOpacity>

              {/* Carte Bancaire (Premium only) */}
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'Card' && styles.paymentOptionActive,
                ]}
                onPress={() => setPaymentMethod('Card')}
                disabled={loading}
              >
                <View style={styles.paymentIcon}>
                  <Icon name="credit-card" size={24} color="#2196F3" />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>Carte Bancaire</Text>
                  <Text style={styles.paymentDesc}>Visa, Mastercard</Text>
                </View>
                {paymentMethod === 'Card' && (
                  <Icon name="check-circle" size={24} color="#2196F3" />
                )}
              </TouchableOpacity>
            </View>

            {/* Info importante */}
            <View style={styles.infoBox}>
              <Icon name="shield-check-outline" size={20} color="#4CAF50" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Paiement simulé</Text>
                <Text style={styles.infoText}>
                  Ce paiement est une simulation. Aucune charge réelle ne sera effectuée.
                </Text>
              </View>
            </View>

            {/* Bouton paiement */}
            <TouchableOpacity
              style={[styles.button, styles.payButton, loading && styles.buttonDisabled]}
              onPress={handlePayment}
              disabled={loading || !paymentMethod}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Icon name="check" size={20} color="#FFF" />
                  <Text style={styles.buttonText}>Confirmer le paiement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === 'success' && (
          <View style={styles.content}>
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Icon name="check-circle" size={80} color="#4CAF50" />
              </View>

              <Text style={styles.successTitle}>Réservation confirmée!</Text>
              <Text style={styles.successDesc}>
                Votre réservation a été créée avec succès. Le propriétaire a reçu votre demande et vous contactera bientôt.
              </Text>

              <View style={styles.successDetails}>
                <View style={styles.detailRow}>
                  <Icon name="calendar-check" size={20} color="#1B5E20" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Annonce</Text>
                    <Text style={styles.detailValue}>{ad.title}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Icon name="currency-eur" size={20} color="#1B5E20" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Montant payé</Text>
                    <Text style={styles.detailValue}>
                      {ad.price.toLocaleString('fr-FR')} DZD
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Icon name="checklist" size={20} color="#1B5E20" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Statut</Text>
                    <Text style={styles.detailValue}>En attente d'acceptation</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.successNote}>
                Vous recevrez une notification dès que le propriétaire aura examiné votre demande.
              </Text>

              <TouchableOpacity
                style={[styles.button, styles.successButton]}
                onPress={handleSuccess}
              >
                <Icon name="home" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Retour à l'accueil</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  // Ad Card
  adCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  adImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F5F5F5',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  adInfo: {
    flex: 1,
  },
  adTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  adPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B5E20',
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },

  // Input
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
  },

  // Price Card
  priceCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1B5E20',
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1B5E20',
  },

  // Payment Options
  paymentOption: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  paymentOptionActive: {
    backgroundColor: '#F8F8F8',
    borderColor: '#1B5E20',
    borderWidth: 2,
  },
  paymentIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  paymentDesc: {
    fontSize: 12,
    color: '#999',
  },

  // Button
  button: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  reserveButton: {
    backgroundColor: '#1B5E20',
  },
  payButton: {
    backgroundColor: '#4CAF50',
  },
  successButton: {
    backgroundColor: '#1B5E20',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Success
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 12,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  successDetails: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  successNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
});
