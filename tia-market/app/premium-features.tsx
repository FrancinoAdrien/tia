import { AuthContext } from '@/context/AuthContext';
import { router } from 'expo-router';
import React, { useContext, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const PREMIUM_OPTIONS = [
  {
    id: 'professional',
    icon: 'briefcase',
    title: 'Annonce Professionnelle',
    description: 'Vendez comme professionnel avec badge',
    color: '#FF6B35',
    features: ['Badge professionnel', 'Jusqu\'à 20 photos', 'Mise en avant 7 jours'],
    route: '/post-ad?type=professional',
  },
  {
    id: 'reservation',
    icon: 'calendar-check',
    title: 'Annonce de Réservation',
    description: 'Créez des offres pour restauration/hôtellerie',
    color: '#1A936F',
    features: ['Gestion des disponibilités', 'Tarifs par période', 'Photos illimitées'],
    route: '/reservation-ad',
  },
  {
    id: 'featured',
    icon: 'star',
    title: 'Mettre à la Une',
    description: 'Augmentez la visibilité de vos annonces',
    color: '#FFD166',
    features: ['Première position', '30 jours en vedette', 'Notifications augmentées'],
    route: '/featured-ads',
  },
];

export default function PremiumFeaturesScreen() {
  const { userInfo } = useContext(AuthContext);
  
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isPremium = userInfo?.premiumPack && userInfo.premiumPack !== 'simple';
  const premiumPlan = userInfo?.premiumPack || 'simple';

  const formatExpiryDate = (date: string | undefined) => {
    if (!date) return 'Date non disponible';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
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
          <Text style={styles.headerTitle}>Mes Offres Premium</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Premium Status */}
        <View style={styles.statusContainer}>
          <View style={styles.statusBadge}>
            <Icon name="crown" size={32} color="#FFD700" />
          </View>

          <Text style={styles.statusTitle}>
            {premiumPlan === 'simple' ? 'Compte Standard' : `Compte ${premiumPlan.charAt(0).toUpperCase() + premiumPlan.slice(1)}`}
          </Text>

          <View style={styles.statusDetails}>
            <View style={styles.statusRow}>
              <Icon name="check-circle" size={20} color="#1B5E20" />
              <View style={styles.statusContent}>
                <Text style={styles.statusLabel}>Valable jusqu'au</Text>
                <Text style={styles.statusValue}>
                  {formatExpiryDate(userInfo?.endPremium)}
                </Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <Icon name="calendar-clock" size={20} color="#1B5E20" />
              <View style={styles.statusContent}>
                <Text style={styles.statusLabel}>Jours restants</Text>
                <Text style={styles.statusValue}>
                  {userInfo?.endPremium
                    ? Math.max(
                        0,
                        Math.ceil(
                          (new Date(userInfo.endPremium).getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24)
                        )
                      )
                    : 0}{' '}
                  jours
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.renewButton}>
            <Icon name="refresh" size={18} color="#1B5E20" />
            <Text style={styles.renewButtonText}>Renouveler l'abonnement</Text>
          </TouchableOpacity>
        </View>

        {/* Premium Options */}
        <View style={styles.optionsSection}>
          <Text style={styles.sectionTitle}>Créer une annonce</Text>

          {PREMIUM_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionCard,
                expandedId === option.id && styles.optionCardExpanded,
              ]}
              onPress={() => setExpandedId(expandedId === option.id ? null : option.id)}
              activeOpacity={0.7}
            >
              {/* Main Content */}
              <View style={styles.optionContent}>
                <View style={[styles.optionIcon, { backgroundColor: option.color }]}>
                  <Icon name={option.icon} size={28} color="#FFF" />
                </View>

                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>

                <Icon
                  name={expandedId === option.id ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color="#999"
                />
              </View>

              {/* Expanded Content */}
              {expandedId === option.id && (
                <View style={styles.optionExpanded}>
                  <View style={styles.featuresList}>
                    {option.features.map((feature, index) => (
                      <View key={index} style={styles.featureItem}>
                        <Icon name="check-circle" size={16} color={option.color} />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: option.color }]}
                    onPress={() => router.push(option.route as any)}
                  >
                    <Text style={styles.createButtonText}>Créer cette annonce</Text>
                    <Icon name="plus" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Statistics */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Vos statistiques</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Icon name="file-document" size={28} color="#118AB2" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Annonces</Text>
            </View>

            <View style={styles.statCard}>
              <Icon name="eye" size={28} color="#FF6B35" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Vues</Text>
            </View>

            <View style={styles.statCard}>
              <Icon name="message-text" size={28} color="#1B5E20" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Messages</Text>
            </View>

            <View style={styles.statCard}>
              <Icon name="star" size={28} color="#FFD166" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>À la une</Text>
            </View>
          </View>
        </View>

        {/* Benefits Overview */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>Avantages de votre abonnement</Text>

          <View style={styles.benefitsGrid}>
            {[
              { icon: 'star', title: 'Mise en avant', description: 'Vos annonces en premier' },
              {
                icon: 'briefcase',
                title: 'Mode Pro',
                description: 'Vendez comme professionnel',
              },
              {
                icon: 'calendar-check',
                title: 'Réservations',
                description: 'Gérez les disponibilités',
              },
              { icon: 'chart-line', title: 'Statistiques', description: 'Analysez vos ventes' },
              { icon: 'upload-multiple', title: 'Plus de photos', description: '20 par annonce' },
              { icon: 'shield-check', title: 'Support', description: 'Aide prioritaire' },
            ].map((benefit, index) => (
              <View key={index} style={styles.benefitCard}>
                <Icon name={benefit.icon} size={24} color="#1B5E20" />
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>{benefit.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <View style={styles.helpCard}>
            <View style={styles.helpIconContainer}>
              <Icon name="help-circle" size={32} color="#1B5E20" />
            </View>
            <Text style={styles.helpTitle}>Besoin d'aide?</Text>
            <Text style={styles.helpText}>
              Consultez nos guides pour optimiser vos ventes premium
            </Text>
            <TouchableOpacity style={styles.helpButton}>
              <Text style={styles.helpButtonText}>Consulter les guides</Text>
              <Icon name="arrow-right" size={18} color="#1B5E20" />
            </TouchableOpacity>
          </View>
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
  statusContainer: {
    backgroundColor: '#FFF',
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  statusBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFACD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  statusDetails: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusContent: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  renewButton: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#1B5E20',
  },
  renewButtonText: {
    color: '#1B5E20',
    fontWeight: '600',
    fontSize: 14,
  },
  optionsSection: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  optionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
    padding: 16,
  },
  optionCardExpanded: {
    borderColor: '#1B5E20',
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#666',
  },
  optionExpanded: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  featuresList: {
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  featureText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  createButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  statsSection: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
  },
  benefitsSection: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  benefitCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  helpSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  helpCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#1B5E20',
  },
  helpIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#C8E6C9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: '#555E54',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  helpButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  helpButtonText: {
    color: '#1B5E20',
    fontWeight: '600',
    fontSize: 13,
  },
});
