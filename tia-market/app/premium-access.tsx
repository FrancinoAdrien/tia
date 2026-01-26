import { AuthContext } from '@/context/AuthContext';
import { router } from 'expo-router';
import React, { useContext, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface PremiumPlan {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  price: number;
  currency: string;
  period: string;
  pricePerMonth: number;
  description: string;
  savings?: string;
  color: string;
}

const PREMIUM_PLANS: PremiumPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49000,
    currency: 'Ar',
    period: '/mois',
    pricePerMonth: 49000,
    description: '20 annonces/mois, 10 photos/annonce, quantité jusqu\'à 10, annonces réservations, annonces pro, 7 jours à la une pour 5 annonces',
    color: '#118AB2',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99000,
    currency: 'Ar',
    period: '/mois',
    pricePerMonth: 99000,
    description: '50 annonces/mois, badge vendeur vérifié, statistiques avancées, 20 photos (20 annonces), 15 photos (30 restantes), priorité recherche, quantité jusqu\'à 30, 5 remontées gratuites/mois, 14 jours à la une pour 15 annonces',
    color: '#1B5E20',
  },
  {
    id: 'enterprise',
    name: 'Entreprise',
    price: 199000,
    currency: 'Ar',
    period: '/mois',
    pricePerMonth: 199000,
    description: 'Annonces illimitées, quantité illimitée, badge "Entreprise Premium", multi-utilisateurs, position garantie en haut, remontée illimitée, à la une illimitée',
    savings: 'Solution complète',
    color: '#FF6B35',
  },
];

const PREMIUM_FEATURES = {
  starter: [
    { icon: 'tag-multiple', title: '20 annonces/mois', description: 'Publiez jusqu\'à 20 annonces par mois' },
    { icon: 'image-multiple', title: '10 photos par annonce', description: 'Jusqu\'à 10 photos pour chaque annonce' },
    { icon: 'package-variant', title: 'Quantité jusqu\'à 10', description: 'Vendez jusqu\'à 10 produits par annonce' },
    { icon: 'calendar-check', title: 'Annonces réservations', description: 'Hotels, restaurants et autres services' },
    { icon: 'briefcase', title: 'Annonces professionnelles', description: 'Marquez vos annonces comme pro' },
    { icon: 'star', title: '7 jours à la une', description: '5 annonces à la une pendant 7 jours' },
  ],
  pro: [
    { icon: 'tag-multiple', title: '50 annonces/mois', description: 'Publiez jusqu\'à 50 annonces par mois' },
    { icon: 'badge-account', title: 'Badge vendeur vérifié', description: 'Badge de confiance sur toutes vos annonces' },
    { icon: 'chart-line', title: 'Statistiques avancées', description: 'Analyses détaillées de vos performances' },
    { icon: 'image-multiple', title: 'Photos illimitées', description: '20 photos pour 20 annonces, 15 pour le reste' },
    { icon: 'magnify', title: 'Priorité recherche', description: 'Apparaissez en premier dans les recherches' },
    { icon: 'package-variant', title: 'Quantité jusqu\'à 30', description: 'Vendez jusqu\'à 30 produits par annonce' },
    { icon: 'arrow-up-bold', title: '5 remontées gratuites', description: 'Remontez vos annonces gratuitement chaque mois' },
    { icon: 'star', title: '14 jours à la une', description: '15 annonces à la une pendant 14 jours' },
  ],
  enterprise: [
    { icon: 'infinity', title: 'Annonces illimitées', description: 'Aucune limite sur le nombre d\'annonces' },
    { icon: 'package-variant', title: 'Quantité illimitée', description: 'Vendez autant de produits que vous voulez' },
    { icon: 'office-building', title: 'Badge Entreprise Premium', description: 'Badge exclusif sur toutes vos annonces' },
    { icon: 'account-multiple', title: 'Multi-utilisateurs', description: 'Plusieurs utilisateurs pour gérer le compte' },
    { icon: 'trophy', title: 'Position garantie en haut', description: 'Toujours en haut de votre catégorie' },
    { icon: 'arrow-up-bold', title: 'Remontée illimitée', description: 'Remontez vos annonces autant que nécessaire' },
    { icon: 'star', title: 'À la une illimitée', description: 'Toutes vos annonces à la une gratuitement' },
    { icon: 'headset', title: 'Support prioritaire', description: 'Assistance dédiée 24/7' },
  ],
};

export default function PremiumAccessScreen() {
  const { userInfo } = useContext(AuthContext);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | null>(null);

  const handleSelectPlan = (planId: 'starter' | 'pro' | 'enterprise') => {
    setSelectedPlan(planId);
    router.push({
      pathname: '/premium-payment',
      params: { plan: planId },
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
          <Text style={styles.headerTitle}>Devenir Premium</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Icon name="crown" size={60} color="#FFD700" />
          <Text style={styles.heroTitle}>Accédez aux fonctionnalités Premium</Text>
          <Text style={styles.heroSubtitle}>
            Boostez vos ventes et gagnez plus avec TIA Market Premium
          </Text>
        </View>

        {/* Plans Section */}
        <View style={styles.plansSection}>
          {PREMIUM_PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                {
                  borderColor: plan.color,
                  borderWidth: selectedPlan === plan.id ? 2 : 1,
                  backgroundColor: selectedPlan === plan.id ? `${plan.color}10` : '#FFF',
                },
              ]}
              onPress={() => handleSelectPlan(plan.id)}
            >
              {plan.savings && (
                <View style={[styles.savingsBadge, { backgroundColor: plan.color }]}>
                  <Icon name="sale" size={14} color="#FFF" />
                  <Text style={styles.savingsText}>{plan.savings}</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceContainer}>
                  <Text style={[styles.price, { color: plan.color }]}>
                    {plan.price.toLocaleString('fr-FR')}
                  </Text>
                  <Text style={[styles.currency, { color: plan.color }]}>
                    {plan.currency}
                  </Text>
                </View>
                <Text style={styles.period}>{plan.period}</Text>
              </View>

              <View style={styles.pricePerMonthContainer}>
                <Text style={styles.pricePerMonth}>
                  {plan.pricePerMonth.toLocaleString('fr-FR')} AR/mois
                </Text>
              </View>

              <Text style={styles.description}>{plan.description}</Text>

              <TouchableOpacity
                style={[styles.selectButton, { backgroundColor: plan.color }]}
                onPress={() => handleSelectPlan(plan.id)}
              >
                <Text style={styles.selectButtonText}>Sélectionner</Text>
                <Icon name="arrow-right" size={20} color="#FFF" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Fonctionnalités par Plan</Text>

          {/* Starter Features */}
          <View style={styles.planFeaturesHeader} style={[styles.planFeaturesHeader, { borderLeftColor: '#118AB2' }]}>
            <Icon name="crown" size={20} color="#118AB2" />
            <Text style={styles.planFeatureName}>Pack Starter</Text>
          </View>
          <View style={styles.featuresGrid}>
            {PREMIUM_FEATURES.starter.map((feature, index) => (
              <View key={`starter-${index}`} style={[styles.featureItem, { borderLeftColor: '#118AB2' }]}>
                <View style={styles.featureIconContainer}>
                  <Icon name={feature.icon} size={24} color="#118AB2" />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>

          {/* Pro Features */}
          <View style={[styles.planFeaturesHeader, { borderLeftColor: '#1B5E20' }]}>
            <Icon name="crown" size={20} color="#1B5E20" />
            <Text style={styles.planFeatureName}>Pack Pro</Text>
          </View>
          <View style={styles.featuresGrid}>
            {PREMIUM_FEATURES.pro.map((feature, index) => (
              <View key={`pro-${index}`} style={[styles.featureItem, { borderLeftColor: '#1B5E20' }]}>
                <View style={styles.featureIconContainer}>
                  <Icon name={feature.icon} size={24} color="#1B5E20" />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>

          {/* Enterprise Features */}
          <View style={[styles.planFeaturesHeader, { borderLeftColor: '#FF6B35' }]}>
            <Icon name="crown" size={20} color="#FF6B35" />
            <Text style={styles.planFeatureName}>Pack Entreprise</Text>
          </View>
          <View style={styles.featuresGrid}>
            {PREMIUM_FEATURES.enterprise.map((feature, index) => (
              <View key={`enterprise-${index}`} style={[styles.featureItem, { borderLeftColor: '#FF6B35' }]}>
                <View style={styles.featureIconContainer}>
                  <Icon name={feature.icon} size={24} color="#FF6B35" />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Questions Fréquentes</Text>

          <View style={styles.faqItem}>
            <View style={styles.faqHeader}>
              <Icon name="help-circle" size={20} color="#1B5E20" />
              <Text style={styles.faqQuestionText}>Puis-je annuler mon abonnement?</Text>
            </View>
            <Text style={styles.faqAnswerText}>
              Oui, vous pouvez annuler à tout moment. Votre accès premium restera actif jusqu'à la fin de la période payée.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <View style={styles.faqHeader}>
              <Icon name="help-circle" size={20} color="#1B5E20" />
              <Text style={styles.faqQuestionText}>Comment puis-je renouveler mon abonnement?</Text>
            </View>
            <Text style={styles.faqAnswerText}>
              Le renouvellement est automatique à la fin de votre période. Vous recevrez une notification 7 jours avant.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <View style={styles.faqHeader}>
              <Icon name="help-circle" size={20} color="#1B5E20" />
              <Text style={styles.faqQuestionText}>Y a-t-il une période d'essai gratuite?</Text>
            </View>
            <Text style={styles.faqAnswerText}>
              Non, mais vous pouvez commencer avec le plan mensuel pour tester sans engagement long terme.
            </Text>
          </View>
        </View>

        {/* Bottom Info */}
        <View style={styles.bottomInfo}>
          <Icon name="information-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            Version BETA - Simulation de paiement. Aucun paiement réel ne sera effectué.
          </Text>
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
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#FFF',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  plansSection: {
    paddingHorizontal: 16,
    marginBottom: 32,
    gap: 16,
  },
  planCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 20,
    paddingVertical: 24,
    position: 'relative',
  },
  savingsBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    gap: 4,
  },
  savingsText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
  planHeader: {
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
  },
  currency: {
    fontSize: 18,
    fontWeight: '600',
  },
  period: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  pricePerMonthContainer: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  pricePerMonth: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  selectButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  featuresSection: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  planFeaturesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingLeft: 16,
    borderLeftWidth: 4,
    marginTop: 24,
  },
  planFeatureName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  featureItem: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderLeftWidth: 3,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  faqSection: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  faqItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  faqAnswerText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginLeft: 32,
  },
  bottomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },
});
