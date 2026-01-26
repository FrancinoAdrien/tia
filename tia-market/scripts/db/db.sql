-- ============================================
-- FICHIER PRINCIPAL : TIA MARKET DATABASE
-- ============================================
-- Contient la structure initiale + toutes les migrations
-- ============================================

-- Supprimer la base existante si elle existe (optionnel)
DROP DATABASE IF EXISTS tia_market;

-- Créer la base de données
CREATE DATABASE tia_market;
\c tia_market;

-- Activer l'extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table des utilisateurs (gardée telle quelle, elle est parfaite)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    is_premium BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_premium TIMESTAMP
);

-- Table des profils utilisateurs
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY,
    avatar_url TEXT,
    city VARCHAR(100),
    bio TEXT,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_ratings INTEGER DEFAULT 0,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des catégories (améliorée)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50),
    parent_id INTEGER,
    description TEXT,
    color VARCHAR(7) DEFAULT '#1B5E20',
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Table des annonces (améliorée)
CREATE TABLE ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10,2),
    price_negotiable BOOLEAN DEFAULT FALSE,
    condition VARCHAR(20) CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    city VARCHAR(100),
    postal_code VARCHAR(10),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT TRUE,
    is_sold BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Table des images d'annonces
CREATE TABLE ad_images (
    id SERIAL PRIMARY KEY,
    ad_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- Table des favoris
CREATE TABLE favorites (
    user_id UUID,
    ad_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, ad_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- Table des recherches sauvegardées (nouvelle)
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

-- Table des signalements (nouvelle)
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

-- Table des transactions (nouvelle - pour le suivi des ventes)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
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

-- Table conversations
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

-- Table messages (version améliorée avec conversation_id)
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

-- Table des notifications (version améliorée avec related_id pour bookings)
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

-- Table pour les annonces de réservation (restaurants, hôtels)
CREATE TABLE reservation_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'restaurant', 'hotel', 'other'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price_per_unit DECIMAL(10, 2),
    unit_type VARCHAR(50), -- 'per_person', 'per_room', 'per_service'
    available_from_date DATE,
    available_to_date DATE,
    is_open_24h BOOLEAN DEFAULT FALSE,
    opening_time VARCHAR(5), -- HH:MM format
    closing_time VARCHAR(5), -- HH:MM format
    capacity INTEGER,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    location VARCHAR(255),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    features JSONB DEFAULT '[]', -- Array of feature strings: 'WiFi', 'Parking', 'Climatisation', etc.
    images JSONB DEFAULT '[]', -- Array of image URLs
    is_active BOOLEAN DEFAULT TRUE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des réservations d'annonces (Booking System)
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'paid', 'completed', 'cancelled')),
    message TEXT,
    payment_method VARCHAR(50),
    payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Données de base pour les catégories
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

-- Create test users
INSERT INTO users (email, password_hash, first_name, last_name, phone, is_premium) VALUES
('seller@tia-market.mg', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Jean', 'Seller', '+261321234567', true),
('buyer@tia-market.mg', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Marie', 'Buyer', '+261321234568', false),
('user3@tia-market.mg', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Pierre', 'User', '+261321234569', false);

-- Create user profiles
INSERT INTO user_profiles (id, avatar_url, city, bio, rating)
SELECT id, 'https://i.pravatar.cc/150?img=1', 'Antananarivo', 'Utilisateur de test', 4.5
FROM users;

-- Création des index pour les performances
CREATE INDEX idx_ads_user_id ON ads(user_id);
CREATE INDEX idx_ads_category_id ON ads(category_id);
CREATE INDEX idx_ads_city ON ads(city);
CREATE INDEX idx_ads_price ON ads(price);
CREATE INDEX idx_ads_created_at ON ads(created_at DESC);
CREATE INDEX idx_ads_is_active ON ads(is_active) WHERE is_active = true;
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_ad_images_ad_id ON ad_images(ad_id);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour mettre à jour automatiquement updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON ads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vue pour les annonces avec informations utilisateur (CORRIGÉE)
CREATE OR REPLACE VIEW ads_with_user AS
SELECT 
    a.*,
    u.first_name,
    u.last_name,
    u.phone,
    up.city as user_city,
    up.avatar_url,
    up.rating as user_rating,
    c.name as category_name,
    c.slug as category_slug,
    (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as primary_image,
    COUNT(f.ad_id) as favorite_count
FROM ads a
LEFT JOIN users u ON a.user_id = u.id
LEFT JOIN user_profiles up ON u.id = up.id
LEFT JOIN categories c ON a.category_id = c.id
LEFT JOIN favorites f ON a.id = f.ad_id
GROUP BY a.id, u.id, up.id, c.id;

-- Test data for ads
INSERT INTO ads (user_id, category_id, title, description, price, condition, city, is_active, is_featured, view_count)
SELECT 
  (SELECT id FROM users LIMIT 1),
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
  true,
  c.id <= 3, -- Les 3 premières catégories sont featured
  floor(random() * 1000)
FROM categories c
WHERE c.parent_id IS NULL
LIMIT 50;

-- Add test images
INSERT INTO ad_images (ad_id, image_url, is_primary)
SELECT 
  a.id,
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
  true
FROM ads a
ON CONFLICT DO NOTHING;

-- Create indexes for messaging
CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- Create function get_or_create_conversation
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
    -- Ordonner les IDs pour éviter les doublons
    IF p_user1_id < p_user2_id THEN
        v_smaller_user_id := p_user1_id;
        v_larger_user_id := p_user2_id;
    ELSE
        v_smaller_user_id := p_user2_id;
        v_larger_user_id := p_user1_id;
    END IF;

    -- Chercher une conversation existante
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE ad_id = p_ad_id 
      AND user1_id = v_smaller_user_id 
      AND user2_id = v_larger_user_id;

    -- Créer une nouvelle conversation si elle n'existe pas
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (ad_id, user1_id, user2_id)
        VALUES (p_ad_id, v_smaller_user_id, v_larger_user_id)
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Test data for conversations and messages
INSERT INTO conversations (ad_id, user1_id, user2_id, last_message_content) 
SELECT 
    a.id,
    (SELECT id FROM users ORDER BY created_at LIMIT 1),
    (SELECT id FROM users ORDER BY created_at DESC LIMIT 1),
    'Bonjour, je suis intéressé par votre annonce'
FROM ads a
LIMIT 3;

INSERT INTO messages (conversation_id, sender_id, content)
SELECT 
    c.id,
    (SELECT id FROM users ORDER BY created_at LIMIT 1),
    'Bonjour, votre annonce m''intéresse'
FROM conversations c
LIMIT 3;

-- Index for reservation_ads
CREATE INDEX idx_reservation_ads_user_id ON reservation_ads(user_id);
CREATE INDEX idx_reservation_ads_type ON reservation_ads(type);
CREATE INDEX idx_reservation_ads_created_at ON reservation_ads(created_at DESC);

-- Index for bookings
CREATE INDEX idx_bookings_seller ON bookings(seller_id, created_at DESC);
CREATE INDEX idx_bookings_buyer ON bookings(buyer_id, created_at DESC);
CREATE INDEX idx_bookings_ad ON bookings(ad_id, status);
CREATE INDEX idx_bookings_status ON bookings(status, created_at DESC);

-- Unique index for pending/accepted bookings only
CREATE UNIQUE INDEX idx_bookings_unique_active ON bookings(ad_id, buyer_id) WHERE status IN ('pending', 'accepted');

-- ============================================
-- MIGRATION 1: Ajouter les statuts 'delivered' et 'delivery_confirmed' à la table bookings
-- ============================================

-- Étape 1: Supprimer la contrainte CHECK existante
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Étape 2: Ajouter la nouvelle contrainte CHECK avec les nouveaux statuts
ALTER TABLE bookings 
ADD CONSTRAINT bookings_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'delivered', 'delivery_confirmed', 'paid', 'completed', 'cancelled'));

-- Ajouter une colonne pour le numéro de téléphone du vendeur (pour Mobile Money)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seller_phone VARCHAR(20);

-- ============================================
-- MIGRATION 2: Ajouter le rating aux utilisateurs
-- ============================================

-- 1. Ajouter les colonnes manquantes à la table users pour simplifier les requêtes
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- 2. Synchroniser les données existantes depuis user_profiles
UPDATE users u
SET 
    rating = COALESCE(up.rating, 0.00),
    rating_count = COALESCE(up.total_ratings, 0)
FROM user_profiles up
WHERE u.id = up.id;

-- 3. Créer un trigger pour maintenir les données synchronisées
-- CREATE OR REPLACE FUNCTION sync_user_ratings()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- Si on met à jour user_profiles, synchroniser vers users
--     IF TG_TABLE_NAME = 'user_profiles' THEN
--         UPDATE users 
--         SET 
--             rating = COALESCE(NEW.rating, 0.00),
--             rating_count = COALESCE(NEW.total_ratings, 0)
--         WHERE id = NEW.id;
--     -- Si on met à jour users, synchroniser vers user_profiles
--     ELSIF TG_TABLE_NAME = 'users' THEN
--         UPDATE user_profiles 
--         SET 
--             rating = COALESCE(NEW.rating, 0.00),
--             total_ratings = COALESCE(NEW.rating_count, 0)
--         WHERE id = NEW.id;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- 4. Créer les triggers de synchronisation
DROP TRIGGER IF EXISTS sync_ratings_to_users ON user_profiles;
CREATE TRIGGER sync_ratings_to_users
    AFTER INSERT OR UPDATE OF rating, total_ratings ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_ratings();

DROP TRIGGER IF EXISTS sync_ratings_to_profiles ON users;
CREATE TRIGGER sync_ratings_to_profiles
    AFTER INSERT OR UPDATE OF rating, rating_count ON users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_ratings();

-- 5. Re-créer la vue ads_with_user avec les bons noms de colonnes
CREATE OR REPLACE VIEW ads_with_user AS
SELECT 
    a.*,
    u.first_name,
    u.last_name,
    u.phone,
    u.rating as user_rating,          -- ← Maintenant disponible dans users
    u.rating_count as user_rating_count, -- ← Maintenant disponible dans users
    up.city as user_city,
    up.avatar_url,
    c.name as category_name,
    c.slug as category_slug,
    (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as primary_image,
    COUNT(f.ad_id) as favorite_count
FROM ads a
LEFT JOIN users u ON a.user_id = u.id
LEFT JOIN user_profiles up ON u.id = up.id
LEFT JOIN categories c ON a.category_id = c.id
LEFT JOIN favorites f ON a.id = f.ad_id
GROUP BY a.id, u.id, up.id, c.id;

-- 6. Optionnel: Mettre à jour les users qui n'ont pas de user_profiles
INSERT INTO user_profiles (id, avatar_url, city, bio, rating, total_ratings)
SELECT 
    u.id,
    'https://i.pravatar.cc/150?img=1',
    'Antananarivo',
    'Utilisateur Tia Market',
    u.rating,
    u.rating_count
FROM users u
WHERE u.id NOT IN (SELECT id FROM user_profiles);

-- ============================================
-- MIGRATION 3: Ajouter le système de wallet et les nouveaux plans premium
-- ============================================

-- 1. Ajouter le champ premium_plan à la table users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS premium_plan VARCHAR(20) CHECK (premium_plan IN ('starter', 'pro', 'enterprise', NULL));

-- 2. Créer la table wallet pour les comptes fictifs
CREATE TABLE IF NOT EXISTS wallet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    balance DECIMAL(12, 2) DEFAULT 0.00 CHECK (balance >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Créer la table wallet_transactions pour l'historique
CREATE TABLE IF NOT EXISTS wallet_transactions (
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

-- 4. Ajouter le champ quantity à la table ads
ALTER TABLE ads 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 CHECK (quantity >= 0);

-- 5. Ajouter le champ sold_quantity à la table ads pour suivre les ventes
ALTER TABLE ads 
ADD COLUMN IF NOT EXISTS sold_quantity INTEGER DEFAULT 0 CHECK (sold_quantity >= 0);

-- 6. Créer un index pour les transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id, created_at DESC);

-- 7. Créer un trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wallet_updated_at BEFORE UPDATE ON wallet
    FOR EACH ROW EXECUTE FUNCTION update_wallet_updated_at();

CREATE TRIGGER update_wallet_transactions_updated_at BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION update_wallet_updated_at();

-- 8. Fonction pour créer automatiquement un wallet lors de la création d'un utilisateur
CREATE OR REPLACE FUNCTION create_wallet_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallet (user_id, balance) VALUES (NEW.id, 0.00);
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_create_wallet ON users;

-- Créer le trigger
CREATE TRIGGER trigger_create_wallet
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_wallet_for_user();

-- 9. Créer des wallets pour les utilisateurs existants qui n'en ont pas
INSERT INTO wallet (user_id, balance)
SELECT id, 0.00
FROM users
WHERE id NOT IN (SELECT user_id FROM wallet)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- MIGRATION 4: Ajouter le système de points, crédits, et fonctionnalités premium avancées
-- ============================================

-- 1. Ajouter le système de points utilisateur
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0 CHECK (points >= 0);

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS credits DECIMAL(12, 2) DEFAULT 0.00 CHECK (credits >= 0);

-- 2. Table pour l'historique des points
CREATE TABLE IF NOT EXISTS user_points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    points INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('daily_login', 'review', 'subscription', 'referral', 'beta', 'reward_claimed')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Ajouter les champs pour les annonces premium
ALTER TABLE ads 
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;

ALTER TABLE ads 
ADD COLUMN IF NOT EXISTS featured_until TIMESTAMP;

ALTER TABLE ads 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

ALTER TABLE ads 
ADD COLUMN IF NOT EXISTS max_photos INTEGER DEFAULT 5;

-- 4. Table pour les crédits "À la une" gratuits (pour packs Pro/Entreprise)
CREATE TABLE IF NOT EXISTS user_featured_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    credits_remaining INTEGER DEFAULT 0 CHECK (credits_remaining >= 0),
    last_reset_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- 5. Table pour les transactions de crédits (achats de fonctionnalités)
CREATE TABLE IF NOT EXISTS credit_transactions (
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

-- 6. Créer des index
CREATE INDEX IF NOT EXISTS idx_user_points_history_user ON user_points_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_featured_until ON ads(featured_until) WHERE featured_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ads_expires_at ON ads(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);

-- 7. Fonction pour réinitialiser les crédits "À la une" mensuels (pour packs Pro)
CREATE OR REPLACE FUNCTION reset_monthly_featured_credits()
RETURNS void AS $$
BEGIN
    -- Réinitialiser les crédits pour les utilisateurs Pro (5 crédits/mois)
    UPDATE user_featured_credits
    SET credits_remaining = 5,
        last_reset_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id IN (
        SELECT u.id FROM users u
        WHERE u.is_premium = true 
        AND u.premium_plan = 'pro'
        AND (ufc.last_reset_date IS NULL OR ufc.last_reset_date < DATE_TRUNC('month', CURRENT_DATE))
    )
    FROM user_featured_credits ufc
    WHERE user_featured_credits.user_id = ufc.user_id;
    
    -- Créer les crédits pour les nouveaux utilisateurs Pro qui n'en ont pas
    INSERT INTO user_featured_credits (user_id, credits_remaining, last_reset_date)
    SELECT u.id, 5, CURRENT_DATE
    FROM users u
    WHERE u.is_premium = true 
    AND u.premium_plan = 'pro'
    AND u.id NOT IN (SELECT user_id FROM user_featured_credits)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 8. Créer un trigger pour mettre à jour expires_at lors de la création d'une annonce
CREATE OR REPLACE FUNCTION set_ad_expiration()
RETURNS TRIGGER AS $$
BEGIN
    -- Si expires_at n'est pas défini, le définir à 30 jours
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at = NEW.created_at + INTERVAL '30 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_ad_expiration ON ads;
CREATE TRIGGER trigger_set_ad_expiration
    BEFORE INSERT ON ads
    FOR EACH ROW
    EXECUTE FUNCTION set_ad_expiration();

-- 9. Initialiser expires_at pour les annonces existantes
UPDATE ads 
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- ============================================
-- VÉRIFICATION FINALE
-- ============================================

-- Vérification: Afficher les contraintes pour confirmer
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
AND conname = 'bookings_status_check';

-- Vérifications diverses
SELECT 'Migration terminée avec succès!' as status;
SELECT COUNT(*) as users_avec_rating FROM users WHERE rating > 0;
SELECT COUNT(*) as users_avec_rating_count FROM users WHERE rating_count > 0;
SELECT COUNT(*) as users_avec_points FROM users WHERE points > 0;
SELECT COUNT(*) as wallets_crees FROM wallet;
SELECT COUNT(*) as users_avec_wallet FROM (SELECT DISTINCT user_id FROM wallet) t;