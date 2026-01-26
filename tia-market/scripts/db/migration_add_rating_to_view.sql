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
CREATE OR REPLACE FUNCTION sync_user_ratings()
RETURNS TRIGGER AS $$
BEGIN
    -- Si on met à jour user_profiles, synchroniser vers users
    IF TG_TABLE_NAME = 'user_profiles' THEN
        UPDATE users 
        SET 
            rating = COALESCE(NEW.rating, 0.00),
            rating_count = COALESCE(NEW.total_ratings, 0)
        WHERE id = NEW.id;
    -- Si on met à jour users, synchroniser vers user_profiles
    ELSIF TG_TABLE_NAME = 'users' THEN
        UPDATE user_profiles 
        SET 
            rating = COALESCE(NEW.rating, 0.00),
            total_ratings = COALESCE(NEW.rating_count, 0)
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- 7. Vérification
SELECT 'Migration terminée avec succès!' as status;
SELECT COUNT(*) as users_avec_rating FROM users WHERE rating > 0;
SELECT COUNT(*) as users_avec_rating_count FROM users WHERE rating_count > 0;