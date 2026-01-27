# Documentation du Système Premium TIA Market

## Vue d'ensemble

Ce document décrit le système complet de packs premium, de notation et de limitations pour TIA Market.

---

## 📊 Packs Premium et Leurs Caractéristiques

### 1. Pack SIMPLE (Utilisateur Gratuit)
**Limitations strictes :**
- ✅ **Quantité par annonce** : 1 seule unité
- ✅ **Photos par annonce** : Maximum 3 photos
- ✅ **Annonces simultanées** : Maximum 5 annonces actives
- ✅ **Durée de vie annonce** : 30 jours, puis doit payer pour remonter
- ✅ **Remontée payante** : 
  - 2000 Ar pour 1 remontée
  - 8000 Ar pour 5 remontées
- ❌ **Pas de mise à la une**
- ❌ **Pas de badge**
- ❌ **Pas de modifications illimitées**
- ⚠️ **Paiement requis pour surplus** : Doit payer pour dépasser les limites

---

### 2. Pack STARTER
**Caractéristiques :**
- ✅ **Quantité par annonce** : 10 unités
- ✅ **Photos par annonce** : Maximum 10 photos
- ✅ **Annonces simultanées** : Maximum 20 annonces actives
- ✅ **Mise à la une** : 5 mises à la une de 7 jours chacune
  - Peut remettre une annonce à la une depuis son profil
- ✅ **Modifications** : 5 modifications par annonce
  - Chaque modification décrémente le compteur
- ❌ **Pas encore de badge**
- ⚠️ **Paiement pour surplus** : Doit payer pour dépasser les limites

---

### 3. Pack PRO ⭐
**Caractéristiques premium :**
- ✅ **Quantité par annonce** : 20 unités
- ✅ **Photos** : 
  - 20 photos standard
  - **ILLIMITÉ pour 10 annonces spécifiques**
- ✅ **Annonces simultanées** : Maximum 50 annonces actives
- ✅ **Mise à la une** : 10 mises à la une de 14 jours chacune
- ✅ **Modifications** : 15 modifications par annonce
- ✅ **Badge** : "Vendeur Vérifié" (badge_type: 'verified_seller')
- ✅ **Remontées gratuites** : 5 remontées gratuites
- ✅ **Statistiques détaillées** : Accès aux stats avancées dans le profil
  - Vues par jour
  - Favoris par jour
  - Messages reçus
  - Vues du numéro de téléphone

---

### 4. Pack ENTREPRISE 🏢 (Le Plus Prestigieux)
**Caractéristiques illimitées :**
- ✅ **Quantité** : ILLIMITÉE
- ✅ **Photos** : ILLIMITÉES
- ✅ **Annonces simultanées** : ILLIMITÉES
- ✅ **Mise à la une** : ILLIMITÉE
- ✅ **Remontées** : ILLIMITÉES
- ✅ **Badge** : "Entreprise Premium" (badge_type: 'premium_business')
- ✅ **Multi-utilisateurs** : 5 personnes peuvent gérer le compte
  - Possibilité d'ajouter/retirer des utilisateurs depuis le profil
  - Gestion des permissions par utilisateur
- ✅ **Statistiques détaillées** : Accès complet aux statistiques avancées

---

## ⭐ Système de Notation (5 Étoiles)

### Notation des Utilisateurs
- **Note initiale** : 2.5 étoiles pour tous les nouveaux utilisateurs
- **Système** : Notation de 1 à 5 étoiles
- **Calcul** : Moyenne de toutes les notes reçues
- **Table** : `user_ratings`
- **Affichage** : Note visible sur le profil utilisateur

### Notation des Annonces (Commentaires)
- **Système** : Commentaires avec note de 1 à 5 étoiles
- **Table** : `ad_comments`
- **Un commentaire par utilisateur** : Limite d'un commentaire par annonce
- **Calcul** : Note moyenne affichée sur l'annonce
- **Modération** : Possibilité d'approuver/désapprouver les commentaires

---

## 💬 Système de Commentaires

Les utilisateurs peuvent :
- Laisser un commentaire sur une annonce
- Donner une note de 1 à 5 étoiles
- Un seul commentaire par annonce par utilisateur
- Les commentaires sont approuvés par défaut

**Table : `ad_comments`**
```sql
- id: UUID
- ad_id: UUID
- user_id: UUID
- comment: TEXT
- rating: INTEGER (1-5)
- is_approved: BOOLEAN
- created_at: TIMESTAMP
```

---

## 📈 Système de Statistiques (Pro et Entreprise uniquement)

**Table : `ad_statistics`**

Statistiques quotidiennes par annonce :
- Nombre de vues
- Nombre de favoris
- Nombre de messages reçus
- Nombre de fois que le numéro de téléphone a été vu

---

## 👥 Système Multi-Utilisateurs (Pack Entreprise)

**Table : `company_members`**

Permet à un compte entreprise d'avoir jusqu'à 5 utilisateurs :
- **Rôles** : owner, admin, member
- **Permissions configurables** :
  - Peut poster des annonces
  - Peut éditer des annonces
  - Peut gérer les membres
- **Gestion depuis le profil** :
  - Ajouter un utilisateur (jusqu'à 5 max)
  - Retirer un utilisateur
  - Modifier les permissions

---

## 💰 Système de Remontée Payante

### Pour Utilisateurs Simple
- **1 remontée** : 2000 Ar
- **5 remontées** : 8000 Ar (réduction)
- Après 30 jours, l'annonce doit être remontée (payant)

### Pour Pack Pro
- **5 remontées gratuites** incluses
- Remontées supplémentaires payantes

### Pour Pack Entreprise
- **Remontées illimitées gratuites**

**Table : `boost_payments`**
- Enregistre tous les paiements de remontée
- Compteur `boost_count` dans la table `ads`

---

## 🗄️ Structure de la Base de Données

### Nouvelles Tables

1. **`company_members`** : Gestion des membres pour comptes entreprise
2. **`ad_comments`** : Commentaires sur les annonces avec notation
3. **`user_ratings`** : Notation entre utilisateurs
4. **`boost_payments`** : Paiements de remontée d'annonces
5. **`ad_statistics`** : Statistiques détaillées par annonce

### Tables Modifiées

1. **`users`**
   - `premium_pack` : ENUM ('simple', 'starter', 'pro', 'entreprise')
   - `badge` : ENUM ('none', 'verified_seller', 'premium_business')
   - `ads_count` : Compteur d'annonces actives
   - `featured_ads_used` : Compteur de mises à la une utilisées
   - `ad_modifications_used` : Compteur de modifications
   - `boost_count_used` : Compteur de remontées utilisées
   - `is_company_account` : BOOLEAN
   - `company_owner_id` : UUID (pour membres d'entreprise)

2. **`user_profiles`**
   - `rating` : DECIMAL(3,2) DEFAULT 2.50 (note initiale)
   - `total_ratings` : INTEGER (nombre total de notes)
   - `rating_sum` : INTEGER (somme des notes)

3. **`ads`**
   - `quantity` : INTEGER (quantité disponible)
   - `is_featured` : BOOLEAN
   - `featured_until` : TIMESTAMP
   - `featured_days` : INTEGER
   - `modification_count` : INTEGER
   - `boost_count` : INTEGER
   - `last_boosted_at` : TIMESTAMP
   - `rating_avg` : DECIMAL(3,2)
   - `rating_count` : INTEGER

---

## 🔧 Fonctions et Triggers

### Triggers Automatiques

1. **`update_user_rating()`** : Met à jour la note moyenne d'un utilisateur
2. **`update_ad_rating()`** : Met à jour la note moyenne d'une annonce
3. **`update_updated_at_column()`** : Met à jour le timestamp de modification

---

## 📝 Règles de Validation Backend

### À implémenter dans les routes API :

1. **Création d'annonce** :
   - Vérifier le nombre d'annonces simultanées selon le pack
   - Vérifier la quantité selon le pack
   - Limiter le nombre de photos selon le pack

2. **Modification d'annonce** :
   - Vérifier le compteur de modifications selon le pack
   - Décrémenter le compteur à chaque modification

3. **Mise à la une** :
   - Vérifier le nombre de mises à la une disponibles
   - Calculer la date de fin selon le pack (7j ou 14j)
   - Décrémenter le compteur

4. **Remontée d'annonce** :
   - Vérifier si gratuit selon le pack
   - Créer un paiement si nécessaire
   - Mettre à jour `last_boosted_at`

5. **Upload de photos** :
   - Compter les photos existantes
   - Vérifier la limite selon le pack
   - Bloquer si limite atteinte (sauf illimité)

6. **Gestion membres entreprise** :
   - Vérifier que c'est un compte entreprise
   - Limiter à 5 membres maximum
   - Gérer les permissions

---

## 🎯 Ordre de Prestige des Packs

1. **Pack ENTREPRISE** 🏢 (Le plus prestigieux)
2. **Pack PRO** ⭐
3. **Pack STARTER**
4. **Pack SIMPLE** (Utilisateur gratuit)

---

## 📋 Checklist d'Implémentation Backend

- [x] Schéma de base de données créé
- [ ] Routes API pour création d'annonces avec vérifications
- [ ] Routes API pour modification d'annonces avec compteurs
- [ ] Routes API pour mise à la une
- [ ] Routes API pour remontée d'annonces
- [ ] Routes API pour commentaires et notations
- [ ] Routes API pour notation utilisateurs
- [ ] Routes API pour statistiques (Pro/Entreprise)
- [ ] Routes API pour gestion membres entreprise
- [ ] Routes API pour gestion des paiements de remontée
- [ ] Middleware de vérification des limites par pack
- [ ] Tests unitaires pour chaque fonctionnalité

---

## 🚀 Prochaines Étapes

1. Mettre à jour `server.js` avec toutes les nouvelles routes
2. Créer un fichier de helpers pour vérifier les limites par pack
3. Créer des constantes pour les limites de chaque pack
4. Implémenter les routes API une par une
5. Tester chaque fonctionnalité
6. Mettre à jour le frontend mobile pour utiliser ces nouvelles features

---

## 📞 Support

Pour toute question sur l'implémentation, référez-vous à ce document et au fichier `db/db.sql` pour la structure complète de la base de données.
