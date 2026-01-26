import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { favoritesApi, AdWithDetails } from '@/utils/api';
import { AuthContext } from '@/context/AuthContext';

export default function FavoritesScreen() {
  const { userToken } = useContext(AuthContext);
  const [favorites, setFavorites] = useState<AdWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (userToken) {
      loadFavorites();
    } else {
      setLoading(false);
    }
  }, [userToken]);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const response = await favoritesApi.getFavorites();
      
      if (response.success && response.favorites) {
        setFavorites(response.favorites);
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.error('Erreur chargement favoris:', error);
      Alert.alert('Erreur', 'Impossible de charger vos favoris');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFavorites();
    setRefreshing(false);
  };

  const handleRemoveFavorite = async (adId: string) => {
    try {
      const response = await favoritesApi.toggleFavorite(adId);
      
      if (response.success) {
        // Retirer de la liste locale
        setFavorites(favorites.filter(fav => fav.id !== adId));
      }
    } catch (error) {
      console.error('Erreur retrait favori:', error);
      Alert.alert('Erreur', 'Impossible de retirer ce favori');
    }
  };

  const formatPrice = (price: number) => {
    if (!price || price === 0) return 'Gratuit';
    return price.toLocaleString('fr-FR') + ' Ar';
  };

  const renderFavoriteCard = ({ item }: { item: AdWithDetails }) => (
    <TouchableOpacity 
      style={styles.favoriteCard}
      onPress={() => router.push(`/ad/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.favoriteImageContainer}>
        {item.imageUrl ? (
          <Image 
            source={{ uri: item.imageUrl }} 
            style={styles.favoriteImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.favoriteImagePlaceholder}>
            <Ionicons name="image-outline" size={40} color="#999" />
          </View>
        )}
        {item.is_featured && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={12} color="#FFF" />
            <Text style={styles.featuredText}>À la une</Text>
          </View>
        )}
        {item.is_sold && (
          <View style={styles.soldBadge}>
            <Text style={styles.soldText}>VENDU</Text>
          </View>
        )}
      </View>
      
      <View style={styles.favoriteInfo}>
        <Text style={styles.favoriteTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.favoritePrice}>
          {formatPrice(item.price)}
          {item.price_negotiable && (
            <Text style={styles.negotiableText}> • Négociable</Text>
          )}
        </Text>
        <View style={styles.favoriteLocation}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text style={styles.favoriteLocationText}>
            {item.city || 'Localisation non spécifiée'}
          </Text>
        </View>
        <View style={styles.favoriteMeta}>
          <Text style={styles.favoriteDate}>
            Ajouté le {item.favoritedAt ? new Date(item.favoritedAt).toLocaleDateString('fr-FR') : 'N/A'}
          </Text>
          <TouchableOpacity
            style={styles.removeFavoriteButton}
            onPress={() => {
              Alert.alert(
                'Retirer des favoris',
                'Voulez-vous retirer cette annonce de vos favoris?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { 
                    text: 'Retirer', 
                    style: 'destructive',
                    onPress: () => handleRemoveFavorite(item.id) 
                  }
                ]
              );
            }}
          >
            <Ionicons name="heart" size={24} color="#FF6B35" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (!userToken) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed-outline" size={80} color="#CCC" />
          <Text style={styles.emptyText}>Connectez-vous</Text>
          <Text style={styles.emptySubtext}>
            Vous devez être connecté pour voir vos favoris
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1B5E20" />
          <Text style={styles.loadingText}>Chargement de vos favoris...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Favoris</Text>
        <Text style={styles.headerSubtitle}>
          {favorites.length} annonce{favorites.length > 1 ? 's' : ''}
        </Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={80} color="#CCC" />
          <Text style={styles.emptyText}>Aucun favori</Text>
          <Text style={styles.emptySubtext}>
            Les annonces que vous ajoutez en favoris apparaîtront ici
          </Text>
          <TouchableOpacity 
            style={styles.exploreButton}
            onPress={() => router.push('/(tabs)/')}
          >
            <Text style={styles.exploreButtonText}>Explorer les annonces</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderFavoriteCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#1B5E20']}
              tintColor="#1B5E20"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  favoriteCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  favoriteImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  favoriteImage: {
    width: '100%',
    height: '100%',
  },
  favoriteImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(27, 94, 32, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  featuredText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  soldBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  favoriteInfo: {
    padding: 16,
  },
  favoriteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  favoritePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 8,
  },
  negotiableText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'normal',
  },
  favoriteLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  favoriteLocationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  favoriteMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  favoriteDate: {
    fontSize: 12,
    color: '#999',
  },
  removeFavoriteButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  exploreButton: {
    marginTop: 24,
    backgroundColor: '#1B5E20',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: '#1B5E20',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});