// backend/premiumLimits.js
// Constantes pour les limites des différents packs premium

const PREMIUM_PACKS = {
  SIMPLE: 'simple',
  STARTER: 'starter',
  PRO: 'pro',
  ENTREPRISE: 'entreprise'
};

const BADGE_TYPES = {
  NONE: 'none',
  VERIFIED_SELLER: 'verified_seller',
  PREMIUM_BUSINESS: 'premium_business'
};

// Limites par pack
const PACK_LIMITS = {
  [PREMIUM_PACKS.SIMPLE]: {
    name: 'Simple',
    displayName: 'Utilisateur Gratuit',
    quantity_per_ad: 1,
    photos_per_ad: 3,
    max_simultaneous_ads: 5,
    featured_count: 0, // Pas de mise à la une
    featured_days: 0,
    modifications_per_ad: 0, // Pas de modifications gratuites
    free_boosts: 0,
    has_badge: false,
    badge_type: BADGE_TYPES.NONE,
    has_detailed_stats: false,
    ad_lifetime_days: 30, // Après 30 jours, doit payer pour remonter
    boost_price_single: 2000, // 2000 Ar pour 1 remontée
    boost_price_pack: 8000, // 8000 Ar pour 5 remontées
    boost_pack_count: 5,
    can_manage_members: false,
    max_team_members: 1
  },
  
  [PREMIUM_PACKS.STARTER]: {
    name: 'Starter',
    displayName: 'Pack Starter',
    quantity_per_ad: 10,
    photos_per_ad: 10,
    max_simultaneous_ads: 20,
    featured_count: 5, // 5 mises à la une
    featured_days: 7, // 7 jours par featured
    modifications_per_ad: 5, // 5 modifications par annonce
    free_boosts: 0,
    has_badge: false,
    badge_type: BADGE_TYPES.NONE,
    has_detailed_stats: false,
    ad_lifetime_days: null, // Pas de limite de temps
    boost_price_single: 2000,
    boost_price_pack: 8000,
    boost_pack_count: 5,
    can_manage_members: false,
    max_team_members: 1
  },
  
  [PREMIUM_PACKS.PRO]: {
    name: 'Pro',
    displayName: 'Pack Pro ⭐',
    quantity_per_ad: 20,
    photos_per_ad: 20,
    photos_unlimited_for_ads: 10, // 10 annonces avec photos illimitées
    max_simultaneous_ads: 50,
    featured_count: 10, // 10 mises à la une
    featured_days: 14, // 14 jours par featured
    modifications_per_ad: 15, // 15 modifications par annonce
    free_boosts: 5, // 5 remontées gratuites
    has_badge: true,
    badge_type: BADGE_TYPES.VERIFIED_SELLER,
    has_detailed_stats: true, // Accès aux statistiques détaillées
    ad_lifetime_days: null,
    boost_price_single: 2000,
    boost_price_pack: 8000,
    boost_pack_count: 5,
    can_manage_members: false,
    max_team_members: 1
  },
  
  [PREMIUM_PACKS.ENTREPRISE]: {
    name: 'Entreprise',
    displayName: 'Pack Entreprise 🏢',
    quantity_per_ad: -1, // -1 = illimité
    photos_per_ad: -1, // Illimité
    photos_unlimited_for_ads: -1,
    max_simultaneous_ads: -1, // Illimité
    featured_count: -1, // Illimité
    featured_days: 30, // 30 jours par featured (par défaut, mais peut être plus)
    modifications_per_ad: -1, // Illimité
    free_boosts: -1, // Remontées illimitées
    has_badge: true,
    badge_type: BADGE_TYPES.PREMIUM_BUSINESS,
    has_detailed_stats: true,
    ad_lifetime_days: null,
    boost_price_single: 0, // Gratuit
    boost_price_pack: 0,
    boost_pack_count: 0,
    can_manage_members: true, // Peut gérer une équipe
    max_team_members: 5 // 5 utilisateurs maximum
  }
};

// Fonctions helper pour vérifier les limites
const PackLimitChecker = {
  /**
   * Vérifie si l'utilisateur peut créer une nouvelle annonce
   */
  canCreateAd: (userPack, currentAdsCount) => {
    const limits = PACK_LIMITS[userPack];
    if (!limits) return false;
    
    // -1 signifie illimité
    if (limits.max_simultaneous_ads === -1) return true;
    
    return currentAdsCount < limits.max_simultaneous_ads;
  },

  /**
   * Vérifie si l'utilisateur peut uploader plus de photos
   */
  canUploadPhoto: (userPack, currentPhotoCount, adId = null) => {
    const limits = PACK_LIMITS[userPack];
    if (!limits) return false;
    
    // Illimité
    if (limits.photos_per_ad === -1) return true;
    
    return currentPhotoCount < limits.photos_per_ad;
  },

  /**
   * Vérifie si l'utilisateur peut modifier l'annonce
   */
  canModifyAd: (userPack, currentModificationCount) => {
    const limits = PACK_LIMITS[userPack];
    if (!limits) return false;
    
    // Illimité
    if (limits.modifications_per_ad === -1) return true;
    
    // Simple n'a pas de modifications
    if (limits.modifications_per_ad === 0) return false;
    
    return currentModificationCount < limits.modifications_per_ad;
  },

  /**
   * Vérifie si l'utilisateur peut mettre une annonce à la une
   */
  canFeatureAd: (userPack, currentFeaturedCount) => {
    const limits = PACK_LIMITS[userPack];
    if (!limits) return false;
    
    // Illimité
    if (limits.featured_count === -1) return true;
    
    // Simple n'a pas de featured
    if (limits.featured_count === 0) return false;
    
    return currentFeaturedCount < limits.featured_count;
  },

  /**
   * Vérifie si l'utilisateur peut remonter une annonce gratuitement
   */
  canBoostForFree: (userPack, currentBoostCount) => {
    const limits = PACK_LIMITS[userPack];
    if (!limits) return false;
    
    // Illimité
    if (limits.free_boosts === -1) return true;
    
    // Simple n'a pas de boost gratuit
    if (limits.free_boosts === 0) return false;
    
    return currentBoostCount < limits.free_boosts;
  },

  /**
   * Vérifie si l'utilisateur peut ajouter un membre à son équipe
   */
  canAddTeamMember: (userPack, currentMemberCount) => {
    const limits = PACK_LIMITS[userPack];
    if (!limits) return false;
    
    if (!limits.can_manage_members) return false;
    
    return currentMemberCount < limits.max_team_members;
  },

  /**
   * Récupère les limites pour un pack
   */
  getLimits: (userPack) => {
    return PACK_LIMITS[userPack] || PACK_LIMITS[PREMIUM_PACKS.SIMPLE];
  },

  /**
   * Récupère le nombre de jours de featured pour un pack
   */
  getFeaturedDays: (userPack) => {
    const limits = PACK_LIMITS[userPack];
    return limits ? limits.featured_days : 0;
  },

  /**
   * Calcule le prix d'une remontée
   */
  getBoostPrice: (userPack, boostCount = 1) => {
    const limits = PACK_LIMITS[userPack];
    if (!limits) return 0;
    
    // Pack entreprise : gratuit
    if (limits.boost_price_single === 0) return 0;
    
    // Pack de 5 remontées
    if (boostCount >= 5) {
      return limits.boost_price_pack;
    }
    
    // Prix unitaire
    return limits.boost_price_single * boostCount;
  },

  /**
   * Vérifie si l'utilisateur a accès aux statistiques détaillées
   */
  hasDetailedStats: (userPack) => {
    const limits = PACK_LIMITS[userPack];
    return limits ? limits.has_detailed_stats : false;
  },

  /**
   * Récupère le type de badge pour un pack
   */
  getBadgeType: (userPack) => {
    const limits = PACK_LIMITS[userPack];
    return limits ? limits.badge_type : BADGE_TYPES.NONE;
  },

  /**
   * Vérifie si une quantité est valide pour un pack
   */
  isValidQuantity: (userPack, quantity) => {
    const limits = PACK_LIMITS[userPack];
    if (!limits) return false;
    
    // Illimité
    if (limits.quantity_per_ad === -1) return true;
    
    return quantity <= limits.quantity_per_ad;
  },

  /**
   * Retourne un message d'erreur explicatif
   */
  getErrorMessage: (userPack, limitType) => {
    const limits = PACK_LIMITS[userPack];
    if (!limits) return "Pack premium invalide";
    
    const messages = {
      'ads': `Limite atteinte : vous pouvez avoir maximum ${limits.max_simultaneous_ads} annonces simultanées avec le pack ${limits.displayName}. Passez à un pack supérieur pour augmenter cette limite.`,
      'photos': `Limite atteinte : vous pouvez ajouter maximum ${limits.photos_per_ad} photos par annonce avec le pack ${limits.displayName}.`,
      'modifications': `Limite atteinte : vous pouvez modifier ${limits.modifications_per_ad} fois cette annonce avec le pack ${limits.displayName}.`,
      'featured': `Limite atteinte : vous avez utilisé toutes vos mises à la une (${limits.featured_count}) avec le pack ${limits.displayName}.`,
      'boosts': `Vous devez payer ${limits.boost_price_single} Ar pour remonter cette annonce.`,
      'team': `Limite atteinte : vous pouvez avoir maximum ${limits.max_team_members} membres dans votre équipe.`,
      'quantity': `Quantité invalide : maximum ${limits.quantity_per_ad} unités par annonce avec le pack ${limits.displayName}.`
    };
    
    return messages[limitType] || "Limite atteinte pour votre pack premium";
  }
};

module.exports = {
  PREMIUM_PACKS,
  BADGE_TYPES,
  PACK_LIMITS,
  PackLimitChecker
};
