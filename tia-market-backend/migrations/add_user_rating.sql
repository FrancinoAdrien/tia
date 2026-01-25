-- Migration: Ajout du système de notation pour les utilisateurs
-- Tous les utilisateurs commencent avec une note de 2.5/5

-- Ajouter la colonne rating (notation) aux utilisateurs
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Mettre à jour tous les utilisateurs existants avec une note de 2.5
UPDATE users 
SET rating = 2.50, rating_count = 0 
WHERE rating IS NULL;

-- Créer une table pour stocker les évaluations individuelles
CREATE TABLE IF NOT EXISTS user_ratings (
    id SERIAL PRIMARY KEY,
    rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rater_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_id UUID REFERENCES ads(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rated_user_id, rater_user_id, ad_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_ratings_rated_user ON user_ratings(rated_user_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_rater_user ON user_ratings(rater_user_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_ad ON user_ratings(ad_id);

-- Fonction pour recalculer la note moyenne d'un utilisateur
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculer la note moyenne pour l'utilisateur évalué
    UPDATE users
    SET rating = (
        SELECT COALESCE(AVG(rating), 2.50)
        FROM user_ratings
        WHERE rated_user_id = NEW.rated_user_id
    ),
    rating_count = (
        SELECT COUNT(*)
        FROM user_ratings
        WHERE rated_user_id = NEW.rated_user_id
    )
    WHERE id = NEW.rated_user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement la note moyenne
DROP TRIGGER IF EXISTS trigger_update_user_rating ON user_ratings;
CREATE TRIGGER trigger_update_user_rating
AFTER INSERT OR UPDATE OR DELETE ON user_ratings
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();

COMMENT ON COLUMN users.rating IS 'Note moyenne de l''utilisateur (0-5), initialement 2.5';
COMMENT ON COLUMN users.rating_count IS 'Nombre total d''évaluations reçues';
COMMENT ON TABLE user_ratings IS 'Évaluations individuelles des utilisateurs';
