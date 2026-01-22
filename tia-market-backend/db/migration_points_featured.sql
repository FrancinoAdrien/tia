-- Migration: Ajouter le système de points, crédits, et fonctionnalités premium avancées
-- Exécutez ce script SQL pour mettre à jour le schéma de la base de données

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

-- Vérification
SELECT 'Migration terminée avec succès!' as status;
SELECT COUNT(*) as users_avec_points FROM users WHERE points > 0;
