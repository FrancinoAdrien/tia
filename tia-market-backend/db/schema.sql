-- ============================================================================
-- TIA MARKET - SCHÉMA COMPLET DE BASE DE DONNÉES
-- Version: 2.0
-- Date: 2026-01-27
-- ============================================================================
-- Ce fichier contient l'intégralité du schéma de base de données incluant:
-- - Tables utilisateurs avec système premium
-- - Tables annonces avec ratings et commentaires
-- - Système de favoris et recherches
-- - Tables de transactions et conversations
-- - Système de wallet et crédits
-- - Tables de prix premium
-- ============================================================================

-- Supprimer la base existante si elle existe (optionnel)
DROP DATABASE IF EXISTS tia_market;

-- Créer la base de données
CREATE DATABASE tia_market;
\c tia_market;

-- Activer l'extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TYPES ENUM
-- ============================================================================
CREATE TYPE premium_pack AS ENUM ('simple', 'starter', 'pro', 'entreprise');
CREATE TYPE badge_type AS ENUM ('none', 'verified_seller', 'premium_business');

-- ============================================================================
-- TABLE DES PRIX PREMIUM (NOUVEAU)
-- ============================================================================
CREATE TABLE premium_pricing (
    id SERIAL PRIMARY KEY,
    pack_name premium_pack NOT NULL UNIQUE,
    price_ar DECIMAL(10,2) NOT NULL, -- Prix en Ariary
    price_usd DECIMAL(10,2), -- Prix en USD (optionnel)
    duration_days INTEGER DEFAULT 30, -- Durée en jours
    features JSONB DEFAULT '[]', -- Liste des fonctionnalités
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insérer les prix par défaut
INSERT INTO premium_pricing (pack_name, price_ar, price_usd, duration_days, features) VALUES
('starter', 49000.00, 10.00, 30, '[
    "10 annonces simultanées",
    "5 photos par annonce",
    "Messagerie illimitée",
    "Badge \"Vendeur vérifié\"",
    "Statistiques de base"
]'::jsonb),
('pro', 99000.00, 20.00, 30, '[
    "50 annonces simultanées",
    "15 photos par annonce",
    "Messagerie prioritaire",
    "Badge \"Vendeur Pro\"",
    "Statistiques avancées",
    "5 annonces à la une gratuites/mois",
    "Remontée automatique des annonces"
]'::jsonb),
('entreprise', 199000.00, 40.00, 30, '[
    "Annonces illimitées",
    "30 photos par annonce",
    "Messagerie prioritaire VIP",
    "Badge \"Entreprise Premium\"",
    "Statistiques complètes",
    "15 annonces à la une gratuites/mois",
    "Multi-comptes (5 utilisateurs)",
    "Remontée automatique",
    "Support prioritaire"
]'::jsonb);

-- ============================================================================
-- TABLE DES UTILISATEURS
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    
    -- Système de packs premium
    premium_pack premium_pack DEFAULT 'simple',
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    badge badge_type DEFAULT 'none',
    
    -- Vérifications (pour futures implémentations)
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    email_verification_token TEXT,
    phone_verification_code VARCHAR(6),
    verification_code_expires_at TIMESTAMP,
    
    -- OAuth Google (pour future implémentation)
    google_id VARCHAR(255),
    google_profile_picture TEXT,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    premium_start_date TIMESTAMP,
    premium_end_date TIMESTAMP,
    last_login_at TIMESTAMP,
    
    -- Compteurs de ressources utilisées
    ads_count INTEGER DEFAULT 0,
    featured_ads_used INTEGER DEFAULT 0,
    ad_modifications_used INTEGER DEFAULT 0,
    boost_count_used INTEGER DEFAULT 0,
    
    -- Système de points et crédits
    points INTEGER DEFAULT 0 CHECK (points >= 0),
    credits DECIMAL(12, 2) DEFAULT 0.00 CHECK (credits >= 0),
    
    -- Compte d'entreprise (pour pack entreprise uniquement)
    is_company_account BOOLEAN DEFAULT FALSE,
    company_owner_id UUID REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES PROFILS UTILISATEURS
-- ============================================================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY,
    avatar_url TEXT,
    city VARCHAR(100),
    bio TEXT,
    
    -- Système de notation (note initiale 2.5)
    rating DECIMAL(3,2) DEFAULT 2.50,
    total_ratings INTEGER DEFAULT 0,
    rating_sum INTEGER DEFAULT 0, -- Somme totale des notes pour calculer la moyenne
    
    -- Préférences de notification
    notify_new_messages BOOLEAN DEFAULT TRUE,
    notify_new_ads BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES WALLETS (PORTEFEUILLES VIRTUELS)
-- ============================================================================
CREATE TABLE wallet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    balance DECIMAL(12, 2) DEFAULT 0.00 CHECK (balance >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES TRANSACTIONS WALLET
-- ============================================================================
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL,
    user_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_id) REFERENCES wallet(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DE L'HISTORIQUE DES POINTS
-- ============================================================================
CREATE TABLE user_points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    points INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('daily_login', 'review', 'subscription', 'referral', 'beta', 'reward_claimed')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES CRÉDITS FEATURED GRATUITS
-- ============================================================================
CREATE TABLE user_featured_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    credits_remaining INTEGER DEFAULT 0 CHECK (credits_remaining >= 0),
    last_reset_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- ============================================================================
-- TABLE DES TRANSACTIONS DE CRÉDITS
-- ============================================================================
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ad_id UUID,
    type VARCHAR(50) NOT NULL CHECK (type IN ('featured_7d', 'featured_14d', 'urgent', 'extra_photos_5', 'extra_photos_15', 'renew_30d', 'renew_150d')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE SET NULL
);

-- ============================================================================
-- TABLE DES MEMBRES D'ENTREPRISE
-- ============================================================================
CREATE TABLE company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_account_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member'
    can_post_ads BOOLEAN DEFAULT TRUE,
    can_edit_ads BOOLEAN DEFAULT TRUE,
    can_manage_members BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by UUID REFERENCES users(id),
    
    UNIQUE(company_account_id, user_id)
);

-- ============================================================================
-- TABLE DES CATÉGORIES
-- ============================================================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50),
    parent_id INTEGER,
    description TEXT,
    color VARCHAR(7) DEFAULT '#1B5E20',
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES ANNONCES
-- ============================================================================
CREATE TABLE ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category_id INT NOT NULL,
    
    -- Informations de base
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10,2),
    price_negotiable BOOLEAN DEFAULT FALSE,
    condition VARCHAR(20) CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    
    -- Quantité disponible
    quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
    sold_quantity INTEGER DEFAULT 0 CHECK (sold_quantity >= 0),
    
    -- Localisation
    city VARCHAR(100),
    postal_code VARCHAR(10),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    
    -- Statuts
    is_active BOOLEAN DEFAULT TRUE,
    is_sold BOOLEAN DEFAULT FALSE,
    
    -- Système de mise à la une (featured)
    is_featured BOOLEAN DEFAULT FALSE,
    featured_until TIMESTAMP,
    featured_days INTEGER DEFAULT 0,
    
    -- Urgence
    is_urgent BOOLEAN DEFAULT FALSE,
    
    -- Photos
    max_photos INTEGER DEFAULT 5,
    
    -- Compteurs
    view_count INTEGER DEFAULT 0,
    modification_count INTEGER DEFAULT 0,
    boost_count INTEGER DEFAULT 0,
    
    -- Note moyenne de l'annonce
    rating_avg DECIMAL(3,2) DEFAULT 0.00,
    rating_count INTEGER DEFAULT 0,
    
    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_boosted_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- ============================================================================
-- TABLE DES IMAGES D'ANNONCES
-- ============================================================================
CREATE TABLE ad_images (
    id SERIAL PRIMARY KEY,
    ad_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES COMMENTAIRES SUR LES ANNONCES
-- ============================================================================
CREATE TABLE ad_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL,
    user_id UUID NOT NULL,
    comment TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Note de 1 à 5 étoiles
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Un utilisateur ne peut commenter qu'une fois par annonce
    UNIQUE(ad_id, user_id)
);

-- ============================================================================
-- TABLE DES ÉVALUATIONS UTILISATEURS
-- ============================================================================
CREATE TABLE user_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rated_user_id UUID NOT NULL,
    rater_user_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    transaction_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (rated_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rater_user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE(rated_user_id, rater_user_id, transaction_id)
);

-- ============================================================================
-- TABLE DES FAVORIS
-- ============================================================================
CREATE TABLE favorites (
    user_id UUID,
    ad_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, ad_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES STATISTIQUES DÉTAILLÉES
-- ============================================================================
CREATE TABLE ad_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL,
    date DATE NOT NULL,
    views_count INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    messages_count INTEGER DEFAULT 0,
    phone_views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
    UNIQUE(ad_id, date)
);

-- ============================================================================
-- TABLE DES PAIEMENTS DE REMONTÉE (BOOST)
-- ============================================================================
CREATE TABLE boost_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ad_id UUID NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    boost_count INTEGER NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES RECHERCHES SAUVEGARDÉES
-- ============================================================================
CREATE TABLE saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(100),
    query TEXT NOT NULL,
    filters JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES SIGNALEMENTS
-- ============================================================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL,
    reported_ad_id UUID,
    reported_user_id UUID,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id),
    FOREIGN KEY (reported_ad_id) REFERENCES ads(id) ON DELETE SET NULL,
    FOREIGN KEY (reported_user_id) REFERENCES users(id)
);

-- ============================================================================
-- TABLE DES TRANSACTIONS
-- ============================================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'delivered')),
    meeting_location TEXT,
    meeting_time TIMESTAMP,
    rating_from_buyer INTEGER CHECK (rating_from_buyer IS NULL OR (rating_from_buyer >= 1 AND rating_from_buyer <= 5)),
    rating_from_seller INTEGER CHECK (rating_from_seller IS NULL OR (rating_from_seller >= 1 AND rating_from_seller <= 5)),
    review_from_buyer TEXT,
    review_from_seller TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES ads(id),
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- ============================================================================
-- TABLE DES CONVERSATIONS
-- ============================================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID,
    user1_id UUID NOT NULL,
    user2_id UUID NOT NULL,
    last_message_content TEXT,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user1_unread_count INTEGER DEFAULT 0,
    user2_unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id),
    UNIQUE(ad_id, user1_id, user2_id)
);

-- ============================================================================
-- TABLE DES MESSAGES
-- ============================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- ============================================================================
-- TABLE DES NOTIFICATIONS
-- ============================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id UUID,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES ANNONCES DE RÉSERVATION
-- ============================================================================
CREATE TABLE reservation_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price_per_unit DECIMAL(10, 2),
    unit_type VARCHAR(50),
    available_from_date DATE,
    available_to_date DATE,
    is_open_24h BOOLEAN DEFAULT FALSE,
    opening_time VARCHAR(5),
    closing_time VARCHAR(5),
    capacity INTEGER,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    location VARCHAR(255),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    features JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE DES RÉSERVATIONS
-- ============================================================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'paid', 'completed', 'cancelled', 'delivered', 'delivery_confirmed')),
    message TEXT,
    payment_method VARCHAR(50),
    payment_date TIMESTAMP,
    seller_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEX POUR LES PERFORMANCES
-- ============================================================================
CREATE INDEX idx_ads_user_id ON ads(user_id);
CREATE INDEX idx_ads_category_id ON ads(category_id);
CREATE INDEX idx_ads_city ON ads(city);
CREATE INDEX idx_ads_price ON ads(price);
CREATE INDEX idx_ads_created_at ON ads(created_at DESC);
CREATE INDEX idx_ads_is_active ON ads(is_active) WHERE is_active = true;
CREATE INDEX idx_ads_is_featured ON ads(is_featured) WHERE is_featured = true;
CREATE INDEX idx_ads_featured_until ON ads(featured_until) WHERE featured_until IS NOT NULL;
CREATE INDEX idx_ads_is_urgent ON ads(is_urgent) WHERE is_urgent = true;
CREATE INDEX idx_ads_expires_at ON ads(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_ads_sold_quantity ON ads(sold_quantity);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_ad_id ON favorites(ad_id);
CREATE INDEX idx_ad_images_ad_id ON ad_images(ad_id);
CREATE INDEX idx_ad_comments_ad_id ON ad_comments(ad_id);
CREATE INDEX idx_ad_comments_user_id ON ad_comments(user_id);
CREATE INDEX idx_user_ratings_rated_user ON user_ratings(rated_user_id);
CREATE INDEX idx_user_ratings_rater_user ON user_ratings(rater_user_id);
CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_reservation_ads_user_id ON reservation_ads(user_id);
CREATE INDEX idx_reservation_ads_type ON reservation_ads(type);
CREATE INDEX idx_reservation_ads_created_at ON reservation_ads(created_at DESC);
CREATE INDEX idx_bookings_seller ON bookings(seller_id, created_at DESC);
CREATE INDEX idx_bookings_buyer ON bookings(buyer_id, created_at DESC);
CREATE INDEX idx_bookings_ad ON bookings(ad_id, status);
CREATE INDEX idx_bookings_status ON bookings(status, created_at DESC);
CREATE INDEX idx_company_members_company ON company_members(company_account_id);
CREATE INDEX idx_ad_statistics_ad_date ON ad_statistics(ad_id, date);
CREATE INDEX idx_boost_payments_user ON boost_payments(user_id);
CREATE INDEX idx_boost_payments_ad ON boost_payments(ad_id);
CREATE INDEX idx_user_points_history_user ON user_points_history(user_id, created_at DESC);
CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_wallet_transactions_user ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_email_verified ON users(email_verified) WHERE email_verified = true;
CREATE INDEX idx_users_phone_verified ON users(phone_verified) WHERE phone_verified = true;

-- Index unique pour les bookings actifs
CREATE UNIQUE INDEX idx_bookings_unique_active ON bookings(ad_id, buyer_id) WHERE status IN ('pending', 'accepted');

-- ============================================================================
-- FONCTIONS ET TRIGGERS
-- ============================================================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON ads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ad_comments_updated_at BEFORE UPDATE ON ad_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_updated_at BEFORE UPDATE ON wallet
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_transactions_updated_at BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_featured_credits_updated_at BEFORE UPDATE ON user_featured_credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_premium_pricing_updated_at BEFORE UPDATE ON premium_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour calculer la note moyenne d'un utilisateur
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_profiles
    SET 
        total_ratings = (SELECT COUNT(*) FROM user_ratings WHERE rated_user_id = NEW.rated_user_id),
        rating_sum = (SELECT SUM(rating) FROM user_ratings WHERE rated_user_id = NEW.rated_user_id),
        rating = CASE 
            WHEN (SELECT COUNT(*) FROM user_ratings WHERE rated_user_id = NEW.rated_user_id) = 0 THEN 2.50
            ELSE (SELECT AVG(rating)::DECIMAL(3,2) FROM user_ratings WHERE rated_user_id = NEW.rated_user_id)
        END
    WHERE id = NEW.rated_user_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_user_rating
AFTER INSERT OR UPDATE ON user_ratings
FOR EACH ROW EXECUTE FUNCTION update_user_rating();

-- Fonction pour calculer la note moyenne d'une annonce
CREATE OR REPLACE FUNCTION update_ad_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ads
    SET 
        rating_count = (SELECT COUNT(*) FROM ad_comments WHERE ad_id = NEW.ad_id AND rating IS NOT NULL),
        rating_avg = COALESCE((SELECT AVG(rating)::DECIMAL(3,2) FROM ad_comments WHERE ad_id = NEW.ad_id AND rating IS NOT NULL), 0.00)
    WHERE id = NEW.ad_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_ad_rating
AFTER INSERT OR UPDATE ON ad_comments
FOR EACH ROW EXECUTE FUNCTION update_ad_rating();

-- Fonction pour créer automatiquement un wallet
CREATE OR REPLACE FUNCTION create_wallet_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallet (user_id, balance) VALUES (NEW.id, 0.00);
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_create_wallet
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_wallet_for_user();

-- Fonction pour définir expires_at automatiquement
CREATE OR REPLACE FUNCTION set_ad_expiration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at = NEW.created_at + INTERVAL '30 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_ad_expiration
    BEFORE INSERT ON ads
    FOR EACH ROW
    EXECUTE FUNCTION set_ad_expiration();

-- Fonction pour réinitialiser les crédits featured mensuels
CREATE OR REPLACE FUNCTION reset_monthly_featured_credits()
RETURNS void AS $$
BEGIN
    -- Réinitialiser les crédits pour les utilisateurs Pro
    UPDATE user_featured_credits ufc
    SET credits_remaining = 5,
        last_reset_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id IN (
        SELECT u.id FROM users u
        WHERE u.premium_pack = 'pro'
        AND (ufc.last_reset_date IS NULL OR ufc.last_reset_date < DATE_TRUNC('month', CURRENT_DATE))
    );

    -- Créer les crédits pour les nouveaux utilisateurs Pro
    INSERT INTO user_featured_credits (user_id, credits_remaining, last_reset_date)
    SELECT u.id, 5, CURRENT_DATE
    FROM users u
    WHERE u.premium_pack = 'pro'
    AND u.id NOT IN (SELECT user_id FROM user_featured_credits)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Réinitialiser les crédits pour les utilisateurs Entreprise
    UPDATE user_featured_credits ufc
    SET credits_remaining = 15,
        last_reset_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id IN (
        SELECT u.id FROM users u
        WHERE u.premium_pack = 'entreprise'
        AND (ufc.last_reset_date IS NULL OR ufc.last_reset_date < DATE_TRUNC('month', CURRENT_DATE))
    );

    -- Créer les crédits pour les nouveaux utilisateurs Entreprise
    INSERT INTO user_featured_credits (user_id, credits_remaining, last_reset_date)
    SELECT u.id, 15, CURRENT_DATE
    FROM users u
    WHERE u.premium_pack = 'entreprise'
    AND u.id NOT IN (SELECT user_id FROM user_featured_credits)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour gérer les conversations
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_ad_id UUID,
    p_user1_id UUID,
    p_user2_id UUID
) RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_smaller_user_id UUID;
    v_larger_user_id UUID;
BEGIN
    IF p_user1_id < p_user2_id THEN
        v_smaller_user_id := p_user1_id;
        v_larger_user_id := p_user2_id;
    ELSE
        v_smaller_user_id := p_user2_id;
        v_larger_user_id := p_user1_id;
    END IF;

    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE ad_id = p_ad_id 
      AND user1_id = v_smaller_user_id 
      AND user2_id = v_larger_user_id;

    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (ad_id, user1_id, user2_id)
        VALUES (p_ad_id, v_smaller_user_id, v_larger_user_id)
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VUE POUR LES ANNONCES AVEC INFORMATIONS UTILISATEUR
-- ============================================================================
CREATE VIEW ads_with_user AS
SELECT 
    a.*,
    u.first_name,
    u.last_name,
    u.phone,
    u.premium_pack,
    u.badge,
    up.city as user_city,
    up.avatar_url,
    up.rating as user_rating,
    c.name as category_name,
    c.slug as category_slug,
    (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as primary_image,
    COUNT(DISTINCT f.user_id) as favorite_count,
    ARRAY(SELECT image_url FROM ad_images WHERE ad_id = a.id ORDER BY is_primary DESC, position ASC) as all_images
FROM ads a
LEFT JOIN users u ON a.user_id = u.id
LEFT JOIN user_profiles up ON u.id = up.id
LEFT JOIN categories c ON a.category_id = c.id
LEFT JOIN favorites f ON a.id = f.ad_id
GROUP BY a.id, u.id, up.id, c.id;

-- ============================================================================
-- DONNÉES DE BASE - CATÉGORIES
-- ============================================================================
INSERT INTO categories (name, slug, icon, description, color) VALUES
('Véhicules', 'vehicules', 'car', 'Voitures, motos, utilitaires', '#FF6B35'),
('Immobilier', 'immobilier', 'home', 'Maisons, appartements, terrains', '#1A936F'),
('Mode', 'mode', 'shirt', 'Vêtements, chaussures, accessoires', '#FFD166'),
('Multimédia', 'multimedia', 'tv', 'High-tech, informatique, téléphonie', '#118AB2'),
('Maison', 'maison', 'bed', 'Meubles, électroménager, décoration', '#06D6A0'),
('Loisirs', 'loisirs', 'gamepad', 'Sport, jeux, musique, livres', '#EF476F'),
('Services', 'services', 'briefcase', 'Cours, réparations, événements', '#073B4C'),
('Animaux', 'animaux', 'paw', 'Animaux de compagnie, accessoires', '#8338EC'),
('Emploi', 'emploi', 'suitcase', 'Offres d''emploi, jobs étudiants', '#3A86FF'),
('Autres', 'autres', 'grid', 'Toutes les autres catégories', '#8AC926');

-- Sous-catégories pour Véhicules
INSERT INTO categories (name, slug, icon, parent_id, description) VALUES
('Voitures', 'voitures', 'car', 1, 'Voitures particulières'),
('Motos', 'motos', 'bike', 1, 'Motos, scooters, cyclomoteurs'),
('Utilitaires', 'utilitaires', 'truck', 1, 'Véhicules utilitaires'),
('Caravaning', 'caravaning', 'campground', 1, 'Caravanes, camping-cars'),
('Nautisme', 'nautisme', 'anchor', 1, 'Bateaux, jetski'),
('Equipement auto', 'equipement-auto', 'cog', 1, 'Pièces, accessoires auto');

-- Sous-catégories pour Immobilier
INSERT INTO categories (name, slug, icon, parent_id, description) VALUES
('Ventes', 'ventes-immobilier', 'key', 2, 'Maisons et appartements à vendre'),
('Locations', 'locations', 'door-open', 2, 'Maisons et appartements à louer'),
('Colocations', 'colocations', 'users', 2, 'Colocations et sous-locations'),
('Bureaux & Commerces', 'bureaux-commerces', 'store', 2, 'Locaux professionnels'),
('Terrains', 'terrains', 'tree', 2, 'Terrains à bâtir, agricoles');

-- ============================================================================
-- UTILISATEURS DE TEST
-- ============================================================================
INSERT INTO users (email, password_hash, first_name, last_name, phone, premium_pack, badge) VALUES
('simple@tia-market.mg', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Jean', 'Simple', '+261321234567', 'simple', 'none'),
('starter@tia-market.mg', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Marie', 'Starter', '+261321234568', 'starter', 'none'),
('pro@tia-market.mg', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Pierre', 'Pro', '+261321234569', 'pro', 'verified_seller'),
('entreprise@tia-market.mg', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Sophie', 'Entreprise', '+261321234570', 'entreprise', 'premium_business');

-- Créer les profils utilisateurs
INSERT INTO user_profiles (id, avatar_url, city, bio, rating, total_ratings, rating_sum)
SELECT id, 'https://i.pravatar.cc/150?img=1', 'Antananarivo', 'Utilisateur de test', 2.50, 0, 0
FROM users;

-- Créer des wallets pour les utilisateurs existants
INSERT INTO wallet (user_id, balance)
SELECT id, 0.00
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- DONNÉES DE TEST - ANNONCES
-- ============================================================================
INSERT INTO ads (user_id, category_id, title, description, price, condition, city, quantity, is_active, is_featured, view_count)
SELECT 
  (SELECT id FROM users WHERE email = 'pro@tia-market.mg' LIMIT 1),
  c.id,
  CASE 
    WHEN c.id = 1 THEN 'Peugeot 208 BlueHDi 75ch 2019'
    WHEN c.id = 2 THEN 'Appartement T3 centre ville'
    WHEN c.id = 3 THEN 'Veste en cuir véritable homme'
    WHEN c.id = 4 THEN 'iPhone 13 Pro Max 256Go'
    WHEN c.id = 5 THEN 'Canapé 3 places velours vert'
    ELSE 'Article de test ' || c.name
  END,
  'Description de test pour ' || c.name || '. Article en excellent état, parfaitement fonctionnel.',
  CASE 
    WHEN c.id = 1 THEN 12500
    WHEN c.id = 2 THEN 850
    WHEN c.id = 3 THEN 80
    WHEN c.id = 4 THEN 750
    WHEN c.id = 5 THEN 450
    ELSE 100 * c.id
  END,
  'good',
  CASE 
    WHEN c.id % 3 = 0 THEN 'Paris'
    WHEN c.id % 3 = 1 THEN 'Lyon'
    ELSE 'Marseille'
  END,
  CASE WHEN c.id <= 2 THEN 1 ELSE (c.id % 5) + 1 END,
  true,
  c.id <= 3,
  floor(random() * 1000)::INTEGER
FROM categories c
WHERE c.parent_id IS NULL
LIMIT 10;

-- Ajouter des images de test
INSERT INTO ad_images (ad_id, image_url, is_primary)
SELECT 
  a.id,
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
  true
FROM ads a
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MESSAGE FINAL
-- ============================================================================
SELECT '✅ Base de données TIA Market créée avec succès!' as status;
SELECT 'Tables créées:' as info, COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT 'Index créés:' as info, COUNT(*) as count FROM pg_indexes WHERE schemaname = 'public';
SELECT 'Fonctions créées:' as info, COUNT(*) as count FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
