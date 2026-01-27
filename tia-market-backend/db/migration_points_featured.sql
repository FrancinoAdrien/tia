-- ============================================================================
-- MIGRATION COMPLÈTE: Ajouter toutes les colonnes et tables manquantes
-- ============================================================================

-- 1. Ajouter les colonnes manquantes dans la table users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0 CHECK (points >= 0);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS credits DECIMAL(12, 2) DEFAULT 0.00 CHECK (credits >= 0);

-- 2. Ajouter les colonnes manquantes dans la table ads
ALTER TABLE ads
ADD COLUMN IF NOT EXISTS sold_quantity INTEGER DEFAULT 0 CHECK (sold_quantity >= 0);

ALTER TABLE ads
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;

ALTER TABLE ads
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

ALTER TABLE ads
ADD COLUMN IF NOT EXISTS max_photos INTEGER DEFAULT 5;

-- 3. Table pour l'historique des points
CREATE TABLE IF NOT EXISTS user_points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    points INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('daily_login', 'review', 'subscription', 'referral', 'beta', 'reward_claimed')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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

-- 6. Créer des index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_user_points_history_user ON user_points_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_featured_until ON ads(featured_until) WHERE featured_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ads_expires_at ON ads(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_is_urgent ON ads(is_urgent) WHERE is_urgent = true;
CREATE INDEX IF NOT EXISTS idx_ads_sold_quantity ON ads(sold_quantity);

-- 7. Fonction CORRIGÉE pour réinitialiser les crédits "À la une" mensuels (pour packs Pro)
CREATE OR REPLACE FUNCTION reset_monthly_featured_credits()
RETURNS void AS $$
BEGIN
    -- Réinitialiser les crédits pour les utilisateurs Pro (5 crédits/mois)
    UPDATE user_featured_credits ufc
    SET credits_remaining = 5,
        last_reset_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id IN (
        SELECT u.id FROM users u
        WHERE u.premium_pack = 'pro'
        AND (ufc.last_reset_date IS NULL OR ufc.last_reset_date < DATE_TRUNC('month', CURRENT_DATE))
    );

    -- Créer les crédits pour les nouveaux utilisateurs Pro qui n'en ont pas
    INSERT INTO user_featured_credits (user_id, credits_remaining, last_reset_date)
    SELECT u.id, 5, CURRENT_DATE
    FROM users u
    WHERE u.premium_pack = 'pro'
    AND u.id NOT IN (SELECT user_id FROM user_featured_credits)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 8. Fonction pour mettre à jour expires_at lors de la création d'une annonce
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

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trigger_set_ad_expiration ON ads;

-- Créer le trigger pour définir automatiquement expires_at
CREATE TRIGGER trigger_set_ad_expiration
    BEFORE INSERT ON ads
    FOR EACH ROW
    EXECUTE FUNCTION set_ad_expiration();

-- 9. Initialiser expires_at pour les annonces existantes (30 jours après création)
UPDATE ads
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- 10. Trigger pour mettre à jour updated_at dans user_featured_credits
DROP TRIGGER IF EXISTS update_user_featured_credits_updated_at ON user_featured_credits;

CREATE TRIGGER update_user_featured_credits_updated_at 
BEFORE UPDATE ON user_featured_credits
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VÉRIFICATIONS
-- ============================================================================

-- Vérifier que toutes les colonnes existent
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    -- Vérifier users.points
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'points';
    
    IF col_count > 0 THEN
        RAISE NOTICE '✅ Colonne users.points existe';
    ELSE
        RAISE NOTICE '❌ Colonne users.points manquante';
    END IF;

    -- Vérifier users.credits
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'credits';
    
    IF col_count > 0 THEN
        RAISE NOTICE '✅ Colonne users.credits existe';
    ELSE
        RAISE NOTICE '❌ Colonne users.credits manquante';
    END IF;

    -- Vérifier ads.sold_quantity
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'ads' AND column_name = 'sold_quantity';
    
    IF col_count > 0 THEN
        RAISE NOTICE '✅ Colonne ads.sold_quantity existe';
    ELSE
        RAISE NOTICE '❌ Colonne ads.sold_quantity manquante';
    END IF;

    -- Vérifier ads.is_urgent
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'ads' AND column_name = 'is_urgent';
    
    IF col_count > 0 THEN
        RAISE NOTICE '✅ Colonne ads.is_urgent existe';
    ELSE
        RAISE NOTICE '❌ Colonne ads.is_urgent manquante';
    END IF;

    -- Vérifier ads.expires_at
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'ads' AND column_name = 'expires_at';
    
    IF col_count > 0 THEN
        RAISE NOTICE '✅ Colonne ads.expires_at existe';
    ELSE
        RAISE NOTICE '❌ Colonne ads.expires_at manquante';
    END IF;

    -- Vérifier ads.max_photos
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'ads' AND column_name = 'max_photos';
    
    IF col_count > 0 THEN
        RAISE NOTICE '✅ Colonne ads.max_photos existe';
    ELSE
        RAISE NOTICE '❌ Colonne ads.max_photos manquante';
    END IF;
END $$;

-- Vérifier que toutes les tables existent
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    -- Vérifier user_points_history
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name = 'user_points_history';
    
    IF table_count > 0 THEN
        RAISE NOTICE '✅ Table user_points_history existe';
    ELSE
        RAISE NOTICE '❌ Table user_points_history manquante';
    END IF;

    -- Vérifier user_featured_credits
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name = 'user_featured_credits';
    
    IF table_count > 0 THEN
        RAISE NOTICE '✅ Table user_featured_credits existe';
    ELSE
        RAISE NOTICE '❌ Table user_featured_credits manquante';
    END IF;

    -- Vérifier credit_transactions
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name = 'credit_transactions';
    
    IF table_count > 0 THEN
        RAISE NOTICE '✅ Table credit_transactions existe';
    ELSE
        RAISE NOTICE '❌ Table credit_transactions manquante';
    END IF;
END $$;

-- Message de confirmation final
SELECT '🎉 Migration terminée avec succès!' as status;
SELECT 'Toutes les colonnes et tables ont été créées ou vérifiées.' as message;

-- Statistiques
SELECT 
    'Utilisateurs avec points' as type,
    COUNT(*) as count
FROM users 
WHERE points > 0

UNION ALL

SELECT 
    'Utilisateurs avec crédits' as type,
    COUNT(*) as count
FROM users 
WHERE credits > 0

UNION ALL

SELECT 
    'Annonces urgentes' as type,
    COUNT(*) as count
FROM ads 
WHERE is_urgent = true

UNION ALL

SELECT 
    'Annonces à la une' as type,
    COUNT(*) as count
FROM ads 
WHERE is_featured = true AND featured_until > CURRENT_TIMESTAMP;