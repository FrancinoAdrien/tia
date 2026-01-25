import { AuthContext } from '@/context/AuthContext';
import { locationApi } from '@/utils/api';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useContext, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const PLANS: Record<'starter' | 'pro' | 'enterprise', { name: string; price: number; days: number; color: string }> = {
  starter: { name: 'Starter', price: 50000, days: 30, color: '#118AB2' },
  pro: { name: 'Pro', price: 100000, days: 30, color: '#1B5E20' },
  enterprise: { name: 'Entreprise', price: 200000, days: 30, color: '#FF6B35' },
};

interface PaymentFormData {
  cardholderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  email: string;
}

export default function PremiumPaymentScreen() {
  const params = useLocalSearchParams();
  const { userInfo, updateUserPremium } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'preview' | 'payment' | 'success'>('preview');

  const planId = (params.plan as 'starter' | 'pro' | 'enterprise') || 'starter';
  const plan = PLANS[planId];

  const [formData, setFormData] = useState<PaymentFormData>({
    cardholderName: '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    email: userInfo?.email || '',
  });

  const handleInputChange = (field: keyof PaymentFormData, value: string) => {
    // Validation et formatage
    if (field === 'cardNumber') {
      value = value.replace(/\D/g, '').substring(0, 16);
      value = value.replace(/(\d{4})/g, '$1 ').trim();
    } else if (field === 'expiryMonth') {
      value = value.replace(/\D/g, '').substring(0, 2);
    } else if (field === 'expiryYear') {
      value = value.replace(/\D/g, '').substring(0, 2);
    } else if (field === 'cvv') {
      value = value.replace(/\D/g, '').substring(0, 3);
    }

    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.cardholderName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le nom du titulaire');
      return false;
    }
    if (!formData.cardNumber.replace(/\s/g, '')) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de carte valide');
      return false;
    }
    if (formData.cardNumber.replace(/\s/g, '').length !== 16) {
      Alert.alert('Erreur', 'Le numéro de carte doit contenir 16 chiffres');
      return false;
    }
    if (!formData.expiryMonth || !formData.expiryYear) {
      Alert.alert('Erreur', 'Veuillez entrer la date d\'expiration');
      return false;
    }
    if (!formData.cvv || formData.cvv.length !== 3) {
      Alert.alert('Erreur', 'Le CVV doit contenir 3 chiffres');
      return false;
    }
    if (!formData.email.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Simulation de paiement - attendre 2 secondes
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Appeler l'API pour activer le premium
      const response = await locationApi.upgradeToPremium(planId);

      if (response.success) {
        setStep('success');
        // Mettre à jour le contexte utilisateur
        await updateUserPremium();
      } else {
        Alert.alert('Erreur', response.error || 'Erreur lors de la transaction');
      }
    } catch (error: any) {
      console.error('Erreur paiement:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    router.replace('/(tabs)/account');
  };

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: plan.color }]}>
            <Icon name="check-circle" size={80} color="#FFF" />
          </View>

          <Text style={styles.successTitle}>Paiement réussi! 🎉</Text>
          <Text style={styles.successMessage}>
            Bienvenue dans TIA Market Premium
          </Text>

          <View style={styles.successDetails}>
            <View style={styles.detailRow}>
              <Icon name="check" size={24} color="#1B5E20" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Plan activé</Text>
                <Text style={styles.detailValue}>{plan.name}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="currency-eur" size={24} color="#1B5E20" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Montant payé</Text>
                <Text style={styles.detailValue}>
                  {plan.price.toLocaleString('fr-FR')} AR
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="calendar" size={24} color="#1B5E20" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Valable jusqu'au</Text>
                <Text style={styles.detailValue}>
                  {new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000)
                    .toLocaleDateString('fr-FR')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.nextStepsContainer}>
            <Text style={styles.nextStepsTitle}>Prochaines étapes:</Text>
            <View style={styles.nextStepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                Découvrez vos nouvelles fonctionnalités premium
              </Text>
            </View>
            <View style={styles.nextStepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                Créez vos annonces professionnelles et de réservation
              </Text>
            </View>
            <View style={styles.nextStepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                Boostez vos ventes avec les annonces à la une
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.successButton, { backgroundColor: plan.color }]}
            onPress={handleSuccess}
          >
            <Text style={styles.successButtonText}>Retour au compte</Text>
            <Icon name="arrow-right" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'payment') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => setStep('preview')}
                style={styles.backButton}
              >
                <Icon name="chevron-left" size={28} color="#333" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Paiement</Text>
              <View style={{ width: 28 }} />
            </View>

            {/* Payment Form */}
            <View style={styles.formContainer}>
              {/* Cardholder Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nom du titulaire</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Jean Dupont"
                  placeholderTextColor="#999"
                  value={formData.cardholderName}
                  onChangeText={(value) => handleInputChange('cardholderName', value)}
                  editable={!loading}
                />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@example.com"
                  placeholderTextColor="#999"
                  value={formData.email}
                  onChangeText={(value) => handleInputChange('email', value)}
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>

              {/* Card Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Numéro de carte</Text>
                <View style={styles.cardInputContainer}>
                  <Icon name="credit-card" size={20} color="#999" />
                  <TextInput
                    style={styles.cardInput}
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor="#999"
                    value={formData.cardNumber}
                    onChangeText={(value) => handleInputChange('cardNumber', value)}
                    keyboardType="numeric"
                    editable={!loading}
                    maxLength={19}
                  />
                </View>
              </View>

              {/* Expiry & CVV */}
              <View style={styles.rowContainer}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                  <Text style={styles.label}>Expire</Text>
                  <View style={styles.expiryContainer}>
                    <TextInput
                      style={styles.expiryInput}
                      placeholder="MM"
                      placeholderTextColor="#999"
                      value={formData.expiryMonth}
                      onChangeText={(value) => handleInputChange('expiryMonth', value)}
                      keyboardType="numeric"
                      editable={!loading}
                      maxLength={2}
                    />
                    <Text style={styles.expirySlash}>/</Text>
                    <TextInput
                      style={styles.expiryInput}
                      placeholder="YY"
                      placeholderTextColor="#999"
                      value={formData.expiryYear}
                      onChangeText={(value) => handleInputChange('expiryYear', value)}
                      keyboardType="numeric"
                      editable={!loading}
                      maxLength={2}
                    />
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.label}>CVV</Text>
                  <View style={styles.cardInputContainer}>
                    <Icon name="lock" size={20} color="#999" />
                    <TextInput
                      style={styles.cardInput}
                      placeholder="123"
                      placeholderTextColor="#999"
                      value={formData.cvv}
                      onChangeText={(value) => handleInputChange('cvv', value)}
                      keyboardType="numeric"
                      editable={!loading}
                      maxLength={3}
                    />
                  </View>
                </View>
              </View>

              {/* Order Summary */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Résumé de la commande</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{plan.name}</Text>
                  <Text style={styles.summaryValue}>
                    {plan.price.toLocaleString('fr-FR')} AR
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Frais de traitement</Text>
                  <Text style={styles.summaryValue}>0 AR</Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotal}>Total</Text>
                  <Text style={[styles.summaryTotal, { color: plan.color }]}>
                    {plan.price.toLocaleString('fr-FR')} AR
                  </Text>
                </View>
              </View>

              {/* Security Notice */}
              <View style={styles.securityNotice}>
                <Icon name="shield-check" size={20} color="#1B5E20" />
                <Text style={styles.securityText}>
                  Paiement sécurisé avec chiffrement SSL 256-bit
                </Text>
              </View>

              {/* Beta Notice */}
              <View style={styles.betaNotice}>
                <Icon name="information" size={18} color="#856404" />
                <Text style={styles.betaText}>
                  Ceci est une SIMULATION de paiement pour la version BETA. Aucun paiement réel ne sera effectué.
                </Text>
              </View>
            </View>

            {/* Payment Button */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.payButton, { backgroundColor: plan.color, opacity: loading ? 0.6 : 1 }]}
                onPress={handlePayment}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ActivityIndicator color="#FFF" />
                    <Text style={styles.payButtonText}>Traitement...</Text>
                  </>
                ) : (
                  <>
                    <Icon name="lock-check" size={20} color="#FFF" />
                    <Text style={styles.payButtonText}>
                      Payer {plan.price.toLocaleString('fr-FR')} AR
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => router.back()}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Preview step
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="chevron-left" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Résumé</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Plan Preview */}
        <View style={styles.previewContainer}>
          <View style={[styles.planBadge, { backgroundColor: plan.color }]}>
            <Icon name="crown" size={32} color="#FFF" />
          </View>

          <Text style={styles.planNameLarge}>{plan.name}</Text>
          <Text style={styles.planDescriptionLarge}>
            {planId === 'starter'
              ? 'Page boutique personnalisée, 10 photos/annonce, jusqu\'à 20 produits'
              : planId === 'pro'
              ? 'Badge vérifié, statistiques avancées, 20 photos/annonce, jusqu\'à 40 produits'
              : 'Badge entreprise premium, statistiques très avancées, photos illimitées, quantité illimitée'}
          </Text>

          <View style={styles.pricePreviewBox}>
            <Text style={styles.priceLabel}>Montant total</Text>
            <View style={styles.priceRow}>
              <Text style={[styles.pricePreview, { color: plan.color }]}>
                {plan.price.toLocaleString('fr-FR')}
              </Text>
              <Text style={[styles.currencyPreview, { color: plan.color }]}>AR</Text>
            </View>
            <Text style={styles.expiryDateLabel}>
              Valable jusqu'au {' '}
              <Text style={styles.expiryDateValue}>
                {new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000)
                  .toLocaleDateString('fr-FR')}
              </Text>
            </Text>
          </View>

          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Avantages inclus:</Text>
            <View style={styles.benefitsList}>
              {['Annonces à la une', 'Annonces professionnelles', 'Gestion des réservations', 'Support prioritaire'].map((benefit, i) => (
                <View key={i} style={styles.benefitItem}>
                  <Icon name="check-circle" size={20} color={plan.color} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Proceed Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.proceedButton, { backgroundColor: plan.color }]}
            onPress={() => setStep('payment')}
          >
            <Text style={styles.proceedButtonText}>Procéder au paiement</Text>
            <Icon name="arrow-right" size={20} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  successDetails: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  nextStepsContainer: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1B5E20',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  successButton: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  successButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  previewContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  planBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  planNameLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  planDescriptionLarge: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  pricePreviewBox: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 16,
  },
  pricePreview: {
    fontSize: 40,
    fontWeight: '700',
  },
  currencyPreview: {
    fontSize: 20,
    fontWeight: '600',
  },
  expiryDateLabel: {
    fontSize: 13,
    color: '#666',
  },
  expiryDateValue: {
    fontWeight: '600',
    color: '#333',
  },
  benefitsContainer: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  cardInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  cardInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  rowContainer: {
    flexDirection: 'row',
  },
  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  expiryInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 14,
    textAlign: 'center',
  },
  expirySlash: {
    fontSize: 16,
    color: '#999',
    marginHorizontal: 4,
  },
  summaryBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: '#2E7D32',
    lineHeight: 18,
  },
  betaNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  betaText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  payButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  payButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  proceedButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  proceedButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  cancelButtonText: {
    textAlign: 'center',
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
  },
});
