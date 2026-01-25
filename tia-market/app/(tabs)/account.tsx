import { AuthContext } from '@/context/AuthContext';
import { router } from 'expo-router';
import React, { useContext } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function AccountScreen() {
  const { userInfo, logout } = useContext(AuthContext);
  const isPremium = userInfo?.isPremium || false;

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const formatExpiryDate = (date: string | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    const daysLeft = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 ? `${daysLeft} jours` : 'Expiré';
  };

  if (isPremium) {
    // Interface Premium Stylisée
    return (
      <SafeAreaView style={[styles.container, styles.premiumContainer]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Premium Header avec Gradient Effect */}
          <View style={styles.premiumHeader}>
            <View style={styles.premiumBadgeContainer}>
              <Icon name="crown" size={40} color="#FFD700" />
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
            <Text style={styles.premiumUserName}>{userInfo?.firstName || 'Utilisateur'}</Text>
            <Text style={styles.premiumUserEmail}>{userInfo?.email}</Text>
            <Text style={styles.expiryText}>Expire dans {formatExpiryDate(userInfo?.endPremium)}</Text>
          </View>

          {/* Premium Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Icon name="tag-multiple" size={28} color="#1B5E20" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Annonces</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="eye" size={28} color="#118AB2" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Vues</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="message" size={28} color="#FF6B35" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Messages</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="star" size={28} color="#FFD700" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>À la une</Text>
            </View>
          </View>

          {/* Premium Features Section */}
          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>Mes Avantages Premium</Text>
            <TouchableOpacity 
              style={styles.premiumOption}
              onPress={() => router.push('/premium-features')}
            >
              <View style={styles.premiumOptionIcon}>
                <Icon name="briefcase" size={24} color="#FF6B35" />
              </View>
              <View style={styles.premiumOptionContent}>
                <Text style={styles.premiumOptionTitle}>Créer une offre professionelle</Text>
                <Text style={styles.premiumOptionDesc}>Accédez au mode professionnel</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.premiumOption}
              onPress={() => router.push('/premium-features')}
            >
              <View style={styles.premiumOptionIcon}>
                <Icon name="calendar-check" size={24} color="#1A936F" />
              </View>
              <View style={styles.premiumOptionContent}>
                <Text style={styles.premiumOptionTitle}>Gérer les réservations</Text>
                <Text style={styles.premiumOptionDesc}>Restaurant, hôtel, services</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.premiumOption}
              onPress={() => router.push('/premium-features')}
            >
              <View style={styles.premiumOptionIcon}>
                <Icon name="star" size={24} color="#FFD166" />
              </View>
              <View style={styles.premiumOptionContent}>
                <Text style={styles.premiumOptionTitle}>Mettre à la une</Text>
                <Text style={styles.premiumOptionDesc}>Augmentez la visibilité</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Menu Premium */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>Paramètres</Text>
            
            <TouchableOpacity style={styles.menuItem}>
              <Icon name="bell" size={24} color="#1B5E20" />
              <Text style={styles.menuText}>Mes alertes</Text>
              <Icon name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/my-ads')}
            >
              <Icon name="tag-multiple" size={24} color="#1B5E20" />
              <Text style={styles.menuText}>Mes annonces</Text>
              <Icon name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/my-profile')}
            >
              <Icon name="account-circle" size={24} color="#1B5E20" />
              <Text style={styles.menuText}>Mon profil</Text>
              <Icon name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/my-bookings')}
            >
              <Icon name="calendar-check" size={24} color="#1B5E20" />
              <Text style={styles.menuText}>Mes réservations</Text>
              <Icon name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <Icon name="heart" size={24} color="#1B5E20" />
              <Text style={styles.menuText}>Mes favoris</Text>
              <Icon name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <Icon name="message-text" size={24} color="#1B5E20" />
              <Text style={styles.menuText}>Mes messages</Text>
              <Icon name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <Icon name="cog" size={24} color="#1B5E20" />
              <Text style={styles.menuText}>Paramètres</Text>
              <Icon name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <Icon name="help-circle" size={24} color="#1B5E20" />
              <Text style={styles.menuText}>Aide</Text>
              <Icon name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Icon name="logout" size={24} color="#FFF" />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>

          <Text style={styles.version}>Version 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Interface Standard pour les non-premium
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Icon name="account-circle" size={80} color="#1B5E20" />
          </View>
          <Text style={styles.userName}>
            {userInfo?.firstName || 'Utilisateur'}
          </Text>
          <Text style={styles.userEmail}>{userInfo?.email}</Text>
        </View>

        {/* Upgrade Banner pour non-premium */}
        <TouchableOpacity 
          style={styles.upgradeBanner}
          onPress={() => router.push('/premium-access')}
        >
          <View style={styles.upgradeBadge}>
            <Icon name="star" size={24} color="#FF6B35" />
            <View style={styles.upgradeInfo}>
              <Text style={styles.upgradeTitle}>Passez Premium</Text>
              <Text style={styles.upgradeSubtitle}>
                Déverrouillez les avantages
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={20} color="#FF6B35" />
        </TouchableOpacity>

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem}>
            <Icon name="bell-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Mes alertes</Text>
            <Icon name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/my-ads')}
          >
            <Icon name="tag-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Mes annonces</Text>
            <Icon name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/my-profile')}
          >
            <Icon name="account-circle-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Mon profil</Text>
            <Icon name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/my-bookings')}
          >
            <Icon name="calendar-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Mes réservations</Text>
            <Icon name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Icon name="heart-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Mes favoris</Text>
            <Icon name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Icon name="message-text-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Mes messages</Text>
            <Icon name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Icon name="cog-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Paramètres</Text>
            <Icon name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Icon name="help-circle-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Aide</Text>
            <Icon name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={24} color="#1B5E20" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  premiumContainer: {
    backgroundColor: '#F8F8FF',
  },
  header: {
    backgroundColor: '#FFF',
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 16,
  },
  avatar: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF3CD',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    padding: 16,
  },
  upgradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  upgradeInfo: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
    marginBottom: 4,
  },
  upgradeSubtitle: {
    fontSize: 13,
    color: '#666',
  },

  // Premium Styles
  premiumHeader: {
    backgroundColor: '#1B5E20',
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  premiumBadgeContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
    marginTop: 4,
  },
  premiumUserName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  premiumUserEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 12,
  },
  expiryText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },

  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Features Section
  featuresSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  premiumOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  premiumOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  premiumOptionContent: {
    flex: 1,
  },
  premiumOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  premiumOptionDesc: {
    fontSize: 12,
    color: '#666',
  },

  // Menu Section
  menuSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  menu: {
    backgroundColor: '#FFF',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B5E20',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    marginLeft: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginVertical: 20,
  },
});
