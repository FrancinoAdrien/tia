// utils/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from './config';

const api = axios.create({
  baseURL: API_CONFIG.getBaseURL(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Intercepteur pour logger les requêtes
api.interceptors.request.use(
  (config) => {
    console.log(`➡️ ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Erreur requête:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour logger les réponses
api.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`❌ ${error.response.status} ${error.config.url}`);
    } else if (error.request) {
      console.error('🌐 Erreur réseau - Pas de réponse du serveur');
      console.error('📡 URL tentée:', error.config?.url);
      console.error('🔍 Base URL:', api.defaults.baseURL);
      console.error('\n💡 Vérifications:');
      console.error('   1. Le serveur backend est-il démarré? (cd tia-market-backend && node server.cjs)');
      console.error('   2. Le serveur écoute-t-il sur 0.0.0.0:3001?');
      console.error('   3. Êtes-vous sur le même réseau WiFi?');
      console.error('   4. Le pare-feu Windows bloque-t-il le port 3001?');
      console.error(`   5. Testez dans Chrome: http://192.168.43.213:3001/api/test`);
    } else {
      console.error('❌ Erreur de configuration:', error.message);
    }
    return Promise.reject(error);
  }
);

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Erreur récupération token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isVerified: boolean;
  createdAt: string;
  premiumPack?: 'simple' | 'starter' | 'pro' | 'entreprise';
  endPremium?: string;
  rating?: number;
  ratingCount?: number;
  city?: string;
  avatarUrl?: string;
  bio?: string;
  userRating?: number;
}

export interface Wallet {
  id: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'payment' | 'refund';
  amount: number;
  description?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    premiumPack?: 'simple' | 'starter' | 'pro' | 'entreprise';
    isVerified: boolean;
    createdAt: string;
    // Ajouter les autres champs du profil
    city?: string;
    avatarUrl?: string;
    bio?: string;
    userRating?: number;
  };
}

export interface Ad {
  id: string;
  userId: string;
  categoryId: number;
  title: string;
  description: string;
  price: number;
  priceNegotiable: boolean;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  city: string;
  postalCode?: string;
  isActive: boolean;
  isSold: boolean;
  isFeatured: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  // Champs de la base de données (snake_case)
  user_id?: string;
  category_id?: number;
  price_negotiable?: boolean;
  is_active?: boolean;
  is_sold?: boolean;
  is_featured?: boolean;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
  // Champs joints
  user?: AdUser;
  category?: AdCategory;
  images?: string[];
  imageUrl?: string;
  first_name?: string;
  last_name?: string;
  category_name?: string;
  category_slug?: string;
  category_icon?: string;
  category_color?: string;
  primary_image?: string;
}

export interface AdFormData {
  title: string;
  description: string;
  price: number;
  priceNegotiable: boolean;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  categoryId: number;
  city: string;
  postalCode?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  parentId?: number;
}

// API Functions
export const authApi = {
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post('/login', data);
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/register', data);
    return response.data;
  },

  getProfile: async (): Promise<{ user: User }> => {
    const response = await api.get('/profile');
    return response.data;
  },
};

// API pour les annonces
export const adsApi = {
  createAd: async (adData: AdFormData): Promise<{ success: boolean; message: string; ad: Ad }> => {
    const response = await api.post('/ads', adData);
    return response.data;
  },

  getSimilarAds: async (adId: string, categoryId: number): Promise<{ 
    success: boolean; 
    ads: any[] 
  }> => {
    try {
      const response = await api.get(`/ads/${adId}/similar?categoryId=${categoryId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération annonces similaires:', error);
      return { success: false, ads: [] };
    }
  },

  getAdById: async (id: string): Promise<{ success: boolean; ad?: AdWithDetails; error?: string }> => {
    try {
      const response = await api.get(`/ads/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération annonce:', error);
      
      let errorMessage = 'Erreur lors de la récupération de l\'annonce';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Impossible de se connecter au serveur';
      } else if (error.response?.status === 404) {
        errorMessage = 'Annonce non trouvée';
      }
      
      return { success: false, error: errorMessage };
    }
  },

  // Incrémenter le compteur de vues
  incrementViewCount: async (id: string): Promise<{ success: boolean }> => {
    try {
      await api.post(`/ads/${id}/view`);
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur incrémentation vues:', error);
      return { success: false };
    }
  },

  uploadAdImages: async (adId: string, images: string[]): Promise<{ success: boolean; images: AdImage[]; errors?: string[] }> => {
    try {
      if (images.length === 0) {
        return { success: true, images: [] };
      }
      
      console.log(`🚀 Upload de ${images.length} images pour annonce ${adId}`);
      
      const uploadResults = await uploadMultipleImages(images, adId);
      
      const successfulUploads = uploadResults.filter(r => r.success);
      const errors = uploadResults.filter(r => !r.success).map(r => r.error!);
      
      console.log(`📊 Résultats upload: ${successfulUploads.length} succès, ${errors.length} échecs`);
      
      if (errors.length > 0) {
        console.log('⚠️ Erreurs:', errors);
      }
      
      return {
        success: successfulUploads.length > 0,
        images: successfulUploads.map(r => r.image!),
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('❌ Erreur upload images:', error);
      return { 
        success: false, 
        images: [], 
        errors: ['Erreur lors de l\'upload des images'] 
      };
    }
  },

  getAdImages: async (adId: string): Promise<{ success: boolean; images: AdImage[] }> => {
    try {
      const response = await api.get(`/ads/${adId}/images`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération images:', error);
      return { success: false, images: [] };
    }
  },

  deleteAdImage: async (imageId: number): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.delete(`/ads/images/${imageId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur suppression image:', error);
      return { success: false, message: 'Erreur suppression image' };
    }
  },

  renewAd: async (adId: string, days: 30 | 150): Promise<{ success: boolean; newExpiresAt?: string; cost?: number; error?: string }> => {
    try {
      const response = await api.patch(`/ads/${adId}/renew`, { days });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur remontée annonce:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la remontée de l\'annonce'
      };
    }
  },

  getUserAds: async (): Promise<{ success: boolean; ads?: AdWithDetails[]; error?: string }> => {
    try {
      const response = await api.get('/user/ads');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération annonces utilisateur:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la récupération des annonces'
      };
    }
  },
};

// API pour les réservations d'annonces (Booking System)
export const bookingsApi = {
  createBooking: async (adId: string, message: string): Promise<{ success: boolean; booking?: any; error?: string }> => {
    try {
      const response = await api.post('/bookings', { adId, message });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur création réservation:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la réservation' 
      };
    }
  },

  getSellerBookings: async (): Promise<{ success: boolean; bookings?: any[]; error?: string }> => {
    try {
      const response = await api.get('/bookings/seller');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération réservations vendeur:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la récupération' 
      };
    }
  },

  getBuyerBookings: async (): Promise<{ success: boolean; bookings?: any[]; error?: string }> => {
    try {
      const response = await api.get('/bookings/buyer');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération réservations acheteur:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la récupération' 
      };
    }
  },

  acceptBooking: async (bookingId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.patch(`/bookings/${bookingId}/accept`, {});
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur acceptation réservation:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de l\'acceptation' 
      };
    }
  },

  rejectBooking: async (bookingId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.patch(`/bookings/${bookingId}/reject`, {});
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur refus réservation:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors du refus' 
      };
    }
  },

  payBooking: async (bookingId: string, paymentMethod: string, buyerPhone?: string, transactionCode?: string): Promise<{ success: boolean; error?: string; transactionCode?: string; sellerPhone?: string }> => {
    try {
      const response = await api.patch(`/bookings/${bookingId}/payment`, { 
        paymentMethod,
        buyerPhone,
        transactionCode
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur paiement réservation:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors du paiement' 
      };
    }
  },

  deliverBooking: async (bookingId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.patch(`/bookings/${bookingId}/deliver`, {});
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur confirmation livraison:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la confirmation de la livraison' 
      };
    }
  },

  confirmDelivery: async (bookingId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.patch(`/bookings/${bookingId}/confirm-delivery`, {});
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur confirmation réception:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la confirmation de la réception' 
      };
    }
  },

  getBookingsByAd: async (adId: string): Promise<{ success: boolean; bookings?: any[]; error?: string }> => {
    try {
      const response = await api.get(`/bookings/seller?adId=${adId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération réservations par annonce:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la récupération' 
      };
    }
  },
};

// API pour les annonces de réservation (Premium)
export const reservationAdsApi = {
  createReservationAd: async (data: any): Promise<{ success: boolean; ad?: any; error?: string }> => {
    try {
      const response = await api.post('/ads/reservation', data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur création annonce réservation:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la création de l\'annonce' 
      };
    }
  },

  getReservationAdById: async (id: string): Promise<{ success: boolean; ad?: any; error?: string }> => {
    try {
      const response = await api.get(`/ads/reservation/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération annonce réservation:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la récupération de l\'annonce' 
      };
    }
  },

  getUserReservationAds: async (): Promise<{ success: boolean; ads?: any[]; error?: string }> => {
    try {
      const response = await api.get('/user/ads/reservation');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération annonces réservation:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la récupération des annonces' 
      };
    }
  },

  updateReservationAd: async (id: string, data: any): Promise<{ success: boolean; ad?: any; error?: string }> => {
    try {
      const response = await api.put(`/ads/reservation/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur modification annonce réservation:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la modification de l\'annonce' 
      };
    }
  },

  deleteReservationAd: async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.delete(`/ads/reservation/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur suppression annonce réservation:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur lors de la suppression de l\'annonce' 
      };
    }
  },
};

// API pour les catégories - CELLE-CI EST IMPORTANTE !
export const categoriesApi = {
  getCategories: async (): Promise<{ success: boolean; categories: Category[] }> => {
    try {
      const response = await api.get('/categories');
      return response.data;
    } catch (error) {
      console.error('Erreur API getCategories:', error);
      return { success: false, categories: [] };
    }
  },
};

// Fonction de test
export const testBackendConnection = API_CONFIG.testConnection;

export const homeApi = {
  // Récupérer les annonces récentes
  getRecentAds: async (limit: number = 10): Promise<{ success: boolean; ads: AdWithDetails[] }> => {
    try {
      const response = await api.get(`/ads/recent?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Erreur API getRecentAds:', error);
      return { success: false, ads: [] };
    }
  },

  // Récupérer les annonces populaires
  getPopularAds: async (limit: number = 6): Promise<{ success: boolean; ads: AdWithDetails[] }> => {
    try {
      const response = await api.get(`/ads/popular?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Erreur API getPopularAds:', error);
      return { success: false, ads: [] };
    }
  },
};


export interface AdWithDetails extends Ad {
  // Informations supplémentaires
  user?: {
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string;
  };
  category?: {
    name: string;
    slug: string;
    icon?: string;
    color?: string;
  };
  images?: string[];
  imageUrl?: string;
}

export interface UserProfile {
  avatar_url?: string;
  city?: string;
  bio?: string;
  rating?: number;
  total_ratings?: number;
}

export interface AdImage {
  id: number;
  ad_id: string;
  image_url: string;
  is_primary: boolean;
  position: number;
  created_at: string;
}

export const uploadImage = async (imageUri: string, adId: string): Promise<{ success: boolean; image?: AdImage; error?: string }> => {
  try {
    console.log(`📤 Upload image pour annonce ${adId}:`, imageUri.substring(0, 50) + '...');
    
    // Créer un FormData
    const formData = new FormData();
    
    // Extraire le nom de fichier et le type
    const uriParts = imageUri.split('.');
    const fileType = uriParts[uriParts.length - 1].toLowerCase();
    
    formData.append('image', {
      uri: imageUri,
      name: `ad_${adId}_${Date.now()}.${fileType}`,
      type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
    } as any);
    
    formData.append('adId', adId);
    
    console.log('📦 FormData créé, envoi au serveur...');
    
    const response = await api.post('/ads/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    console.log('✅ Réponse upload:', response.data);
    
    return { 
      success: true, 
      image: response.data.image 
    };
    
  } catch (error: any) {
    console.error('❌ Erreur upload image:', error.response?.data || error.message);
    
    let errorMessage = 'Erreur lors de l\'upload de l\'image';
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message.includes('Network Error')) {
      errorMessage = 'Impossible de se connecter au serveur';
    }
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
};

export const uploadMultipleImages = async (imageUris: string[], adId: string): Promise<{ success: boolean; image?: AdImage; error?: string }[]> => {
  console.log(`📤 Début upload de ${imageUris.length} images pour annonce ${adId}`);
  
  const results: { success: boolean; image?: AdImage; error?: string }[] = [];
  
  for (let i = 0; i < imageUris.length; i++) {
    console.log(`📤 Upload image ${i + 1}/${imageUris.length}`);
    
    const result = await uploadImage(imageUris[i], adId);
    
    results.push(result);
    
    // Pause courte entre les uploads
    if (i < imageUris.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`✅ Upload terminé: ${results.filter(r => r.success).length}/${imageUris.length} succès`);
  return results;
};

export interface AdUser {
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  city?: string;
}

export interface AdCategory {
  name: string;
  slug: string;
  icon?: string;
  color?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  isRead: boolean;
  isOwnMessage?: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  adId?: string;
  adTitle?: string;
  adPrice?: number;
  adCity?: string;
  adImage?: string;
  otherUser?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

export const messagingApi = {
  sendMessage: async (data: {
    conversationId?: string; // ⬅️ OPTIONNEL pour les réponses
    adId?: string;           // ⬅️ OPTIONNEL pour les premiers messages
    receiverId?: string;     // ⬅️ OPTIONNEL pour les premiers messages
    content: string;
  }): Promise<{ success: boolean; message?: Message; error?: string }> => {
    try {
      const response = await api.post('/messages', data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur envoi message:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de l\'envoi du message'
      };
    }
  },

  getConversationByAd: async (adId: string): Promise<{ 
    success: boolean; 
    conversationId?: string 
  }> => {
    try {
      const response = await api.get(`/conversations/by-ad/${adId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération conversation par annonce:', error);
      return { success: false };
    }
  },
  
  // Récupérer les conversations
  getConversations: async (): Promise<{ success: boolean; conversations: Conversation[] }> => {
    try {
      const response = await api.get('/conversations');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération conversations:', error);
      return { success: false, conversations: [] };
    }
  },
  // Récupérer les messages d'une conversation (FONCTION MANQUANTE)
  getMessages: async (conversationId: string): Promise<{ success: boolean; messages: Message[] }> => {
    try {
      const response = await api.get(`/conversations/${conversationId}/messages`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération messages:', error);
      return { success: false, messages: [] };
    }
  },

  // Récupérer les notifications (FONCTION MANQUANTE)
  getNotifications: async (limit?: number): Promise<{ 
    success: boolean; 
    notifications: Notification[]; 
    unreadCount: number 
  }> => {
    try {
      const params = limit ? { limit } : {};
      const response = await api.get('/notifications', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération notifications:', error);
      return { success: false, notifications: [], unreadCount: 0 };
    }
  },

  // Marquer une notification comme lue
  markNotificationAsRead: async (notificationId: string): Promise<{ 
    success: boolean; 
    notification?: Notification 
  }> => {
    try {
      const response = await api.patch(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur marquage notification:', error);
      return { success: false };
    }
  },

  // Marquer toutes les notifications comme lues
  markAllNotificationsAsRead: async (): Promise<{ success: boolean }> => {
    try {
      const response = await api.post('/notifications/mark-all-read');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur marquage toutes notifications:', error);
      return { success: false };
    }
  },

  // Ajoutez aussi cette fonction si vous en avez besoin
  getOrCreateConversation: async (adId: string, userId: string): Promise<{ 
    success: boolean; 
    conversationId?: string 
  }> => {
    try {
      // Vous devrez créer cette route dans le backend
      const response = await api.post('/conversations/get-or-create', { adId, userId });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur création conversation:', error);
      return { success: false };
    }
  },

  // Dans adsApi
    searchAds: async (filters: {
    query?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: string;
    city?: string;
  }): Promise<{ success: boolean; ads: AdWithDetails[]; error?: string }> => {
    try {
      console.log('🔍 Lancement recherche avec filtres:', filters);
      
      const params = new URLSearchParams();
      
      if (filters.query) params.append('query', filters.query);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.minPrice) params.append('minPrice', filters.minPrice.toString());
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
      if (filters.condition) params.append('condition', filters.condition);
      if (filters.city) params.append('city', filters.city);
      
      const url = `/ads/search?${params.toString()}`;
      console.log('🌐 URL recherche:', url);
      
      const response = await api.get(url);
      console.log('✅ Réponse recherche:', response.data.ads?.length || 0, 'résultats');
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur recherche API:', error);
      
      let errorMessage = 'Erreur lors de la recherche';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Impossible de se connecter au serveur';
      }
      
      return { 
        success: false, 
        ads: [], 
        error: errorMessage 
      };
    }
  },
};

// utils/api/locationApi.ts

const GOOGLE_MAPS_API_KEY = 'VOTRE_CLE_API_GOOGLE_MAPS'; // À remplacer

export const locationApi = {
  async searchLocation(query: string): Promise<any[]> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          query
        )}&key=${GOOGLE_MAPS_API_KEY}&language=fr`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK') {
        return data.predictions.map((prediction: any) => ({
          id: prediction.place_id,
          name: prediction.structured_formatting.main_text,
          address: prediction.description,
        }));
      }
      
      return [];
    } catch (error) {
      console.error('❌ Erreur recherche location:', error);
      return [];
    }
  },

  async reverseGeocode(latitude: number, longitude: number): Promise<any> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=fr`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          address: result.formatted_address,
          city: this.extractCity(result),
          postalCode: this.extractPostalCode(result),
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur reverse geocoding:', error);
      return null;
    }
  },

  extractCity(result: any): string {
    const components = result.address_components;
    const cityComponent = components.find((comp: any) => 
      comp.types.includes('locality') || 
      comp.types.includes('administrative_area_level_2')
    );
    return cityComponent ? cityComponent.long_name : '';
  },

  extractPostalCode(result: any): string {
    const components = result.address_components;
    const postalCodeComponent = components.find((comp: any) => 
      comp.types.includes('postal_code')
    );
    return postalCodeComponent ? postalCodeComponent.long_name : '';
  },

  upgradeToPremium: async (plan: 'starter' | 'pro' | 'enterprise'): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const mappedPlan = plan === 'enterprise' ? 'entreprise' : plan;
      
      // CORRECTION: Utilisez la bonne route '/api/user/premium' avec PATCH
      const response = await api.patch('/user/premium', { plan: mappedPlan });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur mise à jour premium:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de l\'activation premium'
      };
    }
  },
};

// Wallet API
export const walletApi = {
  getWallet: async (): Promise<{ success: boolean; wallet?: Wallet; error?: string }> => {
    try {
      const response = await api.get('/wallet');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération wallet:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la récupération du wallet'
      };
    }
  },

  deposit: async (amount: number): Promise<{ success: boolean; wallet?: Wallet; error?: string }> => {
    try {
      const response = await api.post('/wallet/deposit', { amount });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur dépôt wallet:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors du dépôt'
      };
    }
  },

  withdraw: async (amount: number): Promise<{ success: boolean; wallet?: Wallet; error?: string }> => {
    try {
      const response = await api.post('/wallet/withdraw', { amount });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur retrait wallet:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors du retrait'
      };
    }
  },

  getTransactions: async (limit?: number, offset?: number): Promise<{ success: boolean; transactions?: WalletTransaction[]; total?: number; error?: string }> => {
    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      const response = await api.get(`/wallet/transactions?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération transactions:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la récupération des transactions'
      };
    }
  },
};

// Points and Credits API
export const pointsApi = {
  getPoints: async (): Promise<{ success: boolean; points?: number; credits?: number; history?: any[]; error?: string }> => {
    try {
      const response = await api.get('/user/points');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération points:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la récupération des points'
      };
    }
  },

  claimDailyLogin: async (): Promise<{ success: boolean; points?: number; error?: string }> => {
    try {
      const response = await api.post('/user/points/daily-login');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur connexion quotidienne:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de l\'ajout des points'
      };
    }
  },

  claimReward: async (rewardType: 'credit_5000' | 'starter_1m' | 'pro_1m' | 'pro_3m' | 'enterprise_1m'): Promise<{ success: boolean; message?: string; pointsUsed?: number; remainingPoints?: number; error?: string }> => {
    try {
      const response = await api.post('/user/points/claim-reward', { rewardType });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur échange points:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de l\'échange de points'
      };
    }
  },

  getFeaturedCredits: async (): Promise<{ success: boolean; creditsRemaining?: number; isUnlimited?: boolean; error?: string }> => {
    try {
      const response = await api.get('/user/featured-credits');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération crédits:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la récupération des crédits'
      };
    }
  },
};

// Rating API - Système de notation des utilisateurs
export const ratingApi = {
  // Installer le système de notation (à exécuter une seule fois)
  setupRatingSystem: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const response = await api.post('/setup/rating-system');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur installation système notation:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de l\'installation'
      };
    }
  },

  // Noter un utilisateur
  rateUser: async (userId: string, rating: number, comment?: string, adId?: string): Promise<{ 
    success: boolean; 
    message?: string; 
    newRating?: number; 
    ratingCount?: number; 
    error?: string 
  }> => {
    try {
      const response = await api.post(`/users/${userId}/rate`, { rating, comment, adId });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur notation utilisateur:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la notation'
      };
    }
  },

  // Récupérer les notes d'un utilisateur
  getUserRatings: async (userId: string): Promise<{ 
    success: boolean; 
    averageRating?: number; 
    ratingCount?: number; 
    ratings?: Array<{
      rating: number;
      comment?: string;
      createdAt: string;
      raterName: string;
    }>;
    error?: string 
  }> => {
    try {
      const response = await api.get(`/users/${userId}/ratings`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération notes:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la récupération des notes'
      };
    }
  },

  // Vérifier si l'utilisateur peut noter (a effectué une transaction)
  canRateUser: async (userId: string): Promise<{ success: boolean; canRate?: boolean; error?: string }> => {
    try {
      const response = await api.get(`/users/${userId}/can-rate`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur vérification droit notation:', error);
      return {
        success: false,
        canRate: false,
        error: error.response?.data?.error || 'Erreur lors de la vérification'
      };
    }
  },
};

// Favorites API - Système de favoris
export const favoritesApi = {
  // Installer le système de favoris (à exécuter une seule fois)
  setupFavoritesSystem: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const response = await api.post('/setup/favorites-system');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur installation système favoris:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de l\'installation'
      };
    }
  },

  // Ajouter/Retirer une annonce des favoris (toggle)
  toggleFavorite: async (adId: string): Promise<{ 
    success: boolean; 
    isFavorite?: boolean; 
    message?: string; 
    error?: string 
  }> => {
    try {
      const response = await api.post(`/favorites/${adId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur toggle favori:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la modification'
      };
    }
  },

  // Récupérer tous les favoris de l'utilisateur
  getFavorites: async (): Promise<{ 
    success: boolean; 
    favorites?: AdWithDetails[]; 
    count?: number;
    error?: string 
  }> => {
    try {
      const response = await api.get('/favorites');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur récupération favoris:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur lors de la récupération'
      };
    }
  },

  // Vérifier si une annonce est en favoris
  checkFavorite: async (adId: string): Promise<{ 
    success: boolean; 
    isFavorite?: boolean; 
    error?: string 
  }> => {
    try {
      const response = await api.get(`/favorites/${adId}/check`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur vérification favori:', error);
      return {
        success: false,
        isFavorite: false,
        error: error.response?.data?.error || 'Erreur lors de la vérification'
      };
    }
  },
};


export default api;


