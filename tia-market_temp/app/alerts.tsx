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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { bookingsApi } from '@/utils/api';

interface Booking {
  id: string;
  ad: {
    id: string;
    title: string;
    price: number;
    imageUrl?: string;
  };
  buyer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'paid' | 'completed' | 'cancelled';
  message: string;
  createdAt: string;
}

export default function AlertsScreen() {
  const { userInfo } = useContext(AuthContext);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await bookingsApi.getSellerBookings();
      if (response.success && response.bookings) {
        setBookings(response.bookings);
      } else {
        console.error('Erreur:', response.error);
      }
    } catch (error) {
      console.error('❌ Erreur chargement réservations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadBookings();
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

  const handleAccept = async (booking: Booking) => {
    Alert.alert(
      'Accepter la réservation?',
      `Confirmez-vous l'acceptation de la réservation de ${booking.buyer.firstName} ${booking.buyer.lastName}?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          style: 'default',
          onPress: async () => {
            try {
              const response = await bookingsApi.acceptBooking(booking.id);
              if (response.success) {
                Alert.alert('✅ Réservation acceptée', 'L\'acheteur a été notifié');
                loadBookings();
              } else {
                Alert.alert('❌ Erreur', response.error || 'Erreur lors de l\'acceptation');
              }
            } catch (error) {
              Alert.alert('❌ Erreur', 'Erreur lors de l\'acceptation');
            }
          },
        },
      ]
    );
  };

  const handleReject = async (booking: Booking) => {
    Alert.alert(
      'Refuser la réservation?',
      `Êtes-vous sûr de vouloir refuser la réservation de ${booking.buyer.firstName}?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await bookingsApi.rejectBooking(booking.id);
              if (response.success) {
                Alert.alert('✅ Réservation refusée', 'L\'acheteur a été notifié');
                loadBookings();
              } else {
                Alert.alert('❌ Erreur', response.error || 'Erreur lors du refus');
              }
            } catch (error) {
              Alert.alert('❌ Erreur', 'Erreur lors du refus');
            }
          },
        },
      ]
    );
  };

  const handleMessage = (booking: Booking) => {
    router.push({
      pathname: '/(tabs)/messages',
      params: {
        userId: booking.buyer.id,
        userName: booking.buyer.firstName,
        adId: booking.ad.id,
      },
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'clock-outline';
      case 'accepted':
        return 'check-circle';
      case 'rejected':
        return 'close-circle';
      case 'paid':
        return 'credit-card-check';
      case 'completed':
        return 'checkbox-marked-circle';
      default:
        return 'help-circle';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9800';
      case 'accepted':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      case 'paid':
        return '#2196F3';
      case 'completed':
        return '#8BC34A';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'accepted':
        return 'Acceptée';
      case 'rejected':
        return 'Refusée';
      case 'paid':
        return 'Payée';
      case 'completed':
        return 'Complétée';
      default:
        return status;
    }
  };

  const renderBookingCard = ({ item }: { item: Booking }) => (
    <View style={styles.bookingCard}>
      {/* Image et Info annonce */}
      <View style={styles.adSection}>
        <View style={styles.imageContainer}>
          {item.ad.imageUrl ? (
            <Image
              source={{ uri: item.ad.imageUrl }}
              style={styles.adImage}
            />
          ) : (
            <View style={[styles.adImage, styles.placeholderImage]}>
              <Icon name="image-off" size={40} color="#CCC" />
            </View>
          )}
        </View>

        <View style={styles.adInfo}>
          <Text style={styles.adTitle} numberOfLines={2}>
            {item.ad.title}
          </Text>
          <Text style={styles.adPrice}>{formatPrice(item.ad.price)}</Text>
          <Text style={styles.adDate}>{formatDate(item.createdAt)}</Text>
        </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Icon name={getStatusIcon(item.status)} size={16} color="#FFF" />
          <Text style={styles.statusLabel}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      {/* Info acheteur */}
      <View style={styles.buyerSection}>
        <Icon name="account-circle" size={40} color="#1B5E20" />
        <View style={styles.buyerInfo}>
          <Text style={styles.buyerName}>
            {item.buyer.firstName} {item.buyer.lastName}
          </Text>
          <Text style={styles.buyerEmail}>{item.buyer.email}</Text>
          {item.message && <Text style={styles.buyerMessage}>"{item.message}"</Text>}
        </View>
      </View>

      {/* Actions - visibles seulement si en attente */}
      {item.status === 'pending' && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.messageButton]}
            onPress={() => handleMessage(item)}
          >
            <Icon name="message-text" size={20} color="#1B5E20" />
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAccept(item)}
          >
            <Icon name="check" size={20} color="#FFF" />
            <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Accepter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleReject(item)}
          >
            <Icon name="close" size={20} color="#FFF" />
            <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Refuser</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Actions - pour acceptée */}
      {item.status === 'accepted' && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.messageButton]}
            onPress={() => handleMessage(item)}
          >
            <Icon name="message-text" size={20} color="#1B5E20" />
            <Text style={styles.actionButtonText}>Contacter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => router.push(`/ad/${item.ad.id}`)}
          >
            <Icon name="eye" size={20} color="#1B5E20" />
            <Text style={styles.actionButtonText}>Voir l'annonce</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1B5E20" />
          <Text style={styles.loadingText}>Chargement des alertes...</Text>
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
        <Text style={styles.headerTitle}>Réservations</Text>
        <View style={styles.headerSpacer} />
      </View>

      {bookings.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="bell-off-outline" size={64} color="#DDD" />
          <Text style={styles.emptyTitle}>Aucune réservation</Text>
          <Text style={styles.emptyDesc}>
            Vous n'avez pas encore reçu de demande de réservation
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          renderItem={renderBookingCard}
          keyExtractor={(item) => item.id}
          scrollEnabled={true}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
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
  headerSpacer: {
    width: 40,
  },

  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  bookingCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  // Section annonce
  adSection: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  adImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F5F5F5',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  adInfo: {
    flex: 1,
  },
  adTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  adPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 2,
  },
  adDate: {
    fontSize: 11,
    color: '#999',
  },

  // Status Badge
  statusBadge: {
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  statusLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  // Section acheteur
  buyerSection: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  buyerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  buyerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  buyerEmail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  buyerMessage: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  messageButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  viewButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1B5E20',
  },

  // Empty state
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

  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
});
