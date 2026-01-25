import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adsApi, categoriesApi, AdWithDetails, Category, messagingApi } from '@/utils/api';


export default function SearchScreen() {
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState(params.query?.toString() || '');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    params.category ? parseInt(params.category.toString()) : null
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchResults, setSearchResults] = useState<AdWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Charger les catégories
  useEffect(() => {
    loadCategories();
  }, []);

  // Effectuer une recherche automatique si des paramètres sont fournis
  useEffect(() => {
    if (params.query || params.category) {
      performSearch();
    }
  }, [params]);

  const loadCategories = async () => {
    try {
      const response = await categoriesApi.getCategories();
      if (response.success) {
        setCategories(response.categories);
      }
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    }
  };

  const performSearch = async () => {
    if (!searchQuery.trim() && !selectedCategory) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setSearchPerformed(true);
    
    try {
      // Utiliser la fonction de recherche qui existe dans messagingApi.adsApi.searchAds
      const response = await messagingApi.adsApi.searchAds({
        query: searchQuery || undefined,
        categoryId: selectedCategory?.toString(),
      });

      if (response.success) {
        setSearchResults(response.ads || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Erreur recherche:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    performSearch();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSearchResults([]);
    setSearchPerformed(false);
  };

  const formatPrice = (price: number) => {
    if (!price || price === 0) return 'Gratuit';
    return price.toLocaleString('fr-FR') + ' Ar';
  };

  const renderAdCard = ({ item }: { item: AdWithDetails }) => (
    <TouchableOpacity 
      style={styles.adCard}
      onPress={() => router.push(`/ad/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.adImageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.adImage} resizeMode="cover" />
        ) : (
          <View style={styles.adImagePlaceholder}>
            <Ionicons name="image-outline" size={32} color="#999" />
          </View>
        )}
      </View>
      <View style={styles.adInfo}>
        <Text style={styles.adTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.adPrice}>{formatPrice(item.price)}</Text>
        <View style={styles.adLocation}>
          <Ionicons name="location-outline" size={12} color="#666" />
          <Text style={styles.adLocationText}>{item.city || 'Localisation non spécifiée'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête avec barre de recherche */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Que cherchez-vous ?"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus={!params.query}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons name="search" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Filtres - Catégories */}
      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Catégories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          <TouchableOpacity 
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
              Toutes
            </Text>
          </TouchableOpacity>
          
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
            >
              <Text style={[
                styles.categoryChipText,
                selectedCategory === category.id && styles.categoryChipTextActive
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Résultats de recherche */}
      <View style={styles.resultsContainer}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {searchPerformed 
              ? `Résultats (${searchResults.length})`
              : 'Recherchez une annonce'
            }
          </Text>
          
          {searchPerformed && (
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.clearButton}>Effacer filtres</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1B5E20" />
            <Text style={styles.loadingText}>Recherche en cours...</Text>
          </View>
        ) : searchPerformed && searchResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>Aucun résultat trouvé</Text>
            <Text style={styles.emptySubtext}>
              Essayez avec d'autres mots-clés ou catégories
            </Text>
          </View>
        ) : !searchPerformed ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>Recherchez des annonces</Text>
            <Text style={styles.emptySubtext}>
              Tapez ce que vous cherchez ou choisissez une catégorie
            </Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            renderItem={renderAdCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultsList}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
          />
        )}
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
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
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
  searchButton: {
    backgroundColor: '#1B5E20',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  categoriesScroll: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryChipActive: {
    backgroundColor: '#1B5E20',
    borderColor: '#1B5E20',
  },
  categoryChipText: {
    color: '#666',
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  clearButton: {
    color: '#1B5E20',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
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
  resultsList: {
    padding: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  adCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 1,
  },
  adImageContainer: {
    width: '100%',
    height: 120,
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
  adInfo: {
    padding: 8,
  },
  adTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    height: 36,
  },
  adPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 4,
  },
  adLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adLocationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});