export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  city?: string;
  rating?: number;
  totalRatings?: number;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isPremium?: boolean;
  endPremium?: string;
}

// utils/api.ts - Ajoutez après authApi

// Types pour les annonces
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

// API pour les annonces
export const adsApi = {
  // Créer une annonce
  createAd: async (adData: AdFormData): Promise<{ success: boolean; message: string; ad: Ad }> => {
    console.log('📝 Création annonce:', adData.title);
    const response = await api.post('/ads', adData);
    return response.data;
  },

  // Récupérer toutes les annonces
  getAds: async (params?: {
    categoryId?: number;
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ ads: Ad[]; total: number }> => {
    const response = await api.get('/ads', { params });
    return response.data;
  },

  // Récupérer une annonce par ID
  getAdById: async (id: string): Promise<Ad> => {
    const response = await api.get(`/ads/${id}`);
    return response.data;
  },
};

// API pour les catégories
export const categoriesApi = {
  // Récupérer toutes les catégories
  getCategories: async (): Promise<{ success: boolean; categories: Category[] }> => {
    const response = await api.get('/categories');
    return response.data;
  },

  // Récupérer les sous-catégories
  getSubcategories: async (parentId: number): Promise<{ success: boolean; subcategories: Category[] }> => {
    const response = await api.get(`/categories/${parentId}/subcategories`);
    return response.data;
  },
};

export interface AuthContextType {
  userToken: string | null;
  userInfo: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUserPremium?: () => Promise<void>;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface AdWithDetails extends Ad {
  user?: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  category?: {
    name: string;
    slug: string;
    icon?: string;
  };
  images?: string[];
}

// Fonctions pour l'accueil
export const homeApi = {
  // Récupérer les annonces récentes
  getRecentAds: async (limit: number = 20): Promise<{ success: boolean; ads: AdWithDetails[] }> => {
    const response = await api.get(`/ads/recent?limit=${limit}`);
    return response.data;
  },

  // Récupérer les annonces populaires
  getPopularAds: async (limit: number = 10): Promise<{ success: boolean; ads: AdWithDetails[] }> => {
    const response = await api.get(`/ads/popular?limit=${limit}`);
    return response.data;
  },

  // Récupérer les annonces par catégorie
  getAdsByCategory: async (categoryId: number, limit: number = 10): Promise<{ success: boolean; ads: AdWithDetails[] }> => {
    const response = await api.get(`/ads/category/${categoryId}?limit=${limit}`);
    return response.data;
  },

  // Rechercher des annonces
  searchAds: async (query: string, filters?: any): Promise<{ success: boolean; ads: AdWithDetails[]; total: number }> => {
    const response = await api.get('/ads/search', { 
      params: { q: query, ...filters } 
    });
    return response.data;
  },
};

