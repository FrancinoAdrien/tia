import { AuthContext } from '@/context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { adsApi } from '@/utils/api';

interface Ad {
  id: string;
  title: string;
  price: number;
  imageUrl?: string;
  city: string;
  viewCount: number;
  isActive: boolean;
  isFeatured: boolean;
  isSold: boolean;
  user?: {
    isPremium?: boolean;
  };
  createdAt: string;
}

export default function MyAdsScreen() {
  const { userInfo } = useContext(AuthContext);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMyAds = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adsApi.getUserAds();
      if (response.success && response.ads) {
        setAds(response.ads);
      } else {
        console.error('Erreur:', response.error);
      }
    } catch (error) {
      console.error('❌ Erreur chargement annonces:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyAds();
    }, [loadMyAds])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadMyAds();
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'DZD',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Aujourd\'hui';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Hier';
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const renderAdCard = ({ item }: { item: Ad }) => (
    <TouchableOpacity
      style={[
        styles.adCard,
        item.user?.isPremium && styles.premiumAdCard,
        item.isSold && styles.soldAdCard,
      ]}
      onPress={() => router.push(`/ad/${item.id}`)}
      activeOpacity={0.7}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.adImage}
            defaultSource={require('@/assets/images/icon.png')}
          />
        ) : (
          <View style={[styles.adImage, styles.placeholderImage]}>
            <Icon name="image-off" size={40} color="#CCC" />
          </View>
        )}

        {/* Badges */}
        {item.user?.isPremium && (
          <View style={styles.premiumBadge}>
            <Icon name="crown" size={16} color="#FFD700" />
            <Text style={styles.badgeText}>Premium</Text>
          </View>
        )}

        {item.isFeatured && (
          <View style={[styles.badge, styles.featuredBadge]}>
            <Icon name="star" size={16} color="#FFF" />
            <Text style={styles.badgeText}>À la une</Text>
          </View>
        )}

        {item.isSold && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldText}>VENDU</Text>
          </View>
        )}

        {!item.isActive && (
          <View style={styles.inactiveOverlay}>
            <Text style={styles.inactiveText}>INACTIF</Text>
          </View>
        )}
      </View>

      {/* Contenu */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.priceLocation}>
          <Text style={styles.price}>{formatPrice(item.price)}</Text>
          <Text style={styles.location}>{item.city}</Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Icon name="eye" size={16} color="#666" />
            <Text style={styles.statText}>{item.viewCount} vues</Text>
          </View>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>

      {/* Status Indicator */}
      <View style={styles.statusIndicator}>
        {item.isSold ? (
          <View style={[styles.statusBadge, styles.statusSold]}>
            <Icon name="check-circle" size={14} color="#FFF" />
          </View>
        ) : !item.isActive ? (
          <View style={[styles.statusBadge, styles.statusInactive]}>
            <Icon name="pause-circle" size={14} color="#FFF" />
          </View>
        ) : (
          <View style={[styles.statusBadge, styles.statusActive]}>
            <Icon name="check-circle" size={14} color="#FFF" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1B5E20" />
          <Text style={styles.loadingText}>Chargement de vos annonces...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes annonces</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(tabs)/post-ad')}
        >
          <Icon name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {ads.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="package-variant" size={64} color="#DDD" />
          <Text style={styles.emptyTitle}>Aucune annonce</Text>
          <Text style={styles.emptyDesc}>
            Vous n'avez pas encore créé d'annonce
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/post-ad')}
          >
            <Icon name="plus" size={20} color="#FFF" />
            <Text style={styles.emptyButtonText}>Créer une annonce</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Stats Premium */}
          {userInfo?.isPremium && (
            <View style={styles.premiumStatsContainer}>
              <View style={styles.premiumStat}>
                <Text style={styles.premiumStatValue}>{ads.length}</Text>
                <Text style={styles.premiumStatLabel}>Annonces</Text>
              </View>
              <View style={styles.premiumStat}>
                <Text style={styles.premiumStatValue}>
                  {ads.reduce((sum, ad) => sum + ad.viewCount, 0)}
                </Text>
                <Text style={styles.premiumStatLabel}>Total vues</Text>
              </View>
              <View style={styles.premiumStat}>
                <Text style={styles.premiumStatValue}>
                  {ads.filter((ad) => ad.isFeatured).length}
                </Text>
                <Text style={styles.premiumStatLabel}>À la une</Text>
              </View>
            </View>
          )}

          <FlatList
            data={ads}
            renderItem={renderAdCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={true}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1B5E20',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Premium Stats
  premiumStatsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
    justifyContent: 'space-around',
  },
  premiumStat: {
    alignItems: 'center',
  },
  premiumStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B5E20',
  },
  premiumStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  // Ad Cards
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  adCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  premiumAdCard: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  soldAdCard: {
    opacity: 0.6,
  },

  imageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  adImage: {
    width: 100,
    height: 100,
    backgroundColor: '#F5F5F5',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Badges
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    backgroundColor: '#1B5E20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    gap: 4,
  },
  premiumBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    gap: 4,
  },
  featuredBadge: {
    backgroundColor: '#FF6B35',
    top: 8,
    left: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // Overlay
  soldOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  inactiveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(100, 100, 100, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  priceLocation: {
    marginBottom: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 2,
  },
  location: {
    fontSize: 12,
    color: '#666',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: '#666',
  },
  date: {
    fontSize: 11,
    color: '#999',
  },

  // Status Indicator
  statusIndicator: {
    paddingRight: 12,
    justifyContent: 'center',
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusActive: {
    backgroundColor: '#4CAF50',
  },
  statusInactive: {
    backgroundColor: '#FF9800',
  },
  statusSold: {
    backgroundColor: '#9C27B0',
  },

  // Empty State
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    backgroundColor: '#1B5E20',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
});
