import { Ad, AdFormData } from '@/types';

// Données mock pour les annonces
const mockAds: Ad[] = [
  {
    id: '1',
    userId: 'user1',
    categoryId: 4,
    title: 'iPhone 13 Pro Max 256Go',
    description: 'iPhone en parfait état, acheté il y a 6 mois. Boîte d\'origine et accessoires inclus. Jamais tombé, écran impeccable.',
    price: 750,
    priceNegotiable: true,
    condition: 'like_new',
    city: 'Paris',
    postalCode: '75001',
    isActive: true,
    isSold: false,
    isFeatured: true,
    viewCount: 124,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    user: {
      firstName: 'Jean',
      lastName: 'Dupont',
      avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
    images: [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800',
      'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w-800',
    ],
    category: {
      name: 'Multimédia',
      slug: 'multimedia',
    },
  },
  {
    id: '2',
    userId: 'user2',
    categoryId: 1,
    title: 'Peugeot 208 BlueHDi 75ch',
    description: 'Peugeot 208 de 2019, 45000km, entretien à jour. CT valide jusqu\'en décembre 2024. Intérieur tissu gris, clim, GPS.',
    price: 12500,
    priceNegotiable: false,
    condition: 'good',
    city: 'Lyon',
    postalCode: '69001',
    isActive: true,
    isSold: false,
    isFeatured: false,
    viewCount: 89,
    createdAt: '2024-01-10T14:20:00Z',
    updatedAt: '2024-01-10T14:20:00Z',
    user: {
      firstName: 'Marie',
      lastName: 'Martin',
      avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
    images: [
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800',
      'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800',
    ],
    category: {
      name: 'Véhicules',
      slug: 'vehicules',
    },
  },
  {
    id: '3',
    userId: 'user3',
    categoryId: 5,
    title: 'Canapé 3 places velours vert',
    description: 'Canapé 3 places en velours vert émeraude, acheté en 2022. Très bon état, pas d\'animaux, non fumeur. Dimensions: 220x90x85cm.',
    price: 450,
    priceNegotiable: true,
    condition: 'like_new',
    city: 'Marseille',
    postalCode: '13001',
    isActive: true,
    isSold: false,
    isFeatured: false,
    viewCount: 56,
    createdAt: '2024-01-05T09:15:00Z',
    updatedAt: '2024-01-05T09:15:00Z',
    user: {
      firstName: 'Pierre',
      lastName: 'Bernard',
      avatarUrl: 'https://randomuser.me/api/portraits/men/67.jpg',
    },
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
    ],
    category: {
      name: 'Maison',
      slug: 'maison',
    },
  },
  {
    id: '4',
    userId: 'user4',
    categoryId: 3,
    title: 'Veste en cuir véritable homme',
    description: 'Veste en cuir véritable de marque Zara, taille M. Portée quelques fois seulement. Couleur marron.',
    price: 80,
    priceNegotiable: true,
    condition: 'good',
    city: 'Bordeaux',
    postalCode: '33000',
    isActive: true,
    isSold: false,
    isFeatured: true,
    viewCount: 203,
    createdAt: '2024-01-02T16:45:00Z',
    updatedAt: '2024-01-02T16:45:00Z',
    user: {
      firstName: 'Sophie',
      lastName: 'Petit',
      avatarUrl: 'https://randomuser.me/api/portraits/women/33.jpg',
    },
    images: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800',
    ],
    category: {
      name: 'Mode',
      slug: 'mode',
    },
  },
  {
    id: '5',
    userId: 'user5',
    categoryId: 4,
    title: 'MacBook Air M1 2020',
    description: 'MacBook Air M1 256Go, 8Go RAM. En excellent état, batterie à 92%. Clavier rétroéclairé, Touch ID. Chargeur d\'origine inclus.',
    price: 850,
    priceNegotiable: false,
    condition: 'like_new',
    city: 'Toulouse',
    postalCode: '31000',
    isActive: true,
    isSold: false,
    isFeatured: false,
    viewCount: 178,
    createdAt: '2023-12-28T11:30:00Z',
    updatedAt: '2023-12-28T11:30:00Z',
    user: {
      firstName: 'Thomas',
      lastName: 'Robert',
      avatarUrl: 'https://randomuser.me/api/portraits/men/22.jpg',
    },
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800',
    ],
    category: {
      name: 'Multimédia',
      slug: 'multimedia',
    },
  },
];

// Service mock pour les annonces
export const adsService = {
  // Récupérer toutes les annonces
  getAds: async (filters?: {
    categoryId?: number;
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }) => {
    let filteredAds = [...mockAds];
    
    if (filters) {
      if (filters.categoryId) {
        filteredAds = filteredAds.filter(ad => ad.categoryId === filters.categoryId);
      }
      if (filters.city) {
        filteredAds = filteredAds.filter(ad => 
          ad.city.toLowerCase().includes(filters.city!.toLowerCase())
        );
      }
      if (filters.minPrice !== undefined) {
        filteredAds = filteredAds.filter(ad => ad.price >= filters.minPrice!);
      }
      if (filters.maxPrice !== undefined) {
        filteredAds = filteredAds.filter(ad => ad.price <= filters.maxPrice!);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredAds = filteredAds.filter(ad => 
          ad.title.toLowerCase().includes(searchLower) ||
          ad.description.toLowerCase().includes(searchLower) ||
          ad.category.name.toLowerCase().includes(searchLower)
        );
      }
    }
    
    return {
      ads: filteredAds,
      total: filteredAds.length,
    };
  },

  // Récupérer une annonce par ID
  getAdById: async (id: string): Promise<Ad | null> => {
    const ad = mockAds.find(ad => ad.id === id);
    return ad || null;
  },

  // Créer une nouvelle annonce
  createAd: async (adData: AdFormData, images: string[]): Promise<Ad> => {
    const newAd: Ad = {
      id: `mock-${Date.now()}`,
      userId: 'current-user-id',
      ...adData,
      isActive: true,
      isSold: false,
      isFeatured: Math.random() > 0.7, // 30% chance d'être featured
      viewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: {
        firstName: 'Vous',
        lastName: '',
      },
      images,
      category: {
        name: 'Catégorie Mock',
        slug: 'mock',
      },
    };
    
    mockAds.unshift(newAd);
    return newAd;
  },

  // Récupérer les annonces de l'utilisateur
  getUserAds: async (): Promise<Ad[]> => {
    return mockAds.filter(ad => ad.userId === 'current-user-id');
  },

  // Marquer comme vendu
  markAsSold: async (id: string): Promise<Ad | null> => {
    const adIndex = mockAds.findIndex(ad => ad.id === id);
    if (adIndex === -1) return null;
    
    mockAds[adIndex] = {
      ...mockAds[adIndex],
      isSold: true,
      updatedAt: new Date().toISOString(),
    };
    
    return mockAds[adIndex];
  },

  // Supprimer une annonce
  deleteAd: async (id: string): Promise<boolean> => {
    const adIndex = mockAds.findIndex(ad => ad.id === id);
    if (adIndex === -1) return false;
    
    mockAds.splice(adIndex, 1);
    return true;
  },
};

// Service mock pour les catégories
export const categoriesService = {
  getCategories: async () => {
    return [
      { id: 1, name: 'Véhicules', slug: 'vehicules', icon: 'car', color: '#FF6B35' },
      { id: 2, name: 'Immobilier', slug: 'immobilier', icon: 'home', color: '#1A936F' },
      { id: 3, name: 'Mode', slug: 'mode', icon: 'shirt', color: '#FFD166' },
      { id: 4, name: 'Multimédia', slug: 'multimedia', icon: 'tv', color: '#118AB2' },
      { id: 5, name: 'Maison', slug: 'maison', icon: 'bed', color: '#06D6A0' },
      { id: 6, name: 'Loisirs', slug: 'loisirs', icon: 'gamepad', color: '#EF476F' },
      { id: 7, name: 'Services', slug: 'services', icon: 'briefcase', color: '#073B4C' },
      { id: 8, name: 'Animaux', slug: 'animaux', icon: 'paw', color: '#8338EC' },
      { id: 9, name: 'Emploi', slug: 'emploi', icon: 'suitcase', color: '#3A86FF' },
      { id: 10, name: 'Autres', slug: 'autres', icon: 'grid', color: '#8AC926' },
    ];
  },

  getSubcategories: async (parentId: number) => {
    const subcategories: Record<number, any[]> = {
      1: [ // Véhicules
        { id: 11, name: 'Voitures', parentId: 1 },
        { id: 12, name: 'Motos', parentId: 1 },
        { id: 13, name: 'Utilitaires', parentId: 1 },
        { id: 14, name: 'Caravaning', parentId: 1 },
      ],
      2: [ // Immobilier
        { id: 21, name: 'Ventes', parentId: 2 },
        { id: 22, name: 'Locations', parentId: 2 },
        { id: 23, name: 'Colocations', parentId: 2 },
      ],
      4: [ // Multimédia
        { id: 41, name: 'Téléphones', parentId: 4 },
        { id: 42, name: 'Ordinateurs', parentId: 4 },
        { id: 43, name: 'Électronique', parentId: 4 },
      ],
      5: [ // Maison
        { id: 51, name: 'Meubles', parentId: 5 },
        { id: 52, name: 'Électroménager', parentId: 5 },
        { id: 53, name: 'Décoration', parentId: 5 },
      ],
    };
    
    return subcategories[parentId] || [];
  },
};