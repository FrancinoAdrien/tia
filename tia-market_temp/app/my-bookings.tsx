import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { bookingsApi } from '@/utils/api';
import { AuthContext } from '@/context/AuthContext';

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return 'En attente';
    case 'accepted': return 'Acceptée';
    case 'rejected': return 'Refusée';
    case 'delivered': return 'Livrée - Confirmer réception';
    case 'delivery_confirmed': return 'Réception confirmée - Payer';
    case 'paid': return 'Payée';
    case 'completed': return 'Terminée';
    case 'cancelled': return 'Annulée';
    default: return status;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return '#FF9500';
    case 'accepted': return '#34C759';
    case 'rejected': return '#FF3B30';
    case 'delivered': return '#007AFF';
    case 'delivery_confirmed': return '#5856D6';
    case 'paid': return '#1B5E20';
    case 'completed': return '#1B5E20';
    case 'cancelled': return '#999';
    default: return '#666';
  }
};

const getSafeImageUrl = (imagePath: string | undefined | null): string => {
  if (!imagePath) {
    return 'https://placehold.co/600x400/1B5E20/FFF?text=TIA+Market&font=roboto';
  }
  
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.88.29:3001';
  
  if (imagePath.startsWith('/')) {
    return `${API_BASE_URL}${imagePath}`;
  }
  
  return `${API_BASE_URL}/uploads/${imagePath}`;
};

export default function MyBookingsScreen() {
  const { userInfo } = useContext(AuthContext);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'completed'>('all');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      // Charger les réservations en tant qu'acheteur
      const buyerResponse = await bookingsApi.getBuyerBookings();
      
      // Charger les réservations en tant que vendeur
      const sellerResponse = await bookingsApi.getSellerBookings();
      
      const allBookings: any[] = [];
      
      if (buyerResponse.success && buyerResponse.bookings) {
        buyerResponse.bookings.forEach((b: any) => {
          allBookings.push({ ...b, type: 'buyer' });
        });
      }
      
      if (sellerResponse.success && sellerResponse.bookings) {
        sellerResponse.bookings.forEach((b: any) => {
          allBookings.push({ ...b, type: 'seller' });
        });
      }
      
      // Trier par date de création (plus récentes en premier)
      allBookings.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at).getTime();
        const dateB = new Date(b.createdAt || b.created_at).getTime();
        return dateB - dateA;
      });
      
      setBookings(allBookings);
    } catch (error) {
      console.error('❌ Erreur chargement réservations:', error);
      Alert.alert('Erreur', 'Impossible de charger les réservations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true;
    if (filter === 'pending') return booking.status === 'pending';
    if (filter === 'accepted') return booking.status === 'accepted' || booking.status === 'delivered' || booking.status === 'delivery_confirmed';
    if (filter === 'rejected') return booking.status === 'rejected';
    if (filter === 'completed') return booking.status === 'completed' || booking.status === 'paid';
    return true;
  });

  const handleBookingPress = (booking: any) => {
    if (booking.ad?.id) {
      router.push(`/ad/${booking.ad.id}`);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date inconnue';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    if (!price || price === 0) return 'Gratuit';
    return price.toLocaleString('fr-FR') + ' Ar';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1B5E20" />
          <Text style={styles.loadingText}>Chargement des réservations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes réservations</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Filtres */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {['all', 'pending', 'accepted', 'rejected', 'completed'].map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles.filterButton,
              filter === filterOption && styles.filterButtonActive
            ]}
            onPress={() => setFilter(filterOption as any)}
          >
            <Text style={[
              styles.filterText,
              filter === filterOption && styles.filterTextActive
            ]}>
              {filterOption === 'all' ? 'Toutes' : 
               filterOption === 'pending' ? 'En attente' :
               filterOption === 'accepted' ? 'Acceptées' :
               filterOption === 'rejected' ? 'Refusées' :
               'Terminées'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>Aucune réservation</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all' 
                ? 'Vous n\'avez pas encore de réservations'
                : `Aucune réservation ${filter === 'pending' ? 'en attente' : filter === 'accepted' ? 'acceptée' : filter === 'rejected' ? 'refusée' : 'terminée'}`}
            </Text>
          </View>
        ) : (
          filteredBookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.bookingCard}
              onPress={() => handleBookingPress(booking)}
              activeOpacity={0.7}
            >
              <View style={styles.bookingHeader}>
                <View style={styles.bookingImageContainer}>
                  {booking.ad?.imageUrl ? (
                    <Image
                      source={{ uri: getSafeImageUrl(booking.ad.imageUrl) }}
                      style={styles.bookingImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.bookingImagePlaceholder}>
                      <Ionicons name="image-outline" size={24} color="#999" />
                    </View>
                  )}
                </View>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingTitle} numberOfLines={2}>
                    {booking.ad?.title || 'Annonce'}
                  </Text>
                  <Text style={styles.bookingPrice}>
                    {formatPrice(booking.ad?.price || 0)}
                  </Text>
                  <View style={styles.bookingMeta}>
                    <Ionicons name="time-outline" size={12} color="#666" />
                    <Text style={styles.bookingDate}>
                      {formatDate(booking.createdAt || booking.created_at)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.bookingFooter}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
                </View>
                <View style={styles.bookingType}>
                  <Ionicons 
                    name={booking.type === 'buyer' ? 'cart-outline' : 'storefront-outline'} 
                    size={16} 
                    color="#666" 
                  />
                  <Text style={styles.bookingTypeText}>
                    {booking.type === 'buyer' ? 'Achat' : 'Vente'}
                  </Text>
                </View>
              </View>

              {booking.message && (
                <View style={styles.messageContainer}>
                  <Text style={styles.messageText} numberOfLines={2}>
                    "{booking.message}"
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  filtersContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#1B5E20',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  bookingCard: {
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
  bookingHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bookingImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  bookingImage: {
    width: '100%',
    height: '100%',
  },
  bookingImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingInfo: {
    flex: 1,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bookingPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 4,
  },
  bookingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingDate: {
    fontSize: 12,
    color: '#666',
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingTypeText: {
    fontSize: 12,
    color: '#666',
  },
  messageContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  messageText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
});
