-- Migration: Ajouter les statuts 'delivered' et 'delivery_confirmed' à la table bookings
-- Exécutez ce script SQL pour mettre à jour le schéma de la base de données

-- Étape 1: Supprimer la contrainte CHECK existante
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Étape 2: Ajouter la nouvelle contrainte CHECK avec les nouveaux statuts
ALTER TABLE bookings 
ADD CONSTRAINT bookings_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'delivered', 'delivery_confirmed', 'paid', 'completed', 'cancelled'));

-- Ajouter une colonne pour le numéro de téléphone du vendeur (pour Mobile Money)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seller_phone VARCHAR(20);

-- Vérification: Afficher les contraintes pour confirmer
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
AND conname = 'bookings_status_check';
