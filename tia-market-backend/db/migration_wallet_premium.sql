-- Migration: Ajouter le système de wallet et les nouveaux plans premium
-- Exécutez ce script SQL pour mettre à jour le schéma de la base de données

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

-- Vérification
SELECT 'Migration terminée avec succès!' as status;
SELECT COUNT(*) as wallets_crees FROM wallet;
SELECT COUNT(*) as users_avec_wallet FROM (SELECT DISTINCT user_id FROM wallet) t;
