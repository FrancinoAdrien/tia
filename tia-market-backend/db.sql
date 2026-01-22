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

-- Vue pour les annonces avec informations utilisateur
CREATE VIEW ads_with_user AS
SELECT 
    a.*,
    u.first_name,
    u.last_name,
    u.phone,
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

