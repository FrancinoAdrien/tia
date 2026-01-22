-- Migration: Ajouter le statut 'delivered' à la table bookings
-- Exécutez ce script SQL pour mettre à jour le schéma de la base de données

-- Étape 1: Supprimer la contrainte CHECK existante
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Étape 2: Ajouter la nouvelle contrainte CHECK avec le statut 'delivered'
ALTER TABLE bookings 
ADD CONSTRAINT bookings_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'delivered', 'paid', 'completed', 'cancelled'));

-- Vérification: Afficher les contraintes pour confirmer
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
AND conname = 'bookings_status_check';
