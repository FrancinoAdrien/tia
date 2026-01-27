import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adsApi, Ad, bookingsApi, messagingApi } from '@/utils/api';
import { AuthContext } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Fonction pour formater le prix
const formatPrice = (price: number) => {
  if (!price || price === 0) return 'Gratuit';
  return price.toLocaleString('fr-FR') + ' Ar';
};

// Fonction pour formater la date
const formatDate = (dateString: string) => {
  if (!dateString) return 'Date inconnue';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

// Fonction pour traduire l'état
const getConditionText = (condition: string) => {
  switch (condition) {
    case 'new': return 'Neuf';
    case 'like_new': return 'Comme neuf';
    case 'good': return 'Bon état';
    case 'fair': return 'État correct';
    case 'poor': return 'À réparer';
    default: return 'État non spécifié';
  }
};

// Fonction pour obtenir une URL d'image sécurisée
const getSafeImageUrl = (imagePath: string | undefined | null): string => {
  if (!imagePath) {
    return 'https://placehold.co/600x400/1B5E20/FFF?text=TIA+Market&font=roboto';
  }
  
  // Si c'est déjà une URL complète
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Si c'est un chemin relatif
  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.43.213:3001';
  
  if (imagePath.startsWith('/')) {
    return `${API_BASE_URL}${imagePath}`;
  }
  
  return `${API_BASE_URL}/uploads/${imagePath}`;
};

export default function AdDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userInfo } = useContext(AuthContext);
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [similarAds, setSimilarAds] = useState<any[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [hasAcceptedBooking, setHasAcceptedBooking] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [transactionCode, setTransactionCode] = useState('');

  useEffect(() => {
    if (id) {
      loadAd();
    }
  }, [id]);

  const loadAd = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await adsApi.getAdById(id);
      
      console.log('📦 Réponse API détail:', {
        success: response.success,
        ad: response.ad ? {
          id: response.ad.id,
          title: response.ad.title,
          image_url: response.ad.image_url,
          primary_image: response.ad.primary_image,
          images: response.ad.images,
          // Montrer les 2 premiers éléments du tableau images
          images_preview: response.ad.images ? response.ad.images.slice(0, 2) : 'aucune'
        } : 'pas d\'annonce'
      });
      
      if (response.success && response.ad) {
        // Fonction pour extraire les URLs d'images depuis la réponse
        const extractImageUrls = (adData: any): string[] => {
          const urls: string[] = [];
          
          // 1. Vérifier d'abord le tableau images
          if (adData.images && Array.isArray(adData.images)) {
            adData.images.forEach((img: any) => {
              if (typeof img === 'string') {
                urls.push(getSafeImageUrl(img));
              } else if (img && img.url) {
                urls.push(getSafeImageUrl(img.url));
              } else if (img && img.image_url) {
                urls.push(getSafeImageUrl(img.image_url));
              }
            });
          }
          
          // 2. Ajouter l'image principale si elle existe et n'est pas déjà dans le tableau
          const mainImage = adData.image_url || adData.primary_image;
          if (mainImage) {
            const mainImageUrl = getSafeImageUrl(mainImage);
            if (!urls.includes(mainImageUrl)) {
              urls.unshift(mainImageUrl); // Mettre en premier
            }
          }
          
          // 3. Si toujours pas d'images, utiliser une image par défaut
          if (urls.length === 0) {
            urls.push(getSafeImageUrl(null));
          }
          
          console.log('🖼️ URLs extraites:', urls);
          return urls;
        };
        
        // Transformer les données
        const transformedAd: Ad = {
          ...response.ad,
          // Alias pour compatibilité
          priceNegotiable: response.ad.price_negotiable ?? response.ad.priceNegotiable ?? false,
          isActive: response.ad.is_active ?? response.ad.isActive ?? true,
          isSold: response.ad.is_sold ?? response.ad.isSold ?? false,
          isFeatured: response.ad.is_featured ?? response.ad.isFeatured ?? false,
          viewCount: response.ad.view_count ?? response.ad.viewCount ?? 0,
          createdAt: response.ad.created_at ?? response.ad.createdAt,
          updatedAt: response.ad.updated_at ?? response.ad.updatedAt,
          userId: response.ad.user_id ?? response.ad.userId,
          categoryId: response.ad.category_id ?? response.ad.categoryId,
          
          // CORRECTION : Utiliser extractImageUrls
          images: extractImageUrls(response.ad),
        };
        
        setAd(transformedAd);
        loadSimilarAds(transformedAd.categoryId);
        await adsApi.incrementViewCount(id);

        // Si c'est une annonce de l'utilisateur connecté, charger les réservations
        if (transformedAd.userId === userInfo?.id) {
          loadBookingsForAd(id);
        } else {
          // Vérifier si une réservation est acceptée pour bloquer les nouvelles réservations
          checkAcceptedBooking(id);
          // Charger les réservations de l'acheteur pour cette annonce
          loadBuyerBookingsForAd(id);
        }
      } else {
        Alert.alert('Erreur', response.error || 'Impossible de charger l\'annonce');
        router.back();
      }
    } catch (error) {
      console.error('❌ Erreur chargement annonce:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'annonce. Vérifiez votre connexion.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadSimilarAds = async (categoryId: number) => {
    if (!id || !categoryId) return;
    
    setLoadingSimilar(true);
    try {
      const response = { success: true, ads: [] }; // Version temporaire
      
      if (response.success) {
        setSimilarAds(response.ads || []);
      }
    } catch (error) {
      console.error('❌ Erreur chargement annonces similaires:', error);
    } finally {
      setLoadingSimilar(false);
    }
  };

  // Gérer la réservation
  const handleReservation = async () => {
    if (!ad || !userInfo?.id) {
      Alert.alert('Erreur', 'Impossible de créer la réservation');
      return;
    }

    try {
      // Créer la réservation SANS paiement
      const message = bookingMessage.trim() || 'Réservation en attente de confirmation';
      const response = await bookingsApi.createBooking(ad.id, message);
      
      if (response.success) {
        Alert.alert(
          '✅ Réservation créée',
          'Votre réservation a été envoyée au vendeur. En attente de sa confirmation.\n\nVous recevrez une notification une fois confirmée.',
          [{ text: 'OK', onPress: () => {
            setBookingModalVisible(false);
            setBookingMessage('');
            loadAd();
          }}]
        );
      } else {
        Alert.alert('Erreur', response.error || 'Impossible de créer la réservation');
      }
    } catch (error) {
      console.error('❌ Erreur réservation:', error);
      Alert.alert('Erreur', 'Une erreur s\'est produite lors de la réservation');
    }
  };

  // Charger les réservations pour une annonce (pour le vendeur)
  const loadBookingsForAd = async (adId: string) => {
    try {
      const response = await bookingsApi.getBookingsByAd(adId);
      if (response.success && response.bookings) {
        setAllBookings(response.bookings);
        // Filtrer les réservations en attente
        const pending = response.bookings.filter((b: any) => b.status === 'pending');
        setPendingBookings(pending);
        // Vérifier s'il y a une réservation acceptée
        const accepted = response.bookings.find((b: any) => b.status === 'accepted' || b.status === 'delivered' || b.status === 'paid');
        setHasAcceptedBooking(!!accepted);
      }
    } catch (error) {
      console.error('❌ Erreur chargement réservations:', error);
    }
  };

  // Vérifier si une réservation est acceptée (pour les non-propriétaires)
  const checkAcceptedBooking = async (adId: string) => {
    try {
      const response = await bookingsApi.getBuyerBookings();
      if (response.success && response.bookings) {
        const myBooking = response.bookings.find((b: any) => b.ad?.id === adId);
        if (myBooking && (myBooking.status === 'accepted' || myBooking.status === 'delivered' || myBooking.status === 'paid')) {
          setHasAcceptedBooking(true);
        }
      }
    } catch (error) {
      console.error('❌ Erreur vérification réservation:', error);
    }
  };

  // Charger les réservations de l'acheteur pour cette annonce
  const loadBuyerBookingsForAd = async (adId: string) => {
    try {
      const response = await bookingsApi.getBuyerBookings();
      if (response.success && response.bookings) {
        const myBookings = response.bookings.filter((b: any) => b.ad?.id === adId);
        setAllBookings(myBookings);
        // Vérifier s'il y a une réservation delivered qui peut être payée
        const deliveredBooking = myBookings.find((b: any) => b.status === 'delivered');
        if (deliveredBooking) {
          setSelectedBookingForPayment(deliveredBooking.id);
        }
      }
    } catch (error) {
      console.error('❌ Erreur chargement réservations acheteur:', error);
    }
  };

  // Accepter une réservation
  const handleAcceptBooking = async (bookingId: string) => {
    Alert.alert(
      'Confirmer la réservation',
      'Êtes-vous sûr de confirmer cette réservation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              const response = await bookingsApi.acceptBooking(bookingId);
              if (response.success) {
                Alert.alert('✅ Réservation confirmée', 'Le demandeur recevra une notification.');
                loadBookingsForAd(ad?.id || '');
              } else {
                Alert.alert('Erreur', response.error || 'Impossible de confirmer la réservation');
              }
            } catch (error) {
              console.error('❌ Erreur confirmation:', error);
              Alert.alert('Erreur', 'Une erreur s\'est produite');
            }
          }
        }
      ]
    );
  };

  // Rejeter une réservation
  const handleRejectBooking = async (bookingId: string) => {
    Alert.alert(
      'Rejeter la réservation',
      'Êtes-vous sûr de rejeter cette réservation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rejeter',
          onPress: async () => {
            try {
              const response = await bookingsApi.rejectBooking(bookingId);
              if (response.success) {
                Alert.alert('✅ Réservation rejetée', 'Le demandeur recevra une notification.');
                loadBookingsForAd(ad?.id || '');
              } else {
                Alert.alert('Erreur', response.error || 'Impossible de rejeter la réservation');
              }
            } catch (error) {
              console.error('❌ Erreur rejet:', error);
              Alert.alert('Erreur', 'Une erreur s\'est produite');
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  // Confirmer la livraison (vendeur)
  const handleDeliverBooking = async (bookingId: string) => {
    Alert.alert(
      'Confirmer la livraison',
      'Avez-vous bien livré l\'article au client ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              const response = await bookingsApi.deliverBooking(bookingId);
              if (response.success) {
                Alert.alert('✅ Livraison confirmée', 'Le client peut maintenant procéder au paiement.');
                loadBookingsForAd(ad?.id || '');
              } else {
                Alert.alert('Erreur', response.error || 'Impossible de confirmer la livraison');
              }
            } catch (error) {
              console.error('❌ Erreur confirmation livraison:', error);
              Alert.alert('Erreur', 'Une erreur s\'est produite');
            }
          }
        }
      ]
    );
  };

  // Payer une réservation (acheteur)
  const handlePayBooking = async () => {
    if (!selectedBookingForPayment || !paymentMethod) {
      Alert.alert('Erreur', 'Veuillez sélectionner une méthode de paiement');
      return;
    }

    if (paymentMethod === 'mobile_money') {
      // Vérifier que les champs sont remplis
      if (!buyerPhone.trim() || !transactionCode.trim()) {
        Alert.alert('Erreur', 'Veuillez remplir votre numéro de téléphone et le code de transaction');
        return;
      }

      try {
        const response = await bookingsApi.payBooking(selectedBookingForPayment, paymentMethod, buyerPhone.trim(), transactionCode.trim());
        if (response.success) {
          Alert.alert(
            '✅ Paiement effectué',
            `Paiement Mobile Money enregistré avec succès.\n\nCode transaction: ${transactionCode}\nNuméro vendeur: ${response.sellerPhone || 'N/A'}`,
            [{ text: 'OK', onPress: () => {
              setPaymentModalVisible(false);
              setSelectedBookingForPayment(null);
              setPaymentMethod('mobile_money');
              setBuyerPhone('');
              setTransactionCode('');
              loadAd();
            }}]
          );
        } else {
          Alert.alert('Erreur', response.error || 'Impossible d\'effectuer le paiement');
        }
      } catch (error) {
        console.error('❌ Erreur paiement:', error);
        Alert.alert('Erreur', 'Une erreur s\'est produite lors du paiement');
      }
    } else {
      // Pour les autres méthodes de paiement
      try {
        const response = await bookingsApi.payBooking(selectedBookingForPayment, paymentMethod);
        if (response.success) {
          Alert.alert(
            '✅ Paiement effectué',
            'Votre paiement a été enregistré avec succès.',
            [{ text: 'OK', onPress: () => {
              setPaymentModalVisible(false);
              setSelectedBookingForPayment(null);
              loadAd();
            }}]
          );
        } else {
          Alert.alert('Erreur', response.error || 'Impossible d\'effectuer le paiement');
        }
      } catch (error) {
        console.error('❌ Erreur paiement:', error);
        Alert.alert('Erreur', 'Une erreur s\'est produite lors du paiement');
      }
    }
  };

  // Obtenir le texte du statut
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

  // Obtenir la couleur du statut
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

  // Confirmer la réception (acheteur)
  const handleConfirmDelivery = async (bookingId: string) => {
    Alert.alert(
      'Confirmer la réception',
      'Avez-vous bien reçu l\'article livré ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              const response = await bookingsApi.confirmDelivery(bookingId);
              if (response.success) {
                Alert.alert('✅ Réception confirmée', 'Vous pouvez maintenant procéder au paiement.');
                loadBuyerBookingsForAd(ad?.id || '');
              } else {
                Alert.alert('Erreur', response.error || 'Impossible de confirmer la réception');
              }
            } catch (error) {
              console.error('❌ Erreur confirmation réception:', error);
              Alert.alert('Erreur', 'Une erreur s\'est produite');
            }
          }
        }
      ]
    );
  };

  const handleContact = () => {
    if (!ad || !ad.user) return;
    
    const userName = `${ad.user.firstName || ''} ${ad.user.lastName || ''}`.trim() || 'le vendeur';
    
    Alert.alert(
      'Contacter le vendeur',
      `Voulez-vous contacter ${userName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Par message',
          onPress: async () => {
            // Vérifier d'abord si une conversation existe déjà
            try {
              const response = await messagingApi.getConversationByAd(ad.id);
              
              if (response.success && response.conversationId) {
                // Rediriger vers la conversation existante
                router.push(`/messages/${response.conversationId}`);
              } else {
                // Créer une nouvelle conversation
                router.push({
                  pathname: '/messages/new',
                  params: { 
                    adId: ad.id,
                    receiverId: ad.userId,
                    adTitle: ad.title,
                    receiverName: userName 
                  }
                });
              }
            } catch (error) {
              // En cas d'erreur, créer une nouvelle conversation
              router.push({
                pathname: '/messages/new',
                params: { 
                  adId: ad.id,
                  receiverId: ad.userId,
                  adTitle: ad.title,
                  receiverName: userName 
                }
              });
            }
          },
        },
        {
          text: 'Par téléphone',
          onPress: () => {
            if (ad.user?.phone) {
              Alert.alert('Appel', `Appeler ${ad.user.phone}...`);
            } else {
              Alert.alert('Info', 'Numéro de téléphone non disponible');
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    if (!ad) return;
    
    try {
      await Share.share({
        message: `Regarde cette annonce sur TIA Market: ${ad.title} - ${formatPrice(ad.price)}`,
        url: `https://tiamarket.com/ad/${ad.id}`,
      });
    } catch (error) {
      console.error('❌ Erreur lors du partage:', error);
    }
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // TODO: Appeler l'API pour ajouter/retirer des favoris
  };

  const handleReport = () => {
    Alert.alert(
      'Signaler cette annonce',
      'Pourquoi souhaitez-vous signaler cette annonce ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Contenu inapproprié', style: 'destructive' },
        { text: 'Arnaque suspectée', style: 'destructive' },
        { text: 'Article déjà vendu', style: 'destructive' },
        { text: 'Autre raison', style: 'destructive' },
      ]
    );
  };

  const handleCallSeller = () => {
    if (!ad?.user?.phone) {
      Alert.alert('Info', 'Numéro de téléphone non disponible');
      return;
    }
    
    Alert.alert(
      'Appeler le vendeur',
      `Voulez-vous appeler ${ad.user.phone} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Appeler',
          onPress: () => {
            // Pour une vraie application:
            // Linking.openURL(`tel:${ad.user.phone}`);
            Alert.alert('Appel', `Appel vers ${ad.user.phone}...`);
          },
        },
      ]
    );
  };

  const renderImageItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.imageWrapper}>
      <Image
        source={{ uri: item }}
        style={styles.image}
        resizeMode="cover"
        onError={(e) => {
          console.log(`❌ Erreur chargement image ${index}:`, item, e.nativeEvent.error);
        }}
        onLoad={() => {
          console.log(`✅ Image chargée:`, item);
        }}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1B5E20" />
          <Text style={styles.loadingText}>Chargement de l'annonce...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ad) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={64} color="#FF9500" />
          <Text style={styles.errorText}>Annonce non trouvée</Text>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const images = ad.images || [];
  const hasImages = images.length > 0;

  console.log('📱 État final:', {
    hasImages,
    imagesCount: images.length,
    images: images
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* En-tête avec bouton retour */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleShare} 
            style={styles.shareButton}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Carrousel d'images */}
        <View style={styles.imageContainer}>
          {hasImages ? (
            <>
              <FlatList
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={images}
                renderItem={renderImageItem}
                keyExtractor={(item, index) => `image-${index}`}
                onScroll={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setCurrentImageIndex(index);
                }}
                scrollEventThrottle={16}
              />
              {images.length > 1 && (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>
                    {currentImageIndex + 1}/{images.length}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="image-outline" size={64} color="#999" />
              <Text style={styles.noImageText}>Aucune image disponible</Text>
            </View>
          )}
        </View>

        {/* Informations principales */}
        <View style={styles.content}>
          <View style={styles.priceSection}>
            <Text style={styles.price}>{formatPrice(ad.price)}</Text>
            {ad.priceNegotiable && (
              <View style={styles.negotiableBadge}>
                <Text style={styles.negotiableText}>Négociable</Text>
              </View>
            )}
            {ad.isFeatured && (
              <View style={styles.featuredBadge}>
                <Ionicons name="star" size={12} color="#FFF" />
                <Text style={styles.featuredText}>À la une</Text>
              </View>
            )}
          </View>

          <Text style={styles.title}>{ad.title}</Text>

          <View style={styles.metaInfo}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.metaText}>{ad.city || 'Localisation non spécifiée'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.metaText}>
                {formatDate(ad.createdAt)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="eye-outline" size={16} color="#666" />
              <Text style={styles.metaText}>{ad.viewCount || 0} vues</Text>
            </View>
          </View>

          {/* État */}
          <View style={styles.conditionSection}>
            <Ionicons 
              name={ad.condition === 'new' ? 'sparkles' : 'checkmark-circle'} 
              size={20} 
              color={ad.condition === 'new' ? '#FF9500' : '#34C759'} 
            />
            <Text style={styles.conditionText}>
              {getConditionText(ad.condition)}
            </Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{ad.description}</Text>
          </View>

          {/* Vendeur */}
          {ad.user && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vendu par</Text>
              <View style={styles.sellerCard}>
                <Image
                  source={{ 
                    uri: ad.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(ad.user.firstName || '')}+${encodeURIComponent(ad.user.lastName || '')}&background=1B5E20&color=fff`
                  }}
                  style={styles.sellerAvatar}
                />
                <View style={styles.sellerInfo}>
                  <Text style={styles.sellerName}>
                    {ad.user.firstName || ''} {ad.user.lastName || ''}
                  </Text>
                  {ad.user.city && (
                    <Text style={styles.sellerLocation}>
                      <Ionicons name="location" size={12} color="#666" />
                      {` ${ad.user.city}`}
                    </Text>
                  )}
                  {ad.createdAt && (
                    <Text style={styles.sellerJoined}>
                      Membre depuis {new Date(ad.createdAt).getFullYear()}
                    </Text>
                  )}
                </View>
                {ad.user.phone && (
                  <TouchableOpacity 
                    style={styles.callButton}
                    onPress={handleCallSeller}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call-outline" size={20} color="#1B5E20" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Catégorie */}
          {ad.category && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Catégorie</Text>
              <View style={styles.categoryBadge}>
                <Ionicons 
                  name={ad.category.icon as any || 'tag'} 
                  size={16} 
                  color="#FFF" 
                />
                <Text style={styles.categoryText}>{ad.category.name}</Text>
              </View>
            </View>
          )}

          {/* Annonces similaires */}
          {similarAds.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Annonces similaires</Text>
              {loadingSimilar ? (
                <ActivityIndicator size="small" color="#1B5E20" />
              ) : (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.similarAdsScroll}
                >
                  {similarAds.map((similarAd) => (
                    <TouchableOpacity
                      key={similarAd.id}
                      style={styles.similarAdCard}
                      onPress={() => router.push(`/ad/${similarAd.id}`)}
                      activeOpacity={0.7}
                    >
                      {similarAd.imageUrl ? (
                        <Image 
                          source={{ uri: getSafeImageUrl(similarAd.imageUrl) }} 
                          style={styles.similarAdImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.similarAdImagePlaceholder}>
                          <Ionicons name="image-outline" size={20} color="#999" />
                        </View>
                      )}
                      <View style={styles.similarAdInfo}>
                        <Text style={styles.similarAdTitle} numberOfLines={1}>
                          {similarAd.title}
                        </Text>
                        <Text style={styles.similarAdPrice}>
                          {formatPrice(similarAd.price)}
                        </Text>
                        <Text style={styles.similarAdLocation} numberOfLines={1}>
                          {similarAd.city}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Réservations de l'acheteur */}
          {ad && ad.userId !== userInfo?.id && allBookings.length > 0 && (
            <View style={styles.section}>
              <View style={styles.pendingBookingsHeader}>
                <Ionicons name="calendar-outline" size={20} color="#1B5E20" />
                <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>
                  Mes réservations ({allBookings.length})
                </Text>
              </View>
              {allBookings.map((booking) => (
                <View key={booking.id} style={[styles.bookingCard, booking.status === 'accepted' && styles.acceptedBookingCard]}>
                  <View style={styles.buyerInfo}>
                    <View style={styles.buyerHeader}>
                      <Text style={styles.buyerName}>Réservation #{booking.id.substring(0, 8)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.bookingDate}>
                      {new Date(booking.createdAt || booking.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                    {booking.message && (
                      <Text style={styles.bookingMessage}>"{booking.message}"</Text>
                    )}
                  </View>

                  {booking.status === 'delivered' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.confirmBtn]}
                      onPress={() => handleConfirmDelivery(booking.id)}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                      <Text style={styles.actionBtnText}>Confirmer réception</Text>
                    </TouchableOpacity>
                  )}

                  {booking.status === 'delivery_confirmed' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.payBtn]}
                      onPress={() => {
                        setSelectedBookingForPayment(booking.id);
                        setPaymentModalVisible(true);
                      }}
                    >
                      <Ionicons name="card" size={18} color="#FFF" />
                      <Text style={styles.actionBtnText}>Payer maintenant</Text>
                    </TouchableOpacity>
                  )}

                  {booking.status === 'paid' && (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#1B5E20" />
                      <Text style={styles.completedText}>Paiement effectué</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Toutes les réservations pour le vendeur */}
          {ad && ad.userId === userInfo?.id && allBookings.length > 0 && (
            <View style={styles.section}>
              <View style={styles.pendingBookingsHeader}>
                <Ionicons name="calendar-outline" size={20} color="#1B5E20" />
                <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>
                  Réservations ({allBookings.length})
                </Text>
              </View>
              {allBookings.map((booking) => (
                <View key={booking.id} style={[styles.bookingCard, booking.status === 'accepted' && styles.acceptedBookingCard]}>
                  {/* Infos du demandeur */}
                  {booking.buyer && (
                    <View style={styles.buyerInfo}>
                      <View style={styles.buyerHeader}>
                        <Text style={styles.buyerName}>
                          {booking.buyer.firstName} {booking.buyer.lastName}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                          <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
                        </View>
                      </View>
                      <Text style={styles.bookingDate}>
                        {new Date(booking.createdAt || booking.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                      {booking.buyer.email && (
                        <Text style={styles.buyerEmail}>{booking.buyer.email}</Text>
                      )}
                      {booking.buyer.phone && (
                        <Text style={styles.buyerEmail}>📞 {booking.buyer.phone}</Text>
                      )}
                      {booking.message && (
                        <Text style={styles.bookingMessage}>"{booking.message}"</Text>
                      )}
                    </View>
                  )}

                  {/* Boutons d'action selon le statut */}
                  <View style={styles.bookingActions}>
                    {booking.status === 'pending' && (
                      <>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.confirmBtn]}
                          onPress={() => handleAcceptBooking(booking.id)}
                        >
                          <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                          <Text style={styles.actionBtnText}>Accepter</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rejectBtn]}
                          onPress={() => handleRejectBooking(booking.id)}
                        >
                          <Ionicons name="close-circle" size={18} color="#FFF" />
                          <Text style={styles.actionBtnText}>Rejeter</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {booking.status === 'accepted' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.deliverBtn]}
                        onPress={() => handleDeliverBooking(booking.id)}
                      >
                        <Ionicons name="checkmark-done-circle" size={18} color="#FFF" />
                        <Text style={styles.actionBtnText}>Confirmer livraison</Text>
                      </TouchableOpacity>
                    )}

                    {booking.status === 'delivered' && (
                      <View style={styles.waitingPayment}>
                        <Ionicons name="time-outline" size={18} color="#FF9500" />
                        <Text style={styles.waitingPaymentText}>
                          En attente de confirmation de réception par le client
                        </Text>
                      </View>
                    )}

                    {booking.status === 'delivery_confirmed' && (
                      <View style={styles.waitingPayment}>
                        <Ionicons name="card-outline" size={18} color="#5856D6" />
                        <Text style={styles.waitingPaymentText}>
                          En attente de paiement par le client
                        </Text>
                      </View>
                    )}

                    {booking.status === 'paid' && (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-circle" size={18} color="#1B5E20" />
                        <Text style={styles.completedText}>Paiement reçu</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.messageBtn]}
                      onPress={() => {
                        // Route vers la conversation avec le buyer
                        router.push(`/messages/${booking.buyer?.id || booking.buyer_id}`);
                      }}
                    >
                      <Ionicons name="chatbubble-outline" size={18} color="#666" />
                      <Text style={[styles.actionBtnText, { color: '#666' }]}>
                        Message
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Barre d'actions fixe en bas */}
      <View style={styles.actionBar}>
        <TouchableOpacity 
          style={styles.favoriteButton} 
          onPress={toggleFavorite}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={isFavorite ? '#FF3B30' : '#333'}
          />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.reportButton} 
          onPress={handleReport}
          activeOpacity={0.7}
        >
          <Ionicons name="flag-outline" size={20} color="#666" />
        </TouchableOpacity>

        {/* Bouton Réserver si l'annonce n'est pas du propriétaire et qu'aucune réservation n'est acceptée */}
        {ad && ad.userId !== userInfo?.id && !hasAcceptedBooking && (
          <TouchableOpacity 
            style={styles.bookingButton}
            onPress={() => setBookingModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={18} color="#FFF" />
            <Text style={styles.bookingButtonText}>Réserver</Text>
          </TouchableOpacity>
        )}

        {/* Message si une réservation est acceptée */}
        {ad && ad.userId !== userInfo?.id && hasAcceptedBooking && (
          <View style={styles.bookingDisabled}>
            <Ionicons name="lock-closed" size={18} color="#999" />
            <Text style={styles.bookingDisabledText}>Réservation acceptée</Text>
          </View>
        )}

        {/* Bouton Contacter - seulement si ce n'est pas son propre annonce */}
        {ad && ad.userId !== userInfo?.id && (
          <TouchableOpacity 
            style={styles.contactButton} 
            onPress={handleContact}
            activeOpacity={0.8}
          >
            <Text style={styles.contactButtonText}>Contacter</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal simple de réservation */}
      <Modal
        visible={bookingModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Réserver cette annonce</Text>
              <TouchableOpacity onPress={() => setBookingModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Info annonce */}
              {ad && (
                <View style={styles.adInfoBox}>
                  <Image 
                    source={{ uri: getSafeImageUrl(ad.image_url || ad.primary_image) }}
                    style={styles.adInfoImage}
                  />
                  <View style={styles.adInfoText}>
                    <Text style={styles.adInfoTitle}>{ad.title}</Text>
                    <Text style={styles.adInfoPrice}>{formatPrice(ad.price)}</Text>
                  </View>
                </View>
              )}

              {/* Message */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Votre message (optionnel)</Text>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Écrivez un message au vendeur..."
                  placeholderTextColor="#CCC"
                  multiline
                  numberOfLines={4}
                  value={bookingMessage}
                  onChangeText={setBookingMessage}
                />
              </View>

              {/* Info statut */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#1B5E20" />
                <Text style={styles.infoText}>
                  Après votre réservation, le vendeur devra confirmer. Vous recevrez une notification une fois confirmée.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={() => handleReservation()}
            >
              <Text style={styles.submitButtonText}>Envoyer ma réservation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de paiement */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payer la réservation</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#1B5E20" />
                <Text style={styles.infoText}>
                  La réception a été confirmée. Vous pouvez maintenant procéder au paiement Mobile Money.
                </Text>
              </View>

              {paymentMethod === 'mobile_money' && (
                <>
                  <View style={styles.infoBox}>
                    <Ionicons name="phone-portrait" size={20} color="#FF9500" />
                    <Text style={styles.infoText}>
                      Envoyez le paiement au numéro du vendeur. Après le paiement, entrez votre numéro et le code de transaction reçu.
                    </Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Votre numéro de téléphone</Text>
                    <TextInput
                      style={styles.messageInput}
                      placeholder="0341234567"
                      placeholderTextColor="#CCC"
                      value={buyerPhone}
                      onChangeText={setBuyerPhone}
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Code de transaction</Text>
                    <TextInput
                      style={styles.messageInput}
                      placeholder="ABC123"
                      placeholderTextColor="#CCC"
                      value={transactionCode}
                      onChangeText={setTransactionCode}
                      autoCapitalize="characters"
                    />
                  </View>
                </>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Méthode de paiement</Text>
                <TouchableOpacity
                  style={[styles.paymentMethodOption, paymentMethod === 'mobile_money' && styles.paymentMethodSelected]}
                  onPress={() => setPaymentMethod('mobile_money')}
                >
                  <Ionicons name="phone-portrait" size={20} color={paymentMethod === 'mobile_money' ? '#1B5E20' : '#666'} />
                  <Text style={[styles.paymentMethodText, paymentMethod === 'mobile_money' && styles.paymentMethodTextSelected]}>
                    Mobile Money
                  </Text>
                  {paymentMethod === 'mobile_money' && (
                    <Ionicons name="checkmark-circle" size={20} color="#1B5E20" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.paymentMethodOption, paymentMethod === 'cash' && styles.paymentMethodSelected]}
                  onPress={() => setPaymentMethod('cash')}
                >
                  <Ionicons name="cash" size={20} color={paymentMethod === 'cash' ? '#1B5E20' : '#666'} />
                  <Text style={[styles.paymentMethodText, paymentMethod === 'cash' && styles.paymentMethodTextSelected]}>
                    Espèces
                  </Text>
                  {paymentMethod === 'cash' && (
                    <Ionicons name="checkmark-circle" size={20} color="#1B5E20" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.paymentMethodOption, paymentMethod === 'bank_transfer' && styles.paymentMethodSelected]}
                  onPress={() => setPaymentMethod('bank_transfer')}
                >
                  <Ionicons name="card" size={20} color={paymentMethod === 'bank_transfer' ? '#1B5E20' : '#666'} />
                  <Text style={[styles.paymentMethodText, paymentMethod === 'bank_transfer' && styles.paymentMethodTextSelected]}>
                    Virement bancaire
                  </Text>
                  {paymentMethod === 'bank_transfer' && (
                    <Ionicons name="checkmark-circle" size={20} color="#1B5E20" />
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handlePayBooking}
            >
              <Text style={styles.submitButtonText}>Confirmer le paiement</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    height: 300,
    position: 'relative',
  },
  image: {
    width: SCREEN_WIDTH,
    height: 300,
  },
  noImageContainer: {
    width: SCREEN_WIDTH,
    height: 300,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  imageCounter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginRight: 12,
  },
  negotiableBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  negotiableText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(27, 94, 32, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  metaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  conditionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  conditionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
  },
  sellerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  sellerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sellerLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  sellerJoined: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: '#FFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1B5E20',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B5E20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  similarAdsScroll: {
    marginHorizontal: -16,
  },
  similarAdCard: {
    width: 160,
    marginLeft: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  similarAdImage: {
    width: '100%',
    height: 100,
  },
  similarAdImagePlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  similarAdInfo: {
    padding: 8,
  },
  similarAdTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  similarAdPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 4,
  },
  similarAdLocation: {
    fontSize: 10,
    color: '#666',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFF',
    gap: 8,
  },
  favoriteButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  bookingButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  contactButton: {
    flex: 1,
    backgroundColor: '#1B5E20',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  contactButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  adInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  adInfoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  adInfoText: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  adInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  adInfoPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B5E20',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1B5E20',
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#1B5E20',
    margin: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Styles pour les réservations en attente
  pendingBookingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4CC',
  },
  bookingCard: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FFE4CC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  buyerInfo: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4CC',
  },
  buyerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  buyerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  buyerEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  bookingDate: {
    fontSize: 12,
    color: '#999',
  },
  bookingMessage: {
    fontSize: 13,
    color: '#555',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFE4CC',
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    flex: 1,
    minWidth: '31%',
    justifyContent: 'center',
  },
  confirmBtn: {
    backgroundColor: '#34C759',
  },
  rejectBtn: {
    backgroundColor: '#FF3B30',
  },
  viewBtn: {
    backgroundColor: '#E8F5E9',
  },
  messageBtn: {
    backgroundColor: '#F5F5F5',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  acceptedBookingCard: {
    borderColor: '#34C759',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  deliverBtn: {
    backgroundColor: '#007AFF',
  },
  payBtn: {
    backgroundColor: '#1B5E20',
    flex: 1,
  },
  waitingPayment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E6',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    flex: 1,
  },
  waitingPaymentText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    flex: 1,
  },
  completedText: {
    color: '#1B5E20',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginRight: 8,
  },
  bookingDisabledText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 12,
    gap: 12,
  },
  paymentMethodSelected: {
    borderColor: '#1B5E20',
    backgroundColor: '#E8F5E9',
  },
  paymentMethodText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  paymentMethodTextSelected: {
    color: '#1B5E20',
    fontWeight: '600',
  },
});