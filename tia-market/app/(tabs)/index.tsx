import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { homeApi, categoriesApi, AdWithDetails, Category } from '@/utils/api';

// Icônes par défaut pour les catégories (fallback uniquement)
const DEFAULT_CATEGORY_ICONS: Record<string, string> = {
  'Véhicules': 'car-outline',
  'Immobilier': 'home-outline',
  'Mode': 'shirt-outline',
  'Multimédia': 'tv-outline',
  'Maison': 'bed-outline',
  'Loisirs': 'game-controller-outline',
  'Services': 'briefcase-outline',
  'Animaux': 'paw-outline',
  'Emploi': 'briefcase-outline',
  'Autres': 'grid-outline',
};

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  'Véhicules': '#FF6B35',
  'Immobilier': '#1A936F',
  'Mode': '#FFD166',
  'Multimédia': '#118AB2',
  'Maison': '#06D6A0',
  'Loisirs': '#EF476F',
  'Services': '#073B4C',
  'Animaux': '#8338EC',
  'Emploi': '#3A86FF',
  'Autres': '#8AC926',
};

export default function HomeScreen() {
  const [recentAds, setRecentAds] = useState<AdWithDetails[]>([]);
  const [popularAds, setPopularAds] = useState<AdWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Charger les catégories depuis l'API
      const categoriesResponse = await categoriesApi.getCategories();
      
      if (categoriesResponse.success && categoriesResponse.categories.length > 0) {
        // Prendre seulement les catégories principales (sans parent_id)
        const mainCategories = categoriesResponse.categories
          .filter(cat => !cat.parent_id)
          .slice(0, 8) // Limiter à 8 catégories
          .map(cat => ({
            ...cat,
            icon: cat.icon || DEFAULT_CATEGORY_ICONS[cat.name] || 'grid-outline',
            color: cat.color || DEFAULT_CATEGORY_COLORS[cat.name] || '#1B5E20',
          }));
        
        setCategories(mainCategories);
      } else {
        // Si pas de catégories ou erreur
        console.log('Aucune catégorie trouvée ou erreur API');
        setCategories([]);
      }

      // Charger les annonces récentes depuis l'API
      const recentResponse = await homeApi.getRecentAds(10);
      
      if (recentResponse.success && recentResponse.ads.length > 0) {
        // Transformer les données pour correspondre au format attendu
        const transformedRecentAds = recentResponse.ads.map(ad => ({
          ...ad,
          // S'assurer que les champs nécessaires existent
          imageUrl: ad.primary_image || ad.imageUrl,
          category: ad.category || {
            name: ad.category_name || 'Non catégorisé',
            slug: ad.category_slug || 'non-categorise',
            icon: ad.category_icon,
            color: ad.category_color,
          },
          // Alias pour la compatibilité
          userId: ad.user_id,
          categoryId: ad.category_id,
          priceNegotiable: ad.price_negotiable,
          isActive: ad.is_active,
          isSold: ad.is_sold,
          isFeatured: ad.is_featured,
          viewCount: ad.view_count,
          createdAt: ad.created_at,
          updatedAt: ad.updated_at,
        }));
        
        setRecentAds(transformedRecentAds);
      } else {
        console.log('Aucune annonce récente trouvée');
        setRecentAds([]);
      }

      // Charger les annonces populaires depuis l'API
      const popularResponse = await homeApi.getPopularAds(6);
      
      if (popularResponse.success && popularResponse.ads.length > 0) {
        const transformedPopularAds = popularResponse.ads.map(ad => ({
          ...ad,
          imageUrl: ad.primary_image || ad.imageUrl,
          category: ad.category || {
            name: ad.category_name || 'Non catégorisé',
            slug: ad.category_slug || 'non-categorise',
            icon: ad.category_icon,
            color: ad.category_color,
          },
          // Alias pour la compatibilité
          userId: ad.user_id,
          categoryId: ad.category_id,
          priceNegotiable: ad.price_negotiable,
          isActive: ad.is_active,
          isSold: ad.is_sold,
          isFeatured: ad.is_featured,
          viewCount: ad.view_count,
          createdAt: ad.created_at,
          updatedAt: ad.updated_at,
        }));
        
        setPopularAds(transformedPopularAds);
      } else {
        console.log('Aucune annonce populaire trouvée');
        setPopularAds([]);
      }

    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger les données. Vérifiez votre connexion internet.',
        [{ text: 'OK', onPress: () => {} }]
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatPrice = (price: number) => {
    if (!price || price === 0) return 'Gratuit';
    return price.toLocaleString('fr-FR') + ' Ar';
  };

  const getAdImage = (ad: AdWithDetails) => {
    return ad.imageUrl || ad.primary_image;
  };

  const renderAdCard = ({ item }: { item: AdWithDetails }) => {
    const imageUrl = getAdImage(item);

    console.log('📱 Affichage annonce:', {
      id: item.id,
      title: item.title,
      hasImageUrl: !!item.imageUrl,
      hasPrimaryImage: !!item.primary_image,
      imageUrl: imageUrl,
    });
    
    
    return (
      <TouchableOpacity 
        style={styles.adCard}
        onPress={() => router.push(`/ad/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.adImageContainer}>
          {imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.adImage}
              resizeMode="cover"
              onError={(e) => {
                console.error('❌ Erreur chargement image:', e.nativeEvent.error);
                console.log('URL problème:', imageUrl);
              }}
              onLoad={() => {
                console.log('✅ Image chargée:', imageUrl);
              }}
            />
          ) : (
            <View style={styles.adImagePlaceholder}>
              <Ionicons name="image-outline" size={32} color="#999" />
            </View>
          )}
          {item.is_featured && (
            <View style={styles.featuredBadge}>
              <Ionicons name="star" size={12} color="#FFF" />
              <Text style={styles.featuredText}>À la une</Text>
            </View>
          )}
        </View>
        <View style={styles.adInfo}>
          <Text style={styles.adTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.adPrice}>
            {formatPrice(item.price)}
            {item.price_negotiable && (
              <Text style={styles.negotiableText}> • Négociable</Text>
            )}
          </Text>
          <View style={styles.adLocation}>
            <Ionicons name="location-outline" size={12} color="#666" />
            <Text style={styles.adLocationText}>{item.city || 'Localisation non spécifiée'}</Text>
          </View>
          <View style={styles.adMeta}>
            <Text style={styles.adDate}>
              {item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : 'Date inconnue'}
            </Text>
            {item.view_count > 0 && (
              <Text style={styles.adViews}>
                {item.view_count} vue{item.view_count > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategoryCard = ({ item }: { item: Category }) => (
    <TouchableOpacity 
      style={styles.categoryCard}
      onPress={() => router.push(`/search?category=${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.categoryIcon, { backgroundColor: item.color + '20' }]}>
        <Ionicons 
          name={item.icon as any} 
          size={24} 
          color={item.color} 
        />
      </View>
      <Text style={styles.categoryText} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderRecentAdCard = (ad: AdWithDetails) => {
    const imageUrl = getAdImage(ad);
    
    return (
      <TouchableOpacity 
        key={ad.id}
        style={styles.recentAdCard}
        onPress={() => router.push(`/ad/${ad.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.recentAdImageContainer}>
          {imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.recentAdImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.recentAdImagePlaceholder}>
              <Ionicons name="image-outline" size={20} color="#999" />
            </View>
          )}
        </View>
        <View style={styles.recentAdInfo}>
          <Text style={styles.recentAdTitle} numberOfLines={1}>
            {ad.title}
          </Text>
          <Text style={styles.recentAdPrice}>
            {formatPrice(ad.price)}
          </Text>
          <View style={styles.recentAdLocation}>
            <Ionicons name="location-outline" size={10} color="#666" />
            <Text style={styles.recentAdLocationText} numberOfLines={1}>
              {ad.city || 'N/A'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1B5E20" />
          <Text style={styles.loadingText}>Chargement en cours...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête avec recherche */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.searchContainer}
          onPress={() => router.push('/search')}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder}>Rechercher une annonce...</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => router.push('/search?showFilters=true')}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#1B5E20']}
            tintColor="#1B5E20"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Section de bienvenue */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Bienvenue sur TIA Market 👋</Text>
          <Text style={styles.subtitle}>Votre marketplace locale à Madagascar</Text>
        </View>

        {/* Catégories - seulement si disponibles */}
        {categories.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Catégories</Text>
              <TouchableOpacity onPress={() => router.push('/search')}>
                <Text style={styles.seeAllText}>Tout voir</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={categories}
              renderItem={renderCategoryCard}
              keyExtractor={(item) => item.id.toString()}
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesList}
              contentContainerStyle={styles.categoriesListContent}
            />
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>Aucune catégorie disponible</Text>
          </View>
        )}

        {/* Annonces à la une - seulement si disponibles */}
        {popularAds.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>À la une</Text>
              <TouchableOpacity onPress={() => router.push('/ads?sort=popular')}>
                <Text style={styles.seeAllText}>Tout voir</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={popularAds}
              renderItem={renderAdCard}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              style={styles.adsList}
              contentContainerStyle={styles.adsListContent}
            />
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>Aucune annonce populaire pour le moment</Text>
          </View>
        )}

        {/* Annonces récentes - seulement si disponibles */}
        {recentAds.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nouvelles annonces</Text>
              <TouchableOpacity onPress={() => router.push('/ads?sort=newest')}>
                <Text style={styles.seeAllText}>Tout voir</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.recentAdsGrid}>
              {recentAds.slice(0, 6).map(renderRecentAdCard)}
            </View>
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>Aucune nouvelle annonce</Text>
          </View>
        )}

        {/* Bouton CTA pour publier */}
        <TouchableOpacity 
          style={styles.ctaButton}
          onPress={() => router.push('/(tabs)/post-ad')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={24} color="#FFF" />
          <Text style={styles.ctaText}>Publier une annonce gratuite</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles (à garder tels quels)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchPlaceholder: {
    color: '#666',
    fontSize: 14,
    flex: 1,
  },
  filterButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  welcomeSection: {
    padding: 16,
    backgroundColor: '#FFF',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#FFF',
    marginBottom: 8,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#1B5E20',
    fontWeight: '500',
  },
  categoriesList: {
    paddingLeft: 16,
  },
  categoriesListContent: {
    paddingRight: 16,
  },
  categoryCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
    fontWeight: '500',
    lineHeight: 14,
  },
  adsList: {
    paddingLeft: 16,
  },
  adsListContent: {
    paddingRight: 16,
  },
  adCard: {
    width: 160,
    marginRight: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  adImageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  adImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(27, 94, 32, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featuredText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  adInfo: {
    padding: 12,
  },
  adTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  adPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 4,
  },
  negotiableText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'normal',
  },
  adLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  adLocationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  adMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  adDate: {
    fontSize: 10,
    color: '#999',
  },
  adViews: {
    fontSize: 10,
    color: '#999',
  },
  recentAdsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  recentAdCard: {
    width: '31%',
    marginBottom: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  recentAdImageContainer: {
    width: '100%',
    height: 80,
  },
  recentAdImage: {
    width: '100%',
    height: '100%',
  },
  recentAdImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentAdInfo: {
    padding: 8,
  },
  recentAdTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  recentAdPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 2,
  },
  recentAdLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentAdLocationText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 2,
    flex: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B5E20',
    marginHorizontal: 16,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptySection: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 8,
    alignItems: 'center',
  },
  emptySectionText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});