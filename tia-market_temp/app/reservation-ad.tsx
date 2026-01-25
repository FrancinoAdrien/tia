import { AuthContext } from '@/context/AuthContext';
import { reservationAdsApi } from '@/utils/api';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useContext, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface ReservationFormData {
  title: string;
  description: string;
  type: 'restaurant' | 'hotel' | 'other';
  pricePerUnit: number;
  unit: 'per_person' | 'per_room' | 'per_service';
  location: string;
  phone: string;
  email: string;
  website?: string;
  availableFromDate?: string;
  availableToDate?: string;
  isOpen24h: boolean;
  openingTime?: string;
  closingTime?: string;
  capacity: number;
  features: string[];
}

const RESERVATION_TYPES = [
  { id: 'restaurant', label: 'Restaurant', icon: 'silverware-fork-knife' },
  { id: 'hotel', label: 'Hôtel', icon: 'bed' },
  { id: 'other', label: 'Autre', icon: 'briefcase' },
];

const AVAILABLE_FEATURES = [
  'WiFi',
  'Parking',
  'Climatisation',
  'Terrasse',
  'Salle de réunion',
  'Piscine',
  'Restaurant',
  'Bar',
  'Petit-déjeuner inclus',
  'Accès handicapés',
];

export default function ReservationAdScreen() {
  const { userInfo } = useContext(AuthContext);
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<ReservationFormData>({
    title: '',
    description: '',
    type: 'restaurant',
    pricePerUnit: 0,
    unit: 'per_person',
    location: '',
    phone: userInfo?.phone || '',
    email: userInfo?.email || '',
    website: '',
    isOpen24h: true,
    capacity: 1,
    features: [],
  });

  const handleInputChange = (field: keyof ReservationFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      if (showDateFrom) {
        handleInputChange('availableFromDate', selectedDate.toLocaleDateString('fr-FR'));
      } else {
        handleInputChange('availableToDate', selectedDate.toLocaleDateString('fr-FR'));
      }
    }
    setShowDateFrom(false);
    setShowDateTo(false);
  };

  const handlePublish = async () => {
    // Validation
    if (!formData.title || !formData.description || !formData.location) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.pricePerUnit <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix valide');
      return;
    }

    if (formData.phone && !/^[+\d\s\-()]+$/.test(formData.phone)) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide');
      return;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }

    Alert.alert(
      'Confirmation',
      'Votre annonce de réservation sera publiée et visible par tous les utilisateurs.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Publier',
          style: 'default',
          onPress: async () => {
            setIsLoading(true);
            try {
              // Préparer les données pour l'API
              const adData = {
                type: formData.type,
                title: formData.title,
                description: formData.description,
                pricePerUnit: parseFloat(formData.pricePerUnit.toString()),
                unitType: formData.unit,
                availableFromDate: formData.availableFromDate || null,
                availableToDate: formData.availableToDate || null,
                isOpen24h: formData.isOpen24h,
                openingTime: formData.openingTime || null,
                closingTime: formData.closingTime || null,
                capacity: parseInt(formData.capacity.toString()),
                features: formData.features,
                phone: formData.phone,
                email: formData.email,
                website: formData.website || null,
                location: formData.location,
              };

              const response = await reservationAdsApi.createReservationAd(adData);

              if (response.success) {
                Alert.alert('Succès', 'Votre annonce a été publiée avec succès!', [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/my-ads'),
                  },
                ]);
              } else {
                Alert.alert('Erreur', response.error || 'Impossible de publier l\'annonce');
              }
            } catch (error: any) {
              console.error('❌ Erreur publication annonce:', error);
              Alert.alert('Erreur', 'Une erreur est survenue lors de la publication');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="chevron-left" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Annonce de Réservation</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressStep, styles.progressStepActive]}>
            <Text style={styles.progressStepText}>Info</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <Text style={styles.progressStepText}>Photos</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <Text style={styles.progressStepText}>Aperçu</Text>
          </View>
        </View>

        {/* Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type d'établissement</Text>
          <View style={styles.typeGrid}>
            {RESERVATION_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  formData.type === type.id && styles.typeCardActive,
                ]}
                onPress={() => handleInputChange('type', type.id)}
              >
                <Icon
                  name={type.icon}
                  size={32}
                  color={formData.type === type.id ? '#1B5E20' : '#999'}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    formData.type === type.id && styles.typeLabelActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de base</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom de l'établissement *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Restaurant La Bonne Auberge"
              placeholderTextColor="#999"
              value={formData.title}
              onChangeText={(value) => handleInputChange('title', value)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Décrivez votre établissement, spécialités, ambiance..."
              placeholderTextColor="#999"
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.rowContainer}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Prix par {formData.unit === 'per_person' ? 'personne' : formData.unit === 'per_room' ? 'chambre' : 'service'} *</Text>
              <View style={styles.priceInputContainer}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  placeholderTextColor="#999"
                  value={formData.pricePerUnit.toString()}
                  onChangeText={(value) =>
                    handleInputChange('pricePerUnit', parseInt(value) || 0)
                  }
                  keyboardType="numeric"
                />
                <Text style={styles.currencyLabel}>AR</Text>
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Unité</Text>
              <View style={styles.selectContainer}>
                <Icon name="chevron-down" size={20} color="#999" />
                <Text style={styles.selectText}>
                  {formData.unit === 'per_person'
                    ? 'Par personne'
                    : formData.unit === 'per_room'
                    ? 'Par chambre'
                    : 'Par service'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disponibilités</Text>

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Ouvert 24h/24</Text>
            <Switch
              value={formData.isOpen24h}
              onValueChange={(value) => handleInputChange('isOpen24h', value)}
              trackColor={{ false: '#E0E0E0', true: '#1B5E20' }}
              thumbColor={formData.isOpen24h ? '#1B5E20' : '#999'}
            />
          </View>

          {!formData.isOpen24h && (
            <View style={styles.timeContainer}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Ouverture</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM (ex: 09:00)"
                  placeholderTextColor="#999"
                  value={formData.openingTime}
                  onChangeText={(value) => handleInputChange('openingTime', value)}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Fermeture</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM (ex: 23:00)"
                  placeholderTextColor="#999"
                  value={formData.closingTime}
                  onChangeText={(value) => handleInputChange('closingTime', value)}
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Disponible à partir du</Text>
            <TextInput
              style={styles.input}
              placeholder="JJ/MM/YYYY (ex: 25/01/2026)"
              placeholderTextColor="#999"
              value={formData.availableFromDate}
              onChangeText={(value) => handleInputChange('availableFromDate', value)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Disponible jusqu'au</Text>
            <TextInput
              style={styles.input}
              placeholder="JJ/MM/YYYY (ex: 31/12/2026)"
              placeholderTextColor="#999"
              value={formData.availableToDate}
              onChangeText={(value) => handleInputChange('availableToDate', value)}
            />
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de contact</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lieu</Text>
            <TextInput
              style={styles.input}
              placeholder="Ville, quartier..."
              placeholderTextColor="#999"
              value={formData.location}
              onChangeText={(value) => handleInputChange('location', value)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={styles.input}
              placeholder="+261 XX XX XX XX"
              placeholderTextColor="#999"
              value={formData.phone}
              onChangeText={(value) => handleInputChange('phone', value)}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Site web (optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com"
              placeholderTextColor="#999"
              value={formData.website}
              onChangeText={(value) => handleInputChange('website', value)}
            />
          </View>
        </View>

        {/* Capacity & Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capacité et équipements</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Capacité maximale</Text>
            <View style={styles.capacityContainer}>
              <TouchableOpacity
                style={styles.capacityButton}
                onPress={() =>
                  handleInputChange('capacity', Math.max(1, formData.capacity - 1))
                }
              >
                <Icon name="minus" size={20} color="#333" />
              </TouchableOpacity>
              <Text style={styles.capacityValue}>{formData.capacity}</Text>
              <TouchableOpacity
                style={styles.capacityButton}
                onPress={() => handleInputChange('capacity', formData.capacity + 1)}
              >
                <Icon name="plus" size={20} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Équipements</Text>
            <View style={styles.featuresGrid}>
              {AVAILABLE_FEATURES.map((feature) => (
                <TouchableOpacity
                  key={feature}
                  style={[
                    styles.featureBadge,
                    formData.features.includes(feature) && styles.featureBadgeActive,
                  ]}
                  onPress={() => toggleFeature(feature)}
                >
                  <Icon
                    name={formData.features.includes(feature) ? 'check-circle' : 'circle-outline'}
                    size={18}
                    color={formData.features.includes(feature) ? '#1B5E20' : '#999'}
                  />
                  <Text
                    style={[
                      styles.featureText,
                      formData.features.includes(feature) && styles.featureTextActive,
                    ]}
                  >
                    {feature}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.publishButton, isLoading && styles.publishButtonDisabled]} 
            onPress={handlePublish}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Icon name="check" size={20} color="#FFF" />
                <Text style={styles.publishButtonText}>Publier l'annonce</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.draftButton} 
            onPress={() => router.back()}
            disabled={isLoading}
          >
            <Icon name="file-document" size={20} color="#1B5E20" />
            <Text style={styles.draftButtonText}>Sauvegarder comme brouillon</Text>
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    marginBottom: 16,
  },
  progressStep: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepActive: {
    backgroundColor: '#1B5E20',
  },
  progressStepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  typeCardActive: {
    borderColor: '#1B5E20',
    backgroundColor: '#E8F5E9',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
  typeLabelActive: {
    color: '#1B5E20',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
  },
  textArea: {
    paddingTop: 12,
    minHeight: 100,
  },
  rowContainer: {
    flexDirection: 'row',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
  },
  currencyLabel: {
    fontWeight: '600',
    color: '#666',
    fontSize: 13,
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    gap: 20,
  },
  capacityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capacityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  featureBadgeActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#1B5E20',
  },
  featureText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  featureTextActive: {
    color: '#1B5E20',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  publishButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1B5E20',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  draftButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#1B5E20',
  },
  draftButtonText: {
    color: '#1B5E20',
    fontWeight: '700',
    fontSize: 16,
  },
});
